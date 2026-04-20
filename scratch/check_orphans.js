// scratch/check_orphans.js
const { Client } = require('pg');
require('dotenv').config({ path: '.env.development' });

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: false
});

async function checkOrphans() {
  try {
    await client.connect();
    console.log('Connected to database');

    console.log('Checking for orphaned subscriptions...');
    const res = await client.query(`
      SELECT "userId" 
      FROM "subscriptions" 
      WHERE "userId" NOT IN (SELECT "id" FROM "users");
    `);

    console.log(`Found ${res.rowCount} orphaned subscriptions.`);
    res.rows.forEach(row => {
      console.log(`- Orphaned userId: ${row.userId}`);
    });

  } catch (err) {
    console.error('Error checking orphans:', err);
  } finally {
    await client.end();
  }
}

checkOrphans();
