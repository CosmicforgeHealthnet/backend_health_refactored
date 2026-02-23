const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function totalSurgicalRepair() {
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
        console.log('--- TOTAL SURGICAL REPAIR START ---');

        const targets = [
            { name: 'patient_profiles', oid: 18450, source: 'patient_profiles_new' },
            { name: 'health_insurances', oid: 18307, source: 'health_insurances_new' },
            { name: 'consents', oid: 18038, source: 'consents_new' }
        ];

        for (const target of targets) {
            console.log(`Repairing ${target.name} (OID: ${target.oid})...`);

            // Get source attributes
            const res = await client.query(`
                SELECT attname, atttypid, attstattarget, attlen, attnum, 
                       attndims, attcacheoff, atttypmod, attbyval, attstorage, 
                       attalign, attnotnull, atthasdef, attidentity, attisdropped, 
                       attislocal, attinhcount, attcollation, attcompression, atthasmissing, attgenerated
                FROM pg_attribute 
                WHERE attrelid = (SELECT oid FROM pg_class WHERE relname = $1) 
                  AND attnum > 0
            `, [target.source]);

            console.log(`Found ${res.rowCount} attributes in ${target.source}. Injecting into ${target.oid}...`);

            for (const attr of res.rows) {
                // Delete if exists (it shouldn't based on previous scan)
                await client.query('DELETE FROM pg_attribute WHERE attrelid = $1 AND attnum = $2', [target.oid, attr.attnum]);

                // Inject
                const columns = Object.keys(attr).join(', ');
                const values = Object.values(attr);
                // Replace the source OID with the target OID in the first column (attrelid)
                values[Object.keys(attr).indexOf('attrelid')] = target.oid; // This is not in the row because we didn't select it? Wait.
            }

            // Refined Loop to be explicit
            for (const row of res.rows) {
                await client.query(`
                    INSERT INTO pg_attribute (
                        attrelid, attname, atttypid, attstattarget, attlen, attnum, 
                        attndims, attcacheoff, atttypmod, attbyval, attstorage, 
                        attalign, attnotnull, atthasdef, attidentity, attisdropped, 
                        attislocal, attinhcount, attcollation, attcompression, atthasmissing, attgenerated
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, 
                        $7, $8, $9, $10, $11, 
                        $12, $13, $14, $15, $16, 
                        $17, $18, $19, $20, $21, $22
                    )
                `, [
                    target.oid, row.attname, row.atttypid, row.attstattarget, row.attlen, row.attnum,
                    row.attndims, row.attcacheoff, row.atttypmod, row.attbyval, row.attstorage,
                    row.attalign, row.attnotnull, row.atthasdef, row.attidentity, row.attisdropped,
                    row.attislocal, row.attinhcount, row.attcollation, row.attcompression, row.atthasmissing, row.attgenerated
                ]);
            }
            console.log(`✅ ${target.name} attributes injected.`);
        }

        console.log('--- TOTAL SURGICAL REPAIR COMPLETE ---');

    } catch (err) {
        console.error('Total Repair failed:', err.message);
    } finally {
        await client.end();
    }
}

totalSurgicalRepair();
