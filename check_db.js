const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log("Connecting to:", process.env.DATABASE_URL ? "URL defined" : "URL UNDEFINED");
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables found:", res.rows.map(r => r.table_name).join(', '));
    
    const sessionTable = res.rows.find(r => r.table_name === 'session');
    if (sessionTable) {
        console.log("SUCCESS: 'session' table exists.");
    } else {
        console.log("FAILURE: 'session' table is MISSING.");
    }
  } catch (err) {
    console.error("Error checking database:", err.message);
  } finally {
    await pool.end();
  }
}

check();
