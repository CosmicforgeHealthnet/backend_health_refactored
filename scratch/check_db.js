// scratch/check_db.js
const { Client } = require('pg');
const config = require('../src/config/index');

async function checkDb() {
  const client = new Client({
    host: config.db.host,
    port: config.db.port,
    user: config.db.username,
    password: config.db.password,
    database: config.db.database,
    ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check columns of users table
    const columnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    console.log('Columns in "users" table:');
    columnsRes.rows.forEach(row => {
      console.log(` - ${row.column_name} (${row.data_type})`);
    });

    // Check migrations table
    const migrationsRes = await client.query('SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 10');
    console.log('\nLast 10 migrations:');
    migrationsRes.rows.forEach(row => {
      console.log(` - ${row.name} (${row.timestamp})`);
    });

  } catch (err) {
    console.error('Error checking DB:', err);
  } finally {
    await client.end();
  }
}

checkDb();
