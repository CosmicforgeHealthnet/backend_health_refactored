const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function createNewTable() {
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
        console.log('--- CREATING NEW PATIENT_PROFILES_NEW TABLE ---');

        await client.query(`
            CREATE TABLE patient_profiles_new (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "userId" uuid UNIQUE,
                "profilePhoto" varchar,
                gender varchar,
                "dateOfBirth" date,
                genotype varchar,
                "bloodGroup" varchar,
                nationality varchar,
                language varchar,
                "mobileNumber" varchar,
                address text,
                "emergencyContactFullName" varchar,
                "emergencyContactMobile" varchar,
                "emergencyContactRelationship" varchar,
                height float,
                weight float,
                bmi float,
                "bloodPressure" varchar,
                "heartRate" integer,
                "respiratoryRate" integer,
                temperature float,
                "spO2" integer,
                "bloodGlucose" float,
                smokes boolean DEFAULT false,
                "drinksAlcohol" boolean DEFAULT false,
                "physicalActivityLevel" varchar,
                "dietType" varchar,
                "sleepDuration" float,
                "profileType" varchar DEFAULT 'individual',
                "createdAt" timestamp DEFAULT now(),
                "updatedAt" timestamp DEFAULT now()
            )
        `);

        console.log('✅ TABLE CREATED: patient_profiles_new');

        // Add foreign key if possible (user table exists)
        try {
            await client.query('ALTER TABLE patient_profiles_new ADD CONSTRAINT FK_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE');
            console.log('✅ FOREIGN KEY ADDED');
        } catch (e) {
            console.warn('⚠️ Could not add Foreign Key (might already exist or users table different):', e.message);
        }

    } catch (err) {
        console.error('Operation failed:', err.message);
    } finally {
        await client.end();
    }
}

createNewTable();
