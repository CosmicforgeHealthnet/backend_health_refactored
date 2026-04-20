const { Client } = require('pg');
const fs = require('node:fs');
require('dotenv').config({ path: '.env.production' });

async function getTypes() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    const results = {};

    try {
        await client.connect();

        const types = ['varchar', 'date', 'text', 'uuid'];
        const res = await client.query('SELECT typname, oid, typlen, typbyval, typalign, typstorage FROM pg_type WHERE typname = ANY($1)', [types]);
        results.standard = res.rows;

        // Check for the gender enum type
        const resEnum = await client.query("SELECT typname, oid, typlen, typbyval, typalign, typstorage FROM pg_type WHERE typname LIKE '%gender%' OR typname LIKE '%PatientProfile_gender_enum%'");
        results.enums = resEnum.rows;

    } catch (err) {
        results.error = err.message;
    } finally {
        await client.end();
        fs.writeFileSync('types.json', JSON.stringify(results, null, 2));
        console.log('Types written to types.json');
    }
}

getTypes();
