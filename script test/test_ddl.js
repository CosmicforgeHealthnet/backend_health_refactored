const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function testDDL() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        console.log('--- TESTING ALTER TABLE ---');
        await client.query('ALTER TABLE patient_profiles ADD COLUMN "test_recovery_col" varchar');
        console.log('✅ Success!');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

testDDL();
