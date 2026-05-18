const { Client } = require('pg');
const fs = require('node:fs');
require('dotenv').config({ path: '.env.production' });

async function checkCatalogSchema() {
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
            SELECT column_name, is_nullable, column_default, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pg_attribute'
            ORDER BY ordinal_position
        `);
        fs.writeFileSync('catalog_schema.json', JSON.stringify(res.rows, null, 2));
        console.log('Schema written to catalog_schema.json');
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkCatalogSchema();
