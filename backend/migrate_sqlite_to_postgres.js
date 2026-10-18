const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const { pool, initializeDatabase } = require("./database");

const sourcePath = path.resolve(process.argv[2] || path.join(__dirname, "almatracc.db"));
const alumniColumns = [
  "id", "roll_number", "first_name", "middle_name", "last_name", "gender",
  "year_of_joining", "year_of_passing", "branch", "email", "phone",
  "linkedin_url", "linkedin_status", "current_role", "current_company",
  "location", "data_source", "last_enriched_at", "password", "updated_at",
];
const historyColumns = [
  "id", "alumni_id", "role", "company", "location", "source", "fetched_at", "raw_response",
];

async function migrate() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`SQLite database not found: ${sourcePath}`);
  }

  await initializeDatabase();
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const alumni = source.prepare("SELECT * FROM alumni").all();
  const history = source.prepare("SELECT * FROM alumni_career_history").all();
  const client = await pool.connect();

  try {
    const existing = await client.query(
      "SELECT (SELECT COUNT(*) FROM alumni) AS alumni, (SELECT COUNT(*) FROM alumni_career_history) AS history"
    );
    if (Number(existing.rows[0].alumni) || Number(existing.rows[0].history)) {
      throw new Error("Target PostgreSQL tables are not empty. Migrate into an empty database to avoid mixing records.");
    }

    await client.query("BEGIN");
    for (const row of alumni) {
      const placeholders = alumniColumns.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(
        `INSERT INTO alumni (${alumniColumns.map((column) => column === "current_role" ? '"current_role"' : column).join(", ")}) VALUES (${placeholders})`,
        alumniColumns.map((column) => row[column])
      );
    }
    for (const row of history) {
      const placeholders = historyColumns.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(
        `INSERT INTO alumni_career_history (${historyColumns.join(", ")}) VALUES (${placeholders})`,
        historyColumns.map((column) => row[column])
      );
    }

    await client.query(`
      SELECT setval(pg_get_serial_sequence('alumni', 'id'),
                    COALESCE((SELECT MAX(id) FROM alumni), 1),
                    EXISTS (SELECT 1 FROM alumni))
    `);
    await client.query(`
      SELECT setval(pg_get_serial_sequence('alumni_career_history', 'id'),
                    COALESCE((SELECT MAX(id) FROM alumni_career_history), 1),
                    EXISTS (SELECT 1 FROM alumni_career_history))
    `);
    await client.query("COMMIT");
    console.log(`Migrated ${alumni.length} alumni and ${history.length} career-history records.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    source.close();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("SQLite to PostgreSQL migration failed:", err.message);
  process.exitCode = 1;
});
