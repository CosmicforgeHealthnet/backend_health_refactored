const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function checkRelLocks() {
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
        const res = await client.query(`
            SELECT
                locktype,
                relation::regclass,
                mode,
                granted,
                pid
            FROM pg_locks
            WHERE relation = 18450 OR relation = (SELECT oid FROM pg_class WHERE relname='pg_attribute');
        `);
        console.table(res.rows);

        const res2 = await client.query(`
            SELECT pid, query, state, wait_event_type, wait_event 
            FROM pg_stat_activity 
            WHERE pid IN (SELECT pid FROM pg_locks WHERE relation = 18450 OR relation = (SELECT oid FROM pg_class WHERE relname='pg_attribute'))
        `);
        console.table(res2.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkRelLocks();
