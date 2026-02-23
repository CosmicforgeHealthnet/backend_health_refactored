const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.production' });

async function checkOid() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    const results = {
        meta: {
            database: process.env.DB_NAME,
            timestamp: new Date().toISOString()
        },
        partial_read: {},
    };

    try {
        await client.connect();

        // Try reading healthy columns only
        // Healthy column IDs: 1, 4, 5, 10-31
        try {
            const res = await client.query('SELECT id, genotype, "bloodGroup", height FROM patient_profiles LIMIT 5');
            results.partial_read.success = true;
            results.partial_read.count = res.rows.length;
            results.partial_read.sample = res.rows;
        } catch (e) {
            results.partial_read.success = false;
            results.partial_read.error = e.message;
        }

    } catch (err) {
        results.error = err.message;
    } finally {
        if (client) await client.end();
        fs.writeFileSync('results_v7.json', JSON.stringify(results, null, 2));
        console.log('Results written to results_v7.json');
    }
}

checkOid().catch(err => console.error('Unhandled error:', err));
