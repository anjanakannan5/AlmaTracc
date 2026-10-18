const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

// Uses almatracc.db in backend folder (or root fallback)
const DB_PATH =
  process.env.DB_PATH ||
  (fs.existsSync(path.join(__dirname, "almatracc.db"))
    ? path.join(__dirname, "almatracc.db")
    : path.join(__dirname, "..", "almatracc.db"));

console.log(`Connecting to database at: ${DB_PATH}`);
const db = new DatabaseSync(DB_PATH);

// Ensure 'password' column exists in alumni table
try {
  const alumniCols = db.prepare("PRAGMA table_info(alumni)").all().map((c) => c.name);
  if (!alumniCols.includes("password")) {
    db.exec("ALTER TABLE alumni ADD COLUMN password TEXT");
    console.log("Added 'password' column to alumni table");
  }
} catch (err) {
  console.error("Migration check for password column:", err);
}

const app = express();
app.use(cors());
app.use(express.json());

// 1. Health check
app.get("/api/health", (req, res) => {
  try {
    const { total } = db.prepare("SELECT COUNT(*) AS total FROM alumni").get();
    res.json({ status: "ok", alumni: total, database: DB_PATH });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// 2. High-level dashboard statistics
app.get("/api/stats", (req, res) => {
  try {
    const { total } = db.prepare("SELECT COUNT(*) AS total FROM alumni").get() || { total: 0 };
    const { batches } = db.prepare(
      "SELECT COUNT(DISTINCT year_of_passing) AS batches FROM alumni WHERE year_of_passing IS NOT NULL"
    ).get() || { batches: 0 };
    const { withCompany } = db.prepare(
      "SELECT COUNT(*) AS withCompany FROM alumni WHERE current_company IS NOT NULL AND TRIM(current_company) != '' AND current_company != 'Not provided'"
    ).get() || { withCompany: 0 };
    const { registered } = db.prepare(
      "SELECT COUNT(*) AS registered FROM alumni WHERE (email IS NOT NULL AND TRIM(email) != '') OR data_source = 'self_edit'"
    ).get() || { registered: 0 };

    const statusBreakdown = db.prepare(
      "SELECT linkedin_status AS status, COUNT(*) AS count FROM alumni GROUP BY linkedin_status"
    ).all();

    const yearRows = db.prepare(
      "SELECT DISTINCT year_of_passing FROM alumni WHERE year_of_passing IS NOT NULL ORDER BY year_of_passing DESC"
    ).all();
    const years = yearRows.map((r) => String(r.year_of_passing));

    const companyRows = db.prepare(
      "SELECT DISTINCT current_company FROM alumni WHERE current_company IS NOT NULL AND TRIM(current_company) != '' ORDER BY current_company"
    ).all();
    const companies = companyRows.map((r) => r.current_company);

    res.json({
      total,
      batches,
      withCompany,
      missingCompany: Math.max(0, total - withCompany),
      registered,
      statusBreakdown,
      years,
      companies,
    });
  } catch (err) {
    console.error("Error in /api/stats:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. List / search alumni with filters
app.get("/api/alumni", (req, res) => {
  try {
    const { q = "", year, company, status, limit = 100, offset = 0 } = req.query;
    const queryTerm = q.trim();

    let sql = `
      SELECT id, roll_number, first_name, middle_name, last_name, gender,
             year_of_joining, year_of_passing, branch, email, phone,
             linkedin_url, linkedin_status, current_role, current_company,
             location, data_source, last_enriched_at, updated_at
      FROM alumni
      WHERE 1=1
    `;
    const params = [];

    if (queryTerm) {
      const like = `%${queryTerm}%`;
      sql += ` AND (
        first_name LIKE ? OR
        middle_name LIKE ? OR
        last_name LIKE ? OR
        roll_number LIKE ? OR
        current_company LIKE ? OR
        current_role LIKE ? OR
        location LIKE ?
      )`;
      params.push(like, like, like, like, like, like, like);
    }

    if (year && year !== "all") {
      sql += " AND year_of_passing = ?";
      params.push(Number(year));
    }

    if (company && company !== "all") {
      if (company === "Not provided") {
        sql += " AND (current_company IS NULL OR TRIM(current_company) = '' OR current_company = 'Not provided')";
      } else {
        sql += " AND current_company = ?";
        params.push(company);
      }
    }

    if (status && status !== "all") {
      sql += " AND linkedin_status = ?";
      params.push(status);
    }

    sql += " ORDER BY roll_number ASC";

    const parsedLimit = limit === "all" ? 2000 : Math.min(Math.max(Number(limit) || 50, 1), 2000);
    sql += " LIMIT ? OFFSET ?";
    params.push(parsedLimit, Math.max(Number(offset) || 0, 0));

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    console.error("Error in /api/alumni:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Get single alumnus by roll number
app.get("/api/alumni/:rollNumber", (req, res) => {
  try {
    const alumnus = db.prepare(
      "SELECT * FROM alumni WHERE UPPER(roll_number) = UPPER(?)"
    ).get(req.params.rollNumber);

    if (!alumnus) {
      return res.status(404).json({ error: "Alumnus not found" });
    }

    const history = db.prepare(
      "SELECT * FROM alumni_career_history WHERE alumni_id = ? ORDER BY fetched_at DESC"
    ).all(alumnus.id);

    res.json({ ...alumnus, career_history: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Update alumnus profile
app.put("/api/alumni/:rollNumber", (req, res) => {
  try {
    const roll = req.params.rollNumber.trim().toUpperCase();
    const existing = db.prepare("SELECT * FROM alumni WHERE UPPER(roll_number) = ?").get(roll);
    if (!existing) {
      return res.status(404).json({ error: "Alumnus not found" });
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      current_role,
      current_company,
      location,
      linkedin_url,
    } = req.body;

    const newFirstName = first_name !== undefined ? first_name : existing.first_name;
    const newLastName = last_name !== undefined ? last_name : existing.last_name;
    const newEmail = email !== undefined ? email : existing.email;
    const newPhone = phone !== undefined ? phone : existing.phone;
    const newRole = current_role !== undefined ? current_role : existing.current_role;
    const newCompany = current_company !== undefined ? current_company : existing.current_company;
    const newLocation = location !== undefined ? location : existing.location;
    const newLinkedinUrl = linkedin_url !== undefined ? linkedin_url : existing.linkedin_url;

    let newStatus = existing.linkedin_status;
    if (newLinkedinUrl && newLinkedinUrl !== existing.linkedin_url) {
      newStatus = "pending";
    }

    db.prepare(`
      UPDATE alumni
      SET first_name = ?,
          last_name = ?,
          email = ?,
          phone = ?,
          current_role = ?,
          current_company = ?,
          location = ?,
          linkedin_url = ?,
          linkedin_status = ?,
          data_source = 'self_edit',
          updated_at = datetime('now')
      WHERE UPPER(roll_number) = ?
    `).run(
      newFirstName,
      newLastName,
      newEmail,
      newPhone,
      newRole,
      newCompany,
      newLocation,
      newLinkedinUrl,
      newStatus,
      roll
    );

    const updated = db.prepare("SELECT * FROM alumni WHERE UPPER(roll_number) = ?").get(roll);
    res.json({ message: "Profile updated successfully", alumnus: updated });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Authentication endpoint
app.post("/api/auth/login", (req, res) => {
  try {
    const { role, identifier, password } = req.body;

    if (role === "admin") {
      const adminPass = (password || "").trim();
      if (!adminPass) {
        return res.status(400).json({ success: false, error: "Admin password is required." });
      }
      if (adminPass !== "admin" && adminPass !== "admin123") {
        return res.status(401).json({ success: false, error: "Invalid admin password. (Default is 'admin' or 'admin123')" });
      }
      return res.json({
        success: true,
        role: "admin",
        user: { name: "System Administrator", role: "admin" },
      });
    }

    // Alumni authentication: search by roll number or email
    const term = (identifier || "").trim().toUpperCase();
    if (!term) {
      return res.status(400).json({ success: false, error: "Roll number or registered email is required." });
    }

    if (!password || !password.trim()) {
      return res.status(400).json({ success: false, error: "Password is required." });
    }

    const alumnus = db.prepare(
      "SELECT * FROM alumni WHERE UPPER(roll_number) = ? OR UPPER(COALESCE(email, '')) = ?"
    ).get(term, term);

    if (!alumnus) {
      return res.status(404).json({
        success: false,
        error: `No alumni record found with '${identifier}'. Check your roll number (e.g. 97MW01).`,
      });
    }

    // Password validation:
    // If alumnus has a custom saved password, check against it.
    // Otherwise, default password is their roll_number (case-insensitive for convenience).
    const enteredPassword = password.trim();
    let isValidPassword = false;

    if (alumnus.password && alumnus.password.trim() !== "") {
      isValidPassword = (enteredPassword === alumnus.password.trim());
    } else {
      isValidPassword = (enteredPassword.toUpperCase() === alumnus.roll_number.trim().toUpperCase());
    }

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: "Incorrect password. Default password is your roll number (e.g. " + alumnus.roll_number + ").",
      });
    }

    // Return alumnus details without password field
    const { password: _, ...safeAlumnus } = alumnus;

    res.json({
      success: true,
      role: "alumni",
      alumnus: safeAlumnus,
    });
  } catch (err) {
    console.error("Error in /api/auth/login:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Change password endpoint for alumni
app.post("/api/alumni/:rollNumber/change-password", (req, res) => {
  try {
    const roll = req.params.rollNumber.trim().toUpperCase();
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !currentPassword.trim()) {
      return res.status(400).json({ success: false, error: "Current password is required." });
    }

    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ success: false, error: "New password must be at least 4 characters long." });
    }

    const alumnus = db.prepare("SELECT * FROM alumni WHERE UPPER(roll_number) = ?").get(roll);
    if (!alumnus) {
      return res.status(404).json({ success: false, error: "Alumni record not found." });
    }

    // Verify current password
    const enteredCurrent = currentPassword.trim();
    let isCurrentValid = false;
    if (alumnus.password && alumnus.password.trim() !== "") {
      isCurrentValid = (enteredCurrent === alumnus.password.trim());
    } else {
      isCurrentValid = (enteredCurrent.toUpperCase() === alumnus.roll_number.trim().toUpperCase());
    }

    if (!isCurrentValid) {
      return res.status(400).json({
        success: false,
        error: "Current password is incorrect. If you haven't changed it before, it is your roll number.",
      });
    }

    // Update password in SQLite database
    db.prepare(`
      UPDATE alumni
      SET password = ?,
          updated_at = datetime('now')
      WHERE UPPER(roll_number) = ?
    `).run(newPassword.trim(), roll);

    res.json({
      success: true,
      message: "Password changed successfully! You can now use your new password to sign in.",
    });
  } catch (err) {
    console.error("Error changing password:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`AlmaTracc API running on http://localhost:${PORT}`);
});
