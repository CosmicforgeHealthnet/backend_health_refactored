const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function purgeCorruptedCatalogs() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    const corruptedOids = [18450, 18307, 18038];

    try {
        await client.connect();
        console.log('--- SURGICAL CATALOG PURGE START ---');
        await client.query("SET statement_timeout = '60s'");

        for (const oid of corruptedOids) {
            console.log(`Purging OID ${oid}...`);

            // 1. Delete from pg_attribute
            const resAttr = await client.query('DELETE FROM pg_attribute WHERE attrelid = $1', [oid]);
            console.log(`- Deleted ${resAttr.rowCount} rows from pg_attribute`);

            // 2. Delete from pg_depend
            const resDep = await client.query('DELETE FROM pg_depend WHERE objid = $1 OR refobjid = $1', [oid]);
            console.log(`- Deleted ${resDep.rowCount} rows from pg_depend`);

            // 3. Delete from pg_type (tables have a row type)
            const resType = await client.query('DELETE FROM pg_type WHERE typrelid = $1', [oid]);
            console.log(`- Deleted ${resType.rowCount} rows from pg_type`);

            // 4. Delete from pg_class (The final blow)
            const resClass = await client.query('DELETE FROM pg_class WHERE oid = $1', [oid]);
            console.log(`- Deleted ${resClass.rowCount} rows from pg_class`);
        }

        console.log('--- PURGE COMPLETE ---');

    } catch (err) {
        console.error('Purge failed:', err.message);
    } finally {
        await client.end();
    }
}

purgeCorruptedCatalogs();
