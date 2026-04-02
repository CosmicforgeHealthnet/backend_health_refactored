const { Client } = require('pg');
const client = new Client({
  host: '72.61.20.94',
  port: 5432,
  user: 'postgres',
  password: 'wvlAZUDdnEdjpuxEVSZEJkYFwAYJhDEf',
  database: 'cosmicforge_backup1'
});

async function run() {
  await client.connect();
  const q = `DELETE FROM profile_options WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (partition BY "profileType", field, value ORDER BY id) AS rnum FROM profile_options) t WHERE t.rnum > 1)`;
  const res = await client.query(q);
  console.log(`Deleted ${res.rowCount} duplicate rows`);
  
  const check = await client.query('SELECT COUNT(*) FROM profile_options');
  console.log(`Remaining rows: ${check.rows[0].count}`);
  
  await client.end();
}
run().catch(console.error);
