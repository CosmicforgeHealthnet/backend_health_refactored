const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function reconstructConstellation() {
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
        console.log('--- RECONSTRUCTING CORRUPT CONSTELLATION ---');

        // 1. health_insurances_new
        console.log('Creating health_insurances_new...');
        await client.query(`
            CREATE TABLE health_insurances_new (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "providerName" varchar,
                "validityDate" date,
                "policyNo" varchar,
                "healthCardUrl" varchar,
                "patientProfileId" uuid,
                "createdAt" timestamp DEFAULT now(),
                CONSTRAINT FK_HI_PP FOREIGN KEY ("patientProfileId") REFERENCES patient_profiles_new(id) ON DELETE CASCADE
            )
        `);

        // 2. consents_new
        console.log('Creating consents_new...');
        await client.query(`
            CREATE TABLE consents_new (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                telemedicine boolean DEFAULT false,
                "dataCollection" boolean DEFAULT false,
                "recordSharing" boolean DEFAULT false,
                "emergencyContact" boolean DEFAULT false,
                "preferredCommunication" varchar,
                "languagePreference" varchar,
                "healthTips" boolean DEFAULT false,
                "familyAccess" boolean DEFAULT false,
                "notificationsAppointments" boolean DEFAULT false,
                "notificationsPrescriptions" boolean DEFAULT false,
                "notificationsTestResults" boolean DEFAULT false,
                "notificationsPromotions" boolean DEFAULT false,
                signature varchar,
                "patientProfileId" uuid,
                "createdAt" timestamp DEFAULT now(),
                CONSTRAINT FK_CO_PP FOREIGN KEY ("patientProfileId") REFERENCES patient_profiles_new(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ RECONSTRUCTION COMPLETE');

    } catch (err) {
        console.error('Operation failed:', err.message);
    } finally {
        await client.end();
    }
}

reconstructConstellation();
