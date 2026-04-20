const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class CoreBaseline1900000000001 {
  name = "CoreBaseline1900000000001";

  async up(queryRunner) {
    // 1. Ensure UUID extension exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // 2. Safely Create Core Enums
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_role_enum') THEN
          CREATE TYPE "public"."users_role_enum" AS ENUM('patient', 'doctor', 'admin', 'pharmacy_staff', 'pharmacy_owner', 'lab_admin', 'lab_staff', 'support');
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_status_enum') THEN
          CREATE TYPE "public"."users_status_enum" AS ENUM('pending_email_verification', 'active', 'pending_doctor_verification', 'doctor_active', 'pending_pharmacy_verification', 'pharmacy_active', 'locked');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_provider_enum') THEN
          CREATE TYPE "public"."users_provider_enum" AS ENUM('local', 'google');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_tier_enum') THEN
          CREATE TYPE "public"."users_tier_enum" AS ENUM('free', 'basic', 'standard', 'medium', 'premium', 'gold_elite', 'professional');
        END IF;
      END
      $$
    `);

    // 3. Create Foundational Tables
    
    // USERS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fullName" character varying NOT NULL,
        "email" character varying,
        "passwordHash" character varying,
        "username" character varying,
        "bannerUrl" character varying,
        "country" character varying(100),
        "pharmacyId" uuid,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'patient',
        "status" "public"."users_status_enum" NOT NULL DEFAULT 'pending_email_verification',
        "phoneNumber" character varying,
        "departmentSpecialty" character varying,
        "provider" "public"."users_provider_enum" NOT NULL DEFAULT 'local',
        "providerId" character varying,
        "profileImageUrl" character varying,
        "mfaEnabled" boolean NOT NULL DEFAULT false,
        "mfaSecret" character varying,
        "tier" "public"."users_tier_enum" NOT NULL DEFAULT 'free',
        "isOnline" boolean NOT NULL DEFAULT false,
        "referralCode" character varying(50),
        "totalReferrals" integer NOT NULL DEFAULT 0,
        "referredBy" uuid,
        "timezone" character varying(100),
        "lastDetectedTimezone" character varying(100),
        "timezoneUpdatedAt" TIMESTAMP,
        "averageRating" numeric(2,1) NOT NULL DEFAULT 0.0,
        "totalRatings" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_97672df962115ba6c0c13e31282" UNIQUE ("email"),
        CONSTRAINT "UQ_fe0bb3f651824069c123b281d18" UNIQUE ("username"),
        CONSTRAINT "UQ_referral_code" UNIQUE ("referralCode"),
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
      )
    `);

    // DOCTOR PROFILES
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "profilePhoto" character varying,
        "gender" character varying,
        "dateOfBirth" date,
        "nationality" character varying,
        "contactNumber" character varying,
        "residentialAddress" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_doctor_profiles_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_doctor_profiles" PRIMARY KEY ("id")
      )
    `);

    // PATIENT PROFILES
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "profilePhoto" character varying,
        "gender" character varying,
        "dateOfBirth" date,
        "genotype" character varying,
        "bloodGroup" character varying,
        "nationality" character varying,
        "language" character varying,
        "mobileNumber" character varying,
        "address" text,
        "emergencyContactFullName" character varying,
        "emergencyContactMobile" character varying,
        "emergencyContactRelationship" character varying,
        "height" double precision,
        "weight" double precision,
        "bmi" double precision,
        "bloodPressure" character varying,
        "heartRate" integer,
        "respiratoryRate" integer,
        "temperature" double precision,
        "spO2" integer,
        "bloodGlucose" double precision,
        "smokes" boolean NOT NULL DEFAULT false,
        "drinksAlcohol" boolean NOT NULL DEFAULT false,
        "physicalActivityLevel" character varying,
        "dietType" character varying,
        "sleepDuration" double precision,
        "profileType" character varying NOT NULL DEFAULT 'individual',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_patient_profiles_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_patient_profiles" PRIMARY KEY ("id")
      )
    `);

    // PROFESSIONAL LICENSES
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "professional_licenses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctorProfileId" uuid,
        "medicalLicenseNumber" character varying,
        "countryOfLicense" character varying,
        "licenseAuthority" character varying,
        "licenseExpiryDate" date,
        "licenseDocument" character varying,
        "yearsOfExperience" integer,
        "areasOfSpecialization" text[],
        "subspecialty" character varying,
        "medicalInstitution" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_professional_licenses_doctorProfileId" UNIQUE ("doctorProfileId"),
        CONSTRAINT "PK_professional_licenses" PRIMARY KEY ("id")
      )
    `);

    // PROFESSIONAL CERTIFICATES
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "professional_certificates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctorProfileId" uuid,
        "institution" character varying,
        "degree" character varying,
        "fieldOfStudy" character varying,
        "startYear" integer,
        "endYear" integer,
        "certificateName" character varying,
        "issuingBody" character varying,
        "issueDate" date,
        "expiryDate" date,
        "certificateDocument" character varying,
        "verificationLink" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_professional_certificates_doctorProfileId" UNIQUE ("doctorProfileId"),
        CONSTRAINT "PK_professional_certificates" PRIMARY KEY ("id")
      )
    `);

    // CLINICAL PRACTICES
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clinical_practices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctorProfileId" uuid,
        "clinicName" character varying,
        "location" character varying,
        "daysAvailableFrom" character varying,
        "daysAvailableTo" character varying,
        "timeAvailableFrom" time,
        "timeAvailableTo" time,
        "consultationFee" double precision,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_clinical_practices_doctorProfileId" UNIQUE ("doctorProfileId"),
        CONSTRAINT "PK_clinical_practices" PRIMARY KEY ("id")
      )
    `);

    // DIGITAL HEALTH TOOLS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "digital_health_tools" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctorProfileId" uuid,
        "consentToUseAITools" boolean,
        "usageDescription" text,
        "useARVR" boolean,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_digital_health_tools_doctorProfileId" UNIQUE ("doctorProfileId"),
        CONSTRAINT "PK_digital_health_tools" PRIMARY KEY ("id")
      )
    `);

    // 4. Initial Indexes (Basic)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_username" ON "users" ("username")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_role" ON "users" ("role")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_status" ON "users" ("status")`);
  }

  async down(queryRunner) {
    // Drop inverse of Up
    await queryRunner.query(`DROP TABLE IF EXISTS "digital_health_tools"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clinical_practices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "professional_certificates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "professional_licenses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    // Drop Enums
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_tier_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_provider_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
  }
};
