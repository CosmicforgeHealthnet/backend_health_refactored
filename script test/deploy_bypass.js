const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function deployNamespaceBypass() {
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
        console.log('--- DEPLOYING NAMESPACE BYPASS ---');

        await client.query('CREATE SCHEMA IF NOT EXISTS cf_health');

        // 1. Patient Profiles
        console.log('Creating cf_health.patient_profiles...');
        await client.query(`
            CREATE TABLE cf_health.patient_profiles (
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

        // 2. Health Insurances
        console.log('Creating cf_health.health_insurances...');
        await client.query(`
            CREATE TABLE cf_health.health_insurances (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "providerName" varchar,
                "validityDate" date,
                "policyNo" varchar,
                "healthCardUrl" varchar,
                "patientProfileId" uuid,
                "createdAt" timestamp DEFAULT now()
            )
        `);

        // 3. Consents
        console.log('Creating cf_health.consents...');
        await client.query(`
            CREATE TABLE cf_health.consents (
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
                "createdAt" timestamp DEFAULT now()
            )
        `);

        // 4. Constraints
        console.log('Adding multi-schema constraints...');
        // Link HI to PP (both in new schema)
        await client.query('ALTER TABLE cf_health.health_insurances ADD CONSTRAINT FK_HI_PP FOREIGN KEY ("patientProfileId") REFERENCES cf_health.patient_profiles(id) ON DELETE CASCADE');
        // Link Consent to PP (both in new schema)
        await client.query('ALTER TABLE cf_health.consents ADD CONSTRAINT FK_CO_PP FOREIGN KEY ("patientProfileId") REFERENCES cf_health.patient_profiles(id) ON DELETE CASCADE');
        // Link PP to Users (new to old schema)
        await client.query('ALTER TABLE cf_health.patient_profiles ADD CONSTRAINT FK_user FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE');

        // 5. Global search_path update
        console.log(`Setting search_path for user ${process.env.DB_USER}...`);
        await client.query(`ALTER ROLE ${process.env.DB_USER} SET search_path TO cf_health, public`);

        console.log('✅ NAMESPACE BYPASS DEPLOYED SUCCESSFULLY');

    } catch (err) {
        console.error('Bypass Deployment Failed:', err.message);
    } finally {
        await client.end();
    }
}

deployNamespaceBypass();
