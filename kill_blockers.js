const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function killSpecificBlockers() {
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
        console.log('--- KILLING SPECIFIC BLOCKERS ---');

        const pids = [333443, 333446, 333458, 333452, 333498, 333569];

        for (const pid of pids) {
            console.log(`Terminating PID ${pid}...`);
            const killRes = await client.query('SELECT pg_terminate_backend($1)', [pid]);
            console.log(`PID ${pid} result: ${killRes.rows[0].pg_terminate_backend}`);
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

killSpecificBlockers();
