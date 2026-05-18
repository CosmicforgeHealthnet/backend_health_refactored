require('dotenv').config({ path: '.env.development' });
const { Client } = require('pg');

console.log('Testing Database Connection (Retry)...');
// Construct URL (masking password for log)
const dbUrl = `postgres://${process.env.DB_USER}:****@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
console.log('Target:', dbUrl);

const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
    }
});

client.connect()
    .then(() => {
        console.log('✅ Connection Successful!');
        return client.query('SELECT NOW()');
    })
    .then(res => {
        console.log('Database Time:', res.rows[0].now);
        client.end();
    })
    .catch(err => {
        console.error('❌ Connection Failed Full Error:', err);
        if (err.message.includes('terminated')) {
            console.log('💡 HINT: This often happens if the IP is blocked or the database is paused (Render Free Tier).');
        }
        client.end();
    });
