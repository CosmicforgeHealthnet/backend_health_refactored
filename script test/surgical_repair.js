const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function surgicalRepair() {
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
        const oid = 18450;
        console.log('--- SURGICAL REPAIR START ---');
        await client.query("SET statement_timeout = '30s'");

        // typnames: varchar(1043), date(1082), text(25)
        const missingAttributes = [
            { num: 2, name: 'gender', type: 1043, len: -1, byval: false, storage: 'x', align: 'i' },
            { num: 3, name: 'dateOfBirth', type: 1082, len: 4, byval: true, storage: 'p', align: 'i' },
            { num: 6, name: 'nationality', type: 1043, len: -1, byval: false, storage: 'x', align: 'i' },
            { num: 7, name: 'language', type: 1043, len: -1, byval: false, storage: 'x', align: 'i' },
            { num: 8, name: 'mobileNumber', type: 1043, len: -1, byval: false, storage: 'x', align: 'i' },
            { num: 9, name: 'address', type: 25, len: -1, byval: false, storage: 'x', align: 'i' }
        ];

        for (const attr of missingAttributes) {
            console.log(`Cleaning and Injecting attribute ${attr.num}: ${attr.name}...`);
            await client.query('DELETE FROM pg_attribute WHERE attrelid = $1 AND attnum = $2', [oid, attr.num]);

            await client.query(`
                INSERT INTO pg_attribute (
                    attrelid, attname, atttypid, attstattarget, attlen, attnum, 
                    attndims, attcacheoff, atttypmod, attbyval, attstorage, 
                    attalign, attnotnull, atthasdef, attidentity, attisdropped, 
                    attislocal, attinhcount, attcollation, attcompression, atthasmissing, attgenerated
                ) VALUES (
                    $1, $2, $3, -1, $4, $5, 
                    0, -1, -1, $6, $7, 
                    $8, false, false, '', false, 
                    true, 0, 0, '', false, ''
                )
            `, [oid, attr.name, attr.type, attr.len, attr.num, attr.byval, attr.storage, attr.align]);
            console.log(`Attribute ${attr.num} injected.`);
        }

        console.log('--- SURGICAL REPAIR COMPLETE ---');

    } catch (err) {
        console.error('Repair failed:', err.message);
        if (err.detail) console.error('Detail:', err.detail);
    } finally {
        await client.end();
    }
}

surgicalRepair();
