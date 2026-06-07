const { Pool } = require('pg');
require('dotenv').config();

console.log("Testing DB Connection...");
console.log("URL defined:", !!process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query('SELECT * FROM plans');
    console.log("Success! Found plans:", res.rows.length);
    console.log("First plan:", res.rows[0]);
  } catch (err) {
    console.error("Database Error:", err.message);
    if (err.message.includes('relation "plans" does not exist')) {
        console.log("HINT: The 'plans' table is missing. Did you run schema.sql?");
    }
  } finally {
    await pool.end();
  }
}

test();
