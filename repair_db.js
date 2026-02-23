const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function repair() {
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

        console.log('--- DB REPAIR START (DIRECT) ---');
        console.log(`Target: ${process.env.DB_NAME}`);

        // Effort: VACUUM FULL patient_profiles
        // This command rebuilds the table and catalog mapping.
        console.log('Attempting VACUUM FULL patient_profiles...');
        await client.query('VACUUM FULL patient_profiles');
        console.log('✅ VACUUM FULL completed successfully.');

    } catch (err) {
        console.error('\n!!! REPAIR ERROR !!!');
        console.error(err.message);
        if (err.detail) console.error('Detail:', err.detail);
        if (err.hint) console.error('Hint:', err.hint);
    } finally {
        await client.end();
        console.log('--- DB REPAIR END ---');
    }
}

repair().catch(err => console.error('Unhandled error:', err));
