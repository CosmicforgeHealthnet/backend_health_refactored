const fs = require('node:fs');
const path = require('node:path');
const AppDataSource = require('../src/config/database');

(async () => {
  try {
    await AppDataSource.initialize();
    const sql = fs.readFileSync(path.resolve(__dirname, '../fix-missing-columns.sql'), 'utf8');
    console.log('Applying fix-missing-columns.sql...');
    await AppDataSource.query(sql);
    console.log('OK. Re-checking users columns...');
    const rows = await AppDataSource.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' ORDER BY column_name;
    `);
    console.log('Current users columns:');
    rows.forEach(r => console.log(` - ${r.column_name}`));
    await AppDataSource.destroy();
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exit(1);
  }
})();
