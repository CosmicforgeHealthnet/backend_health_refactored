const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class FeatureBaseline1900000000002 {
  name = "FeatureBaseline1900000000002";

  async up(queryRunner) {
    // 1. Safely Create Feature Enums
    await queryRunner.query(`
      DO $$
      BEGIN
        -- Appointments Enums
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointments_status_enum') THEN
          CREATE TYPE "public"."appointments_status_enum" AS ENUM('pending', 'scheduled', 'completed', 'cancelled', 'rescheduled');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointments_type_enum') THEN
          CREATE TYPE "public"."appointments_type_enum" AS ENUM('consultation', 'follow-up', 'routine-checkup', 'urgent');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointments_priority_enum') THEN
          CREATE TYPE "public"."appointments_priority_enum" AS ENUM('routine', 'urgent', 'high');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointments_meetingprovider_enum') THEN
          CREATE TYPE "public"."appointments_meetingprovider_enum" AS ENUM('google', 'zoom', 'jitsi');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointments_paymentstatus_enum') THEN
          CREATE TYPE "public"."appointments_paymentstatus_enum" AS ENUM('pending', 'completed', 'failed', 'refunded');
        END IF;

        -- Pharmacy Enums
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pharmacy_profiles_verificationstatus_enum') THEN
          CREATE TYPE "public"."pharmacy_profiles_verificationstatus_enum" AS ENUM('pending', 'documents_required', 'under_review', 'approved', 'rejected', 'suspended');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pharmacy_verification_requests_requesttype_enum') THEN
          CREATE TYPE "public"."pharmacy_verification_requests_requesttype_enum" AS ENUM('initial_verification', 're_verification', 'document_update');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pharmacy_verification_requests_status_enum') THEN
          CREATE TYPE "public"."pharmacy_verification_requests_status_enum" AS ENUM('pending', 'in_progress', 'approved', 'rejected', 'requires_changes');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pharmacy_verification_requests_priority_enum') THEN
          CREATE TYPE "public"."pharmacy_verification_requests_priority_enum" AS ENUM('low', 'medium', 'high', 'urgent');
        END IF;

        -- Prescriptions Enums
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prescriptions_availabilitystatus_enum') THEN
          CREATE TYPE "public"."prescriptions_availabilitystatus_enum" AS ENUM('pending', 'confirmed', 'unavailable', 'alternatives_proposed');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prescriptions_status_enum') THEN
          CREATE TYPE "public"."prescriptions_status_enum" AS ENUM('pending', 'patient_uploaded', 'pharmacy_assigned', 'pharmacy_processing', 'under_review', 'awaiting_payment', 'in_progress', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prescriptions_paymentmethod_enum') THEN
          CREATE TYPE "public"."prescriptions_paymentmethod_enum" AS ENUM('online', 'payOnPickup');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prescriptions_paymentstatus_enum') THEN
          CREATE TYPE "public"."prescriptions_paymentstatus_enum" AS ENUM('unpaid', 'paid', 'cancelled');
        END IF;

        -- Chatbot Enums
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chatbot_messages_messagetype_enum') THEN
          CREATE TYPE "public"."chatbot_messages_messagetype_enum" AS ENUM('user', 'bot');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chatbot_sessions_sessiontype_enum') THEN
          CREATE TYPE "public"."chatbot_sessions_sessiontype_enum" AS ENUM('general', 'doctor');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chatbot_sessions_usertype_enum') THEN
          CREATE TYPE "public"."chatbot_sessions_usertype_enum" AS ENUM('patient', 'doctor');
        END IF;
      END
      $$
    `);

    // 2. Create Feature Tables

    // APPOINTMENTS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "appointments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "patientId" uuid NOT NULL,
        "doctorId" uuid NOT NULL,
        "appointmentDate" date NOT NULL,
        "appointmentTime" time NOT NULL,
        "duration" integer NOT NULL DEFAULT 30,
        "endTime" time,
        "status" "public"."appointments_status_enum" NOT NULL DEFAULT 'pending',
        "type" "public"."appointments_type_enum" NOT NULL DEFAULT 'consultation',
        "priority" "public"."appointments_priority_enum" NOT NULL DEFAULT 'routine',
        "reason" text NOT NULL,
        "notes" text,
        "symptoms" jsonb,
        "meetingProvider" "public"."appointments_meetingprovider_enum",
        "meetingLink" character varying(500),
        "meetingId" character varying(255),
        "meetingPassword" character varying(255),
        "googleMeetCode" character varying(255),
        "zoomMeetingId" character varying(255),
        "hostKey" character varying(255),
        "consultationFee" numeric(10,2) NOT NULL,
        "consultationFeeCurrency" character varying(3) NOT NULL DEFAULT 'NGN',
        "paymentStatus" "public"."appointments_paymentstatus_enum" NOT NULL DEFAULT 'pending',
        "paymentId" character varying(255),
        "paymentMethod" character varying(100),
        "insuranceCovered" boolean NOT NULL DEFAULT false,
        "copay" numeric(10,2),
        "reminderSent" boolean NOT NULL DEFAULT false,
        "reminderSentAt" TIMESTAMP,
        "notificationPreferences" jsonb,
        "isFirstVisit" boolean NOT NULL DEFAULT true,
        "followUpRequired" boolean NOT NULL DEFAULT false,
        "followUpDate" date,
        "prescriptions" jsonb,
        "labOrdersRequired" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(255),
        "lastModifiedBy" character varying(255),
        "completedAt" TIMESTAMP,
        "cancelledAt" TIMESTAMP,
        "cancellationReason" text,
        "cancelledBy" character varying(255),
        "rescheduledAt" TIMESTAMP,
        "rescheduledBy" character varying(255),
        "rescheduleReason" text,
        "isDoctorApproved" boolean NOT NULL DEFAULT false,
        "isCancelled" boolean NOT NULL DEFAULT false,
        "appointmentTimeUTC" TIMESTAMP,
        "doctorTimezone" character varying(100),
        "patientTimezone" character varying(100),
        "doctorLocalTime" time,
        "patientLocalTime" time,
        "endTimeUTC" TIMESTAMP,
        CONSTRAINT "PK_appointments" PRIMARY KEY ("id")
      )
    `);

    // PHARMACY PROFILES
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pharmacy_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "pharmacyName" character varying NOT NULL,
        "registrationNumber" character varying NOT NULL,
        "address" text NOT NULL,
        "phone" character varying NOT NULL,
        "primaryContactPerson" character varying NOT NULL,
        "email" character varying NOT NULL,
        "preferredUsername" character varying NOT NULL,
        "logoUrl" character varying,
        "licenseNumber" character varying,
        "licenseExpiryDate" date,
        "operatingHours" json,
        "description" text,
        "website" character varying,
        "defaultCurrency" character varying(3) NOT NULL DEFAULT 'NGN',
        "serviceRadius" numeric(10,2) NOT NULL DEFAULT 0,
        "notificationPreferences" json,
        "verificationStatus" "public"."pharmacy_profiles_verificationstatus_enum" NOT NULL DEFAULT 'pending',
        "isActive" boolean NOT NULL DEFAULT false,
        "documentsSubmitted" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_pharmacy_profiles_registrationNumber" UNIQUE ("registrationNumber"),
        CONSTRAINT "UQ_pharmacy_profiles_preferredUsername" UNIQUE ("preferredUsername"),
        CONSTRAINT "UQ_pharmacy_profiles_licenseNumber" UNIQUE ("licenseNumber"),
        CONSTRAINT "PK_pharmacy_profiles" PRIMARY KEY ("id")
      )
    `);

    // PHARMACY BRANCHES
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pharmacy_branches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "pharmacyId" uuid NOT NULL,
        "managerId" uuid,
        "branchName" character varying NOT NULL,
        "address" text NOT NULL,
        "phone" character varying NOT NULL,
        "email" character varying,
        "licenseNumber" character varying NOT NULL,
        "operatingHours" json,
        "servicesOffered" json,
        "isMainBranch" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_pharmacy_branches_licenseNumber" UNIQUE ("licenseNumber"),
        CONSTRAINT "PK_pharmacy_branches" PRIMARY KEY ("id")
      )
    `);

    // PHARMACY VERIFICATION REQUESTS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pharmacy_verification_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "pharmacyId" uuid NOT NULL,
        "requestType" "public"."pharmacy_verification_requests_requesttype_enum" NOT NULL,
        "status" "public"."pharmacy_verification_requests_status_enum" NOT NULL DEFAULT 'pending',
        "priority" "public"."pharmacy_verification_requests_priority_enum" NOT NULL DEFAULT 'medium',
        "requestNotes" text,
        "rejectionReason" text,
        "assignedTo" uuid,
        "reviewedBy" uuid,
        "reviewNotes" text,
        "submittedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "assignedAt" TIMESTAMP,
        "reviewedAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pharmacy_verification_requests" PRIMARY KEY ("id")
      )
    `);

    // PRESCRIPTIONS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prescriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reference" character varying NOT NULL,
        "doctorId" uuid NOT NULL,
        "patientId" uuid NOT NULL,
        "pharmacyId" uuid,
        "consultationId" uuid,
        "medications" json NOT NULL,
        "diagnosis" text,
        "doctorSignature" text,
        "internalNotes" json DEFAULT '[]',
        "availabilityStatus" "public"."prescriptions_availabilitystatus_enum" NOT NULL DEFAULT 'pending',
        "status" "public"."prescriptions_status_enum" NOT NULL DEFAULT 'pending',
        "assignedPharmacistId" uuid,
        "fulfillmentHistory" json,
        "invoiceItems" json,
        "currency" character varying(3),
        "deliveryFee" numeric(10,2) DEFAULT 0,
        "totalDue" numeric(10,2),
        "paymentMethod" "public"."prescriptions_paymentmethod_enum",
        "paymentStatus" "public"."prescriptions_paymentstatus_enum" NOT NULL DEFAULT 'unpaid',
        "chatMessages" json,
        "doctorNotes" text,
        "pharmacyNotes" text,
        "patientNotes" text,
        "deliveryAddress" text,
        "deliveryInstructions" text,
        "expectedDeliveryDate" TIMESTAMP,
        "actualDeliveryDate" TIMESTAMP,
        "dispatchedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_prescriptions_reference" UNIQUE ("reference"),
        CONSTRAINT "PK_prescriptions" PRIMARY KEY ("id")
      )
    `);

    // CHATBOT SESSIONS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chatbot_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255),
        "sessionType" "public"."chatbot_sessions_sessiontype_enum" NOT NULL,
        "userId" uuid NOT NULL,
        "userType" "public"."chatbot_sessions_usertype_enum" NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "messageCount" integer NOT NULL DEFAULT 0,
        "lastActivityAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chatbot_sessions" PRIMARY KEY ("id")
      )
    `);

    // CHATBOT MESSAGES
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chatbot_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "content" text NOT NULL,
        "messageType" "public"."chatbot_messages_messagetype_enum" NOT NULL,
        "role" character varying(50) NOT NULL,
        "metadata" jsonb,
        "sessionId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "processingTime" integer,
        "tokenCount" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chatbot_messages" PRIMARY KEY ("id")
      )
    `);

    // 3. Initial Indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_APPOINTMENT_PATIENT" ON "appointments" ("patientId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_APPOINTMENT_DOCTOR" ON "appointments" ("doctorId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_APPOINTMENT_DATE" ON "appointments" ("appointmentDate")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_PHARMACY_PROFILE_USER" ON "pharmacy_profiles" ("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_PRESCRIPTION_REFERENCE" ON "prescriptions" ("reference")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_CHATBOT_SESSION_USER" ON "chatbot_sessions" ("userId")`);
  }

  async down(queryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "chatbot_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chatbot_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "prescriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pharmacy_verification_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pharmacy_branches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pharmacy_profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "appointments"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."chatbot_sessions_usertype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."chatbot_sessions_sessiontype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."chatbot_messages_messagetype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."prescriptions_paymentstatus_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."prescriptions_paymentmethod_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."prescriptions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."prescriptions_availabilitystatus_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."pharmacy_verification_requests_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."pharmacy_verification_requests_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."pharmacy_verification_requests_requesttype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."pharmacy_profiles_verificationstatus_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."appointments_paymentstatus_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."appointments_meetingprovider_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."appointments_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."appointments_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."appointments_status_enum"`);
  }
};
