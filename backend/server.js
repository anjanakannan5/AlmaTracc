const express = require("express");
const cors = require("cors");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const path = require("path");
const { spawn } = require("child_process");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const { db, pool, initializeDatabase, verifyPassword } = require("./database");

const app = express();
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const sessionSecret = process.env.SESSION_SECRET;
const sameSite = process.env.SESSION_COOKIE_SAME_SITE || "lax";

function isAllowedOrigin(origin) {
  if (!origin || origin === frontendOrigin) return true;
  if (process.env.NODE_ENV === "production") return false;

  try {
    const url = new URL(origin);
    return url.protocol === "http:"
      && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

if (process.env.NODE_ENV === "production"
  && (!sessionSecret || !process.env.FRONTEND_ORIGIN || !process.env.ADMIN_PASSWORD)) {
  throw new Error("SESSION_SECRET, FRONTEND_ORIGIN, and ADMIN_PASSWORD must be configured in production.");
}
if (!["lax", "none", "strict"].includes(sameSite)) {
  throw new Error("SESSION_COOKIE_SAME_SITE must be lax, none, or strict.");
}
if (sameSite === "none" && process.env.NODE_ENV !== "production") {
  throw new Error("SameSite=None session cookies require production HTTPS.");
}

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const sessionCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
}));
app.use(express.json());
app.use((req, res, next) => {
  if (!isAllowedOrigin(req.get("origin"))) {
    return res.status(403).json({ error: "Request origin is not allowed." });
  }
  next();
});
app.use(session({
  name: "almatracc.sid",
  secret: sessionSecret || "development-only-session-secret",
  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true,
  }),
  resave: false,
  saveUninitialized: false,
  cookie: sessionCookie,
}));

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Please sign in to continue." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.session.user?.role !== "admin") {
    return res.status(req.session.user ? 403 : 401).json({ error: "Administrator access is required." });
  }
  next();
}

function requireAlumnus(req, res, next) {
  if (req.session.user?.role !== "alumni") {
    return res.status(req.session.user ? 403 : 401).json({ error: "Alumni access is required." });
  }
  if (req.params.rollNumber
    && req.session.user.roll_number.toUpperCase() !== req.params.rollNumber.trim().toUpperCase()) {
    return res.status(403).json({ error: "You can only access your own alumni account." });
  }
  next();
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

// 1. Health check
app.get("/api/health", async (req, res) => {
  try {
    const { total } = await db.prepare("SELECT COUNT(*)::int AS total FROM alumni").get();
    res.json({ status: "ok", alumni: total, database: "postgres" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// 2. High-level dashboard statistics
app.get("/api/stats", async (req, res) => {
  try {
    const { total } = await db.prepare("SELECT COUNT(*)::int AS total FROM alumni").get();
    const { batches } = await db.prepare(
      "SELECT COUNT(DISTINCT year_of_passing)::int AS batches FROM alumni WHERE year_of_passing IS NOT NULL"
    ).get();
    const { withCompany } = await db.prepare(
      `SELECT COUNT(*)::int AS "withCompany" FROM alumni WHERE current_company IS NOT NULL AND TRIM(current_company) != '' AND current_company != 'Not provided'`
    ).get();
    const { registered } = await db.prepare(
      "SELECT COUNT(*)::int AS registered FROM alumni WHERE (email IS NOT NULL AND TRIM(email) != '') OR data_source = 'self_edit'"
    ).get();

    const statusBreakdown = await db.prepare(
      'SELECT linkedin_status AS status, COUNT(*)::int AS "count" FROM alumni GROUP BY linkedin_status'
    ).all();

    const yearRows = await db.prepare(
      "SELECT DISTINCT year_of_passing FROM alumni WHERE year_of_passing IS NOT NULL ORDER BY year_of_passing DESC"
    ).all();
    const years = yearRows.map((r) => String(r.year_of_passing));

    const companyRows = await db.prepare(
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
app.get("/api/alumni", requireAdmin, async (req, res) => {
  try {
    const { q = "", year, company, status, limit = 100, offset = 0 } = req.query;
    const queryTerm = q.trim();

    let sql = `
      SELECT id, roll_number, first_name, middle_name, last_name, gender,
             year_of_joining, year_of_passing, branch, email, phone,
             linkedin_url, linkedin_status, "current_role", current_company,
             location, data_source, last_enriched_at, updated_at
      FROM alumni
      WHERE 1=1
    `;
    const params = [];

    if (queryTerm) {
      const like = `%${queryTerm}%`;
      sql += ` AND (
        first_name ILIKE ? OR
        middle_name ILIKE ? OR
        last_name ILIKE ? OR
        roll_number ILIKE ? OR
        current_company ILIKE ? OR
        "current_role" ILIKE ? OR
        location ILIKE ?
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

    const rows = await db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    console.error("Error in /api/alumni:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Get single alumnus by roll number
app.get("/api/alumni/:rollNumber", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: "Please sign in to continue." });
    }
    if (req.session.user.role !== "admin"
      && (req.session.user.role !== "alumni"
        || req.session.user.roll_number.toUpperCase() !== req.params.rollNumber.trim().toUpperCase())) {
      return res.status(403).json({ error: "You can only access your own alumni account." });
    }

    const alumnus = await db.prepare(
      `SELECT id, roll_number, first_name, middle_name, last_name, gender,
              year_of_joining, year_of_passing, branch, email, phone, linkedin_url,
              linkedin_status, "current_role", current_company, location, data_source,
              last_enriched_at, updated_at
       FROM alumni WHERE UPPER(roll_number) = UPPER(?)`
    ).get(req.params.rollNumber);

    if (!alumnus) {
      return res.status(404).json({ error: "Alumnus not found" });
    }

    const history = await db.prepare(
      "SELECT * FROM alumni_career_history WHERE alumni_id = ? ORDER BY fetched_at DESC"
    ).all(alumnus.id);

    res.json({ ...alumnus, career_history: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Update alumnus profile
app.put("/api/alumni/:rollNumber", requireAlumnus, async (req, res) => {
  try {
    const roll = req.params.rollNumber.trim().toUpperCase();
    const existing = await db.prepare("SELECT * FROM alumni WHERE UPPER(roll_number) = ?").get(roll);
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

    await db.prepare(`
      UPDATE alumni
      SET first_name = ?,
          last_name = ?,
          email = ?,
          phone = ?,
          "current_role" = ?,
          current_company = ?,
          location = ?,
          linkedin_url = ?,
          linkedin_status = ?,
          data_source = 'self_edit',
          updated_at = CURRENT_TIMESTAMP
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

    const updated = await db.prepare(
      `SELECT id, roll_number, first_name, middle_name, last_name, gender,
              year_of_joining, year_of_passing, branch, email, phone, linkedin_url,
              linkedin_status, "current_role", current_company, location, data_source,
              last_enriched_at, updated_at
       FROM alumni WHERE UPPER(roll_number) = ?`
    ).get(roll);
    res.json({ message: "Profile updated successfully", alumnus: updated });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Authentication endpoint
app.post("/api/auth/login", async (req, res) => {
  try {
    const { role, identifier, password } = req.body;

    if (role === "admin") {
      const username = (identifier || "").trim();
      const adminPass = (password || "").trim();
      if (!username) {
        return res.status(400).json({ success: false, error: "Admin username is required." });
      }
      if (!adminPass) {
        return res.status(400).json({ success: false, error: "Admin password is required." });
      }
      const admin = await db.prepare(
        "SELECT username, password_hash FROM admin_users WHERE LOWER(username) = LOWER(?)"
      ).get(username);
      if (!admin || !(await verifyPassword(adminPass, admin.password_hash))) {
        return res.status(401).json({ success: false, error: "Invalid admin password." });
      }
      await regenerateSession(req);
      req.session.user = { role: "admin", name: "System Administrator", username: admin.username };
      await saveSession(req);
      return res.json({
        success: true,
        role: "admin",
        user: req.session.user,
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

    const alumnus = await db.prepare(
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

    await regenerateSession(req);
    req.session.user = {
      role: "alumni",
      roll_number: alumnus.roll_number,
      first_name: alumnus.first_name,
      middle_name: alumnus.middle_name,
      last_name: alumnus.last_name,
    };
    await saveSession(req);

    res.json({
      success: true,
      role: "alumni",
      user: req.session.user,
    });
  } catch (err) {
    console.error("Error in /api/auth/login:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/auth/session", requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

app.post("/api/auth/logout", requireAuth, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("almatracc.sid", { ...sessionCookie, maxAge: undefined });
    res.json({ success: true });
  });
});

// 7. Change password endpoint for alumni
app.post("/api/alumni/:rollNumber/change-password", requireAlumnus, async (req, res) => {
  try {
    const roll = req.params.rollNumber.trim().toUpperCase();
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !currentPassword.trim()) {
      return res.status(400).json({ success: false, error: "Current password is required." });
    }

    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ success: false, error: "New password must be at least 4 characters long." });
    }

    const alumnus = await db.prepare("SELECT * FROM alumni WHERE UPPER(roll_number) = ?").get(roll);
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

    // Update password in PostgreSQL
    await db.prepare(`
      UPDATE alumni
      SET password = ?,
          updated_at = CURRENT_TIMESTAMP
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

// 8. Admin endpoint: Reset alumni password back to their roll number
app.post("/api/admin/reset-password", requireAdmin, async (req, res) => {
  try {
    const { rollNumber } = req.body;
    const roll = (rollNumber || "").trim().toUpperCase();

    if (!roll) {
      return res.status(400).json({ success: false, error: "Roll number is required." });
    }

    const alumnus = await db.prepare("SELECT * FROM alumni WHERE UPPER(roll_number) = ?").get(roll);
    if (!alumnus) {
      return res.status(404).json({
        success: false,
        error: `No alumni found with roll number '${rollNumber}'.`,
      });
    }

    // Setting password to NULL clears custom password, reverting to roll_number default
    await db.prepare(`
      UPDATE alumni
      SET password = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE UPPER(roll_number) = ?
    `).run(roll);

    const name = [alumnus.first_name, alumnus.middle_name, alumnus.last_name].filter(Boolean).join(" ") || alumnus.roll_number;

    res.json({
      success: true,
      roll_number: alumnus.roll_number,
      name,
      message: `Password for ${name} (${alumnus.roll_number}) has been reset back to their roll number.`,
    });
  } catch (err) {
    console.error("Error resetting alumni password:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Admin endpoint: Run LinkedIn enrichment (SSE streaming output)
app.post("/api/admin/enrich", requireAdmin, (req, res) => {
  const { limit = 50, year } = req.body;

  // Build args for the Python script
  const scriptPath = path.join(__dirname, "enrich_linkedin.py");
  const args = [scriptPath, "--limit", String(Number(limit) || 50)];

  // SSE headers so the browser can stream log lines in real time
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (type, text) => {
    if (!res.destroyed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type, text })}\n\n`);
    }
  };

  send("info", `🚀 Starting enrichment — limit: ${limit}${year ? `, batch: ${year}` : ""}`);

  // If a specific year/batch is requested, we filter inside the script by
  // wrapping it: select only alumni for that year then call enrichment.
  // For simplicity we pass year as an env var the script can read, OR we just
  // pre-filter the DB and store the IDs in a temp table. Easiest approach:
  // patch the DB's linkedin_status for non-matching rows temporarily is risky,
  // so instead we expose year as ENRICH_YEAR env and the script reads it.
  // (We add that reading below via a wrapper approach)
  const env = {
    ...process.env,
    ENRICH_YEAR: year ? String(year) : "",
    PYTHONUNBUFFERED: "1",
    PYTHONUTF8: "1",
  };

  const py = spawn("python", ["-u", ...args], { env, cwd: __dirname });

  let stdoutBuffer = "";
  let stderrBuffer = "";
  const forwardLines = (type, chunk) => {
    const isError = type === "err";
    const buffer = (isError ? stderrBuffer : stdoutBuffer) + chunk.toString();
    const lines = buffer.split(/\r?\n/);
    const remainder = lines.pop();
    if (isError) stderrBuffer = remainder;
    else stdoutBuffer = remainder;
    lines.filter(Boolean).forEach((line) => send(type, line));
  };

  py.stdout.on("data", (chunk) => forwardLines("log", chunk));
  py.stderr.on("data", (chunk) => forwardLines("err", chunk));

  py.on("error", (err) => {
    send("err", `Failed to start Python: ${err.message}`);
  });

  py.on("close", (code, signal) => {
    if (stdoutBuffer) send("log", stdoutBuffer);
    if (stderrBuffer) send("err", stderrBuffer);

    if (code === 0) {
      send("done", "✅ Enrichment finished successfully (exit 0)");
    } else {
      const result = code === null ? `signal ${signal}` : `exit ${code}`;
      send("err", `Enrichment failed (${result})`);
    }
    if (!res.destroyed) res.end();
  });

  res.on("close", () => {
    if (!res.writableEnded && !py.killed) {
      py.kill();
    }
  });
});

const PORT = process.env.PORT || 4000;
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`AlmaTracc API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize PostgreSQL:", err);
    process.exitCode = 1;
  });
