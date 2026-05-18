const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function killAllSessions() {
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
        console.log('--- KILLING ALL SESSIONS ---');

        // Terminate all sessions except this one
        const res = await client.query(`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = $1 
              AND pid != pg_backend_pid()
        `, [process.env.DB_NAME]);

        console.log(`Terminated ${res.rowCount} sessions.`);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

killAllSessions();
