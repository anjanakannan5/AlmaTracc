const { Pool } = require("pg");
const { promisify } = require("util");
const { randomBytes, scrypt, timingSafeEqual } = require("crypto");

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, saltHex, hashHex] = (storedHash || "").split("$");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (salt.length !== 16 || expected.length !== 64) return false;

  const actual = await scryptAsync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to connect to PostgreSQL.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const db = {
  prepare(sql) {
    let parameter = 0;
    const postgresSql = sql.replace(/\?/g, () => `$${++parameter}`);
    return {
      get: async (...params) => (await pool.query(postgresSql, params)).rows[0],
      all: async (...params) => (await pool.query(postgresSql, params)).rows,
      run: async (...params) => pool.query(postgresSql, params),
    };
  },
};

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alumni (
      id SERIAL PRIMARY KEY,
      roll_number TEXT UNIQUE NOT NULL,
      first_name TEXT,
      middle_name TEXT,
      last_name TEXT,
      gender TEXT,
      year_of_joining INTEGER,
      year_of_passing INTEGER,
      branch TEXT,
      email TEXT,
      phone TEXT,
      linkedin_url TEXT,
      linkedin_status TEXT DEFAULT 'missing',
      "current_role" TEXT,
      current_company TEXT,
      location TEXT,
      data_source TEXT,
      last_enriched_at TIMESTAMP,
      password TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS alumni_career_history (
      id SERIAL PRIMARY KEY,
      alumni_id INTEGER,
      role TEXT,
      company TEXT,
      location TEXT,
      source TEXT,
      fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      raw_response TEXT
    );
    ALTER TABLE alumni ADD COLUMN IF NOT EXISTS password TEXT;
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const { count } = (await pool.query("SELECT COUNT(*)::int AS count FROM admin_users")).rows[0];
  if (count === 0) {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD
      || (process.env.NODE_ENV === "production" ? "" : "admin123");
    if (!password) {
      throw new Error("Set ADMIN_PASSWORD before creating the first production admin account.");
    }
    await pool.query(
      `INSERT INTO admin_users (username, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (username) DO NOTHING`,
      [username, await hashPassword(password)]
    );
    console.log(`Created initial admin account '${username}'.`);
  }

  console.log("Connected to PostgreSQL and verified database schema.");
}

module.exports = { db, pool, initializeDatabase, hashPassword, verifyPassword };
