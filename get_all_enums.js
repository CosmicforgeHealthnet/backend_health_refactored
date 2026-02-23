const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.production' });

async function getAllEnums() {
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

        // Find all enum types
        const res = await client.query(`
            SELECT t.typname, t.oid, e.enumlabel
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            ORDER BY t.typname, e.enumsortorder
        `);

        const enums = {};
        res.rows.forEach(row => {
            if (!enums[row.typname]) {
                enums[row.typname] = { oid: row.oid, labels: [] };
            }
            enums[row.typname].labels.push(row.enumlabel);
        });

        fs.writeFileSync('all_enums.json', JSON.stringify(enums, null, 2));
        console.log('All enums written to all_enums.json');

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

getAllEnums();
