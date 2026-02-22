const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function getEnums() {
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
            SELECT t.typname, t.oid, e.enumlabel
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE e.enumlabel ILIKE 'male%' OR e.enumlabel ILIKE 'female%'
        `);
        console.table(res.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

getEnums();
