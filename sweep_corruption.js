const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.production' });

async function sweepTables() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    const tables = [
        'patient_profiles',
        'medical_conditions',
        'surgeries',
        'allergies',
        'family_histories',
        'medications',
        'immunizations',
        'health_insurances',
        'disabilities',
        'consents',
        'appointments'
    ];

    const results = [];

    try {
        await client.connect();
        console.log('--- TABLE CORRUPTION SWEEP ---');

        for (const table of tables) {
            const tableResult = { table, status: 'OK', details: '' };
            try {
                const info = await client.query('SELECT oid, relnatts FROM pg_class WHERE relname = $1', [table]);
                if (info.rows.length === 0) {
                    tableResult.status = 'NOT_FOUND';
                    results.push(tableResult);
                    continue;
                }
                const oid = info.rows[0].oid;
                const relnatts = info.rows[0].relnatts;
                tableResult.oid = oid;
                tableResult.expected_atts = relnatts;

                const attrs = await client.query('SELECT count(*) FROM pg_attribute WHERE attrelid = $1 AND attnum > 0', [oid]);
                const actualCount = parseInt(attrs.rows[0].count);
                tableResult.actual_atts = actualCount;

                if (relnatts !== actualCount) {
                    tableResult.status = 'CORRUPT';
                    tableResult.details = `Catalog missing ${relnatts - actualCount} attributes`;
                } else {
                    try {
                        await client.query(`SELECT * FROM ${table} LIMIT 0`);
                        tableResult.status = 'OK';
                    } catch (e) {
                        tableResult.status = 'READ_ERROR';
                        tableResult.details = e.message;
                    }
                }
            } catch (err) {
                tableResult.status = 'ERROR';
                tableResult.details = err.message;
            }
            results.push(tableResult);
            console.log(`${table}: ${tableResult.status} ${tableResult.details || ''}`);
        }

        fs.writeFileSync('sweep_results.json', JSON.stringify(results, null, 2));

    } catch (err) {
        console.error('Fatal:', err.message);
    } finally {
        await client.end();
    }
}

sweepTables();
