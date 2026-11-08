const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const readXlsxFile = require("read-excel-file/node");
const { pool } = require("../database");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    const name = (file.originalname || "").toLowerCase();
    if (name.endsWith(".csv") || name.endsWith(".xlsx")) {
      callback(null, true);
      return;
    }
    callback(new Error("Upload a CSV or Excel (.xlsx) file."));
  },
});

function requireAdmin(req, res, next) {
  if (req.session.user?.role !== "admin") {
    return res.status(req.session.user ? 403 : 401).json({
      error: "Administrator access is required.",
    });
  }
  next();
}

router.use(requireAdmin);

function normalizeRecord(input) {
  const year = Number(input.year_of_passing);
  return {
    full_name: String(input.full_name || "").trim(),
    roll_number: String(input.roll_number || "").trim().toUpperCase(),
    year_of_passing: year,
    branch: String(input.branch || "").trim(),
    email: String(input.email || "").trim().toLowerCase() || null,
    phone: String(input.phone || "").trim() || null,
    linkedin_url: String(input.linkedin_url || "").trim() || null,
  };
}

function validateRecord(record) {
  if (!record.full_name) return "Name is required.";
  if (!record.roll_number) return "Roll number is required.";
  if (!Number.isInteger(record.year_of_passing)
    || record.year_of_passing < 1900
    || record.year_of_passing > 2200) {
    return "Graduation year must be a valid year between 1900 and 2200.";
  }
  if (!record.branch) return "Branch is required.";
  if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
    return "Email address is invalid.";
  }
  return null;
}

function extractRow(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key.toLowerCase().replace(/[^a-z0-9]/g, "")] = value;
  }
  return normalizeRecord({
    full_name: normalized.name || normalized.fullname || normalized.studentname,
    roll_number: normalized.rollnumber || normalized.rollno || normalized.registernumber
      || normalized.regno || normalized.alumniid,
    year_of_passing: normalized.graduationyear || normalized.yearofpassing
      || normalized.passingyear || normalized.gradyear || normalized.year,
    branch: normalized.branch || normalized.department || normalized.dept,
    email: normalized.email || normalized.emailaddress,
    phone: normalized.phone || normalized.phonenumber || normalized.mobile,
    linkedin_url: normalized.linkedinurl || normalized.linkedin,
  });
}

router.get("/", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    const params = [];
    let where = "";
    if (query) {
      params.push(`%${query}%`);
      where = `WHERE i.full_name ILIKE $1 OR i.roll_number ILIKE $1 OR i.branch ILIKE $1
        OR i.email ILIKE $1`;
    }
    const { rows } = await pool.query(
      `SELECT i.id, i.full_name, i.roll_number, i.year_of_passing, i.branch,
              i.email, i.phone, i.linkedin_url, i.imported_alumni_id, i.imported_at,
              i.created_at, a.id AS matching_alumni_id
       FROM new_graduate_intake i
      LEFT JOIN LATERAL (
        SELECT id FROM alumni
        WHERE UPPER(roll_number) = UPPER(i.roll_number)
        ORDER BY id
        LIMIT 1
      ) a ON TRUE
       ${where}
       ORDER BY i.year_of_passing DESC, i.roll_number ASC`,
      params
    );
    res.json({ records: rows });
  } catch (error) {
    console.error("Could not load new graduate intake:", error);
    res.status(500).json({ error: "Could not load new graduate records." });
  }
});

router.post("/", async (req, res) => {
  const record = normalizeRecord(req.body || {});
  const validationError = validateRecord(record);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const { rows } = await pool.query(
      `INSERT INTO new_graduate_intake
        (full_name, roll_number, year_of_passing, branch, email, phone, linkedin_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        record.full_name,
        record.roll_number,
        record.year_of_passing,
        record.branch,
        record.email,
        record.phone,
        record.linkedin_url,
      ]
    );
    res.status(201).json({ record: rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That roll number is already in the intake list." });
    }
    console.error("Could not add new graduate:", error);
    res.status(500).json({ error: "Could not add the new graduate." });
  }
});

function receiveUpload(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (error) return res.status(400).json({ error: error.message });
    next();
  });
}

router.post("/upload", receiveUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Choose a CSV or Excel file to upload." });
  }

  let rows;
  try {
    const filename = req.file.originalname.toLowerCase();
    if (filename.endsWith(".csv")) {
      rows = parse(req.file.buffer, { bom: true, columns: true, skip_empty_lines: true, trim: true });
    } else {
      const sheetRows = await readXlsxFile(req.file.buffer);
      const headers = (sheetRows[0] || []).map((value) => String(value || "").trim());
      rows = sheetRows.slice(1)
        .filter((values) => values.some((value) => value !== null && value !== ""))
        .map((values) => Object.fromEntries(
          headers.map((header, index) => [header, values[index] ?? ""])
        ));
    }
  } catch (error) {
    return res.status(400).json({ error: `Could not read the file: ${error.message}` });
  }
  if (!rows.length) return res.status(400).json({ error: "The file has no data rows." });

  let client;
  let added = 0;
  const skipped = [];
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    for (const [index, rawRow] of rows.entries()) {
      const record = extractRow(rawRow);
      const validationError = validateRecord(record);
      if (validationError) {
        skipped.push({ row: index + 2, roll_number: record.roll_number || "", reason: validationError });
        continue;
      }

      try {
        const result = await client.query(
          `INSERT INTO new_graduate_intake
            (full_name, roll_number, year_of_passing, branch, email, phone, linkedin_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (roll_number) DO NOTHING`,
          [
            record.full_name,
            record.roll_number,
            record.year_of_passing,
            record.branch,
            record.email,
            record.phone,
            record.linkedin_url,
          ]
        );
        if (result.rowCount) added += 1;
        else skipped.push({
          row: index + 2,
          roll_number: record.roll_number,
          reason: "That roll number is already in the intake list.",
        });
      } catch (error) {
        throw new Error(`Could not import spreadsheet row ${index + 2}: ${error.message}`);
      }
    }
    await client.query("COMMIT");
    res.json({ total: rows.length, added, skipped });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Could not roll back new graduate upload:", rollbackError);
      }
    }
    console.error("Could not upload new graduate records:", error);
    res.status(500).json({ error: error.message || "Could not upload the records." });
  } finally {
    client?.release();
  }
});

function splitName(fullName) {
  const [firstName = "", ...rest] = fullName.trim().split(/\s+/);
  if (rest.length < 2) {
    return { firstName, middleName: null, lastName: rest[0] || null };
  }
  return {
    firstName,
    middleName: rest.slice(0, -1).join(" "),
    lastName: rest[rest.length - 1],
  };
}

router.post("/import", async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0
    || ids.some((id) => !Number.isInteger(Number(id)) || Number(id) < 1)) {
    return res.status(400).json({ error: "Select at least one valid intake record to import." });
  }

  let client;
  const imported = [];
  const skipped = [];
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT * FROM new_graduate_intake
       WHERE id = ANY($1::int[])
       ORDER BY id
       FOR UPDATE`,
      [ids.map(Number)]
    );
    for (const record of rows) {
      if (record.imported_alumni_id) {
        skipped.push({ id: record.id, roll_number: record.roll_number, reason: "Already imported." });
        continue;
      }
      const existing = await client.query(
        "SELECT id FROM alumni WHERE UPPER(roll_number) = UPPER($1)",
        [record.roll_number]
      );
      if (existing.rows.length) {
        skipped.push({
          id: record.id,
          roll_number: record.roll_number,
          reason: "An alumni record with this roll number already exists.",
        });
        continue;
      }

      const { firstName, middleName, lastName } = splitName(record.full_name);
      const alumnus = await client.query(
        `INSERT INTO alumni (
          roll_number, first_name, middle_name, last_name,
          year_of_passing, branch, email, phone, linkedin_url,
          linkedin_status, data_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          record.roll_number,
          firstName,
          middleName,
          lastName,
          record.year_of_passing,
          record.branch,
          record.email,
          record.phone,
          record.linkedin_url,
          record.linkedin_url ? "pending" : "missing",
          "new_graduate_import",
        ]
      );
      await client.query(
        `UPDATE new_graduate_intake
         SET imported_alumni_id = $1, imported_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [alumnus.rows[0].id, record.id]
      );
      imported.push({ id: record.id, alumni_id: alumnus.rows[0].id, roll_number: record.roll_number });
    }
    await client.query("COMMIT");
    res.json({ imported, skipped });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Could not roll back new graduate import:", rollbackError);
      }
    }
    console.error("Could not import new graduates into alumni:", error);
    res.status(500).json({ error: "Could not import the selected graduates." });
  } finally {
    client?.release();
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid intake record ID." });
  }
  try {
    const result = await pool.query(
      "DELETE FROM new_graduate_intake WHERE id = $1 AND imported_at IS NULL RETURNING id",
      [id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Pending intake record not found." });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Could not delete intake record:", error);
    res.status(500).json({ error: "Could not delete the intake record." });
  }
});

module.exports = router;
