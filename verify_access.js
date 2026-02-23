const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function verifyAccess() {
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

        console.log('--- VERIFYING ACCESS (relnatts=25) ---');

        const resCount = await client.query('SELECT count(*) FROM patient_profiles');
        console.log('Row count:', resCount.rows[0].count);

        const resSample = await client.query('SELECT id, "createdAt" FROM patient_profiles LIMIT 5');
        console.log('Sample data:', resSample.rows);

    } catch (err) {
        console.error('Verification failed:', err.message);
        if (err.detail) console.error('Detail:', err.detail);
    } finally {
        await client.end();
    }
}

verifyAccess();
