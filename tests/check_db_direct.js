
const { Client } = require('pg');
require('dotenv').config({ path: '.env.development' });

async function checkDb() {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

    try {
        await client.connect();
        console.log('✅ Connected to DB');
        const res = await client.query('SELECT current_database(), current_user');
        console.log('📊 DB Info:', res.rows[0]);

        const userRes = await client.query('SELECT count(*) FROM users');
        console.log('👤 User Count:', userRes.rows[0].count);

        const columns = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'pharmacyId'");
        console.log('📋 PharmacyId Column:', columns.rows[0]);

    } catch (err) {
        console.error('❌ DB Error:', err.message);
    } finally {
        await client.end();
    }
}

checkDb();
