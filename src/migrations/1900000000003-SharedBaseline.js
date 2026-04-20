const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class SharedBaseline1900000000003 {
  name = "SharedBaseline1900000000003";

  async up(queryRunner) {
    // 1. Safely Create Shared Enums
    await queryRunner.query(`
      DO $$
      BEGIN
        -- Referrals Enums
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_referrals_status_enum') THEN
          CREATE TYPE "public"."user_referrals_status_enum" AS ENUM('pending', 'verified', 'invalid');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_draws_status_enum') THEN
          CREATE TYPE "public"."referral_draws_status_enum" AS ENUM('pending', 'active', 'ended', 'cancelled');
        END IF;

        -- Support Enums
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_support_issuetype_enum') THEN
          CREATE TYPE "public"."account_support_issuetype_enum" AS ENUM('account_information_error', 'dependent_account_issue', 'unable_to_update_profile', 'deactivation_request', 'double_accounts_conflict');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_support_status_enum') THEN
          CREATE TYPE "public"."account_support_status_enum" AS ENUM('pending', 'in_progress', 'resolved', 'closed');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_support_priority_enum') THEN
          CREATE TYPE "public"."account_support_priority_enum" AS ENUM('low', 'medium', 'high', 'urgent');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_disputes_disputetype_enum') THEN
          CREATE TYPE "public"."support_disputes_disputetype_enum" AS ENUM('incorrect_billing', 'doctor_no_show', 'poor_service_quality', 'refund_request', 'transaction_issues');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_disputes_status_enum') THEN
          CREATE TYPE "public"."support_disputes_status_enum" AS ENUM('pending', 'under_review', 'resolved', 'closed');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_insurance_issuetype_enum') THEN
          CREATE TYPE "public"."support_insurance_issuetype_enum" AS ENUM('insurance_not_recognized', 'policy_details_incorrect', 'claim_status_delay', 'coverage_rejected', 'upload_document_error', 'wrong_billing');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_insurance_serviceaffected_enum') THEN
          CREATE TYPE "public"."support_insurance_serviceaffected_enum" AS ENUM('consultation', 'lab', 'pharmacy');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_insurance_status_enum') THEN
          CREATE TYPE "public"."support_insurance_status_enum" AS ENUM('pending', 'in_progress', 'resolved', 'closed');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_report_providertype_enum') THEN
          CREATE TYPE "public"."support_report_providertype_enum" AS ENUM('healthcare_provider', 'lab', 'pharmacy');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_report_issuetype_enum') THEN
          CREATE TYPE "public"."support_report_issuetype_enum" AS ENUM('unprofessional_behavior', 'harassment_verbal_abuse', 'medical_negligence', 'fraud_fake_profile', 'wrong_diagnosis', 'appointment_issues', 'prescription_error', 'privacy_violation', 'wrong_lab_result', 'lab_misconduct', 'pharmacy_misconduct');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_report_status_enum') THEN
          CREATE TYPE "public"."support_report_status_enum" AS ENUM('pending', 'under_review', 'resolved', 'closed');
        END IF;
      END
      $$
    `);

    // 2. Create Shared Tables

    // USER RATINGS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_ratings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "rating" numeric(2,1) NOT NULL,
        "message" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_ratings" PRIMARY KEY ("id")
      )
    `);

    // REFERRAL DRAWS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "referral_draws" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255) NOT NULL,
        "description" text,
        "startDate" TIMESTAMP NOT NULL,
        "endDate" TIMESTAMP NOT NULL,
        "status" "public"."referral_draws_status_enum" NOT NULL DEFAULT 'pending',
        "maxWinners" integer NOT NULL DEFAULT 10,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdBy" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_referral_draws" PRIMARY KEY ("id")
      )
    `);

    // USER REFERRALS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_referrals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "referrerId" uuid NOT NULL,
        "referredUserId" uuid,
        "referralCode" character varying(50) NOT NULL,
        "drawId" uuid,
        "status" "public"."user_referrals_status_enum" NOT NULL DEFAULT 'pending',
        "verifiedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_referrals" PRIMARY KEY ("id")
      )
    `);

    // ACCOUNT SUPPORT
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "account_support" (
        "id" SERIAL NOT NULL,
        "userId" integer,
        "issueType" "public"."account_support_issuetype_enum",
        "description" text,
        "screenshotUrl" character varying(500),
        "status" "public"."account_support_status_enum" NOT NULL DEFAULT 'pending',
        "priority" "public"."account_support_priority_enum" NOT NULL DEFAULT 'medium',
        "assignedTo" character varying(255),
        "resolutionNotes" text,
        "resolvedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_account_support" PRIMARY KEY ("id")
      )
    `);

    // SUPPORT DISPUTES
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "support_disputes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "transactionId" uuid,
        "disputeType" "public"."support_disputes_disputetype_enum",
        "description" text,
        "screenshotUrl" character varying(500),
        "status" "public"."support_disputes_status_enum" NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_support_disputes" PRIMARY KEY ("id")
      )
    `);

    // SUPPORT INSURANCE
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "support_insurance" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "issueType" "public"."support_insurance_issuetype_enum",
        "insuranceProviderName" character varying(255),
        "policyNumber" character varying(100),
        "serviceAffected" "public"."support_insurance_serviceaffected_enum",
        "description" text,
        "screenshotUrl" character varying(500),
        "status" "public"."support_insurance_status_enum" NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_support_insurance" PRIMARY KEY ("id")
      )
    `);

    // SUPPORT REPORT
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "support_report" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "providerId" uuid,
        "providerType" "public"."support_report_providertype_enum",
        "issueType" "public"."support_report_issuetype_enum",
        "description" text,
        "screenshotUrl" character varying(500),
        "status" "public"."support_report_status_enum" NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_support_report" PRIMARY KEY ("id")
      )
    `);

    // MARKETING SPIN REWARDS
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_spin_rewards" (
        "id" SERIAL NOT NULL,
        "type" character varying NOT NULL DEFAULT 'discount',
        "description" character varying,
        "weight" integer NOT NULL DEFAULT 1,
        "validityDays" integer NOT NULL DEFAULT 30,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketing_spin_rewards" PRIMARY KEY ("id")
      )
    `);

    // MARKETING USER SPIN HISTORY
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_user_spin_history" (
        "id" SERIAL NOT NULL,
        "userId" uuid NOT NULL,
        "rewardId" integer NOT NULL,
        "spinDate" TIMESTAMP NOT NULL DEFAULT now(),
        "expiryDate" TIMESTAMP NOT NULL,
        "isUsed" boolean NOT NULL DEFAULT false,
        "usedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketing_user_spin_history" PRIMARY KEY ("id")
      )
    `);

    // 3. Initial Indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_USER_RATINGS_USER" ON "user_ratings" ("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_USER_REFERRAL_CODE" ON "user_referrals" ("referralCode")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_REFERRAL_DRAW_STATUS" ON "referral_draws" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ACCOUNT_SUPPORT_USER" ON "account_support" ("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_DISPUTE_USER" ON "support_disputes" ("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_INSURANCE_USER" ON "support_insurance" ("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_REPORT_USER" ON "support_report" ("userId")`);
  }

  async down(queryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_user_spin_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_spin_rewards"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_report"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_insurance"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_disputes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "account_support"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_referrals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "referral_draws"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_ratings"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."support_report_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."support_report_issuetype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."support_report_providertype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."support_insurance_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."support_insurance_serviceaffected_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."support_insurance_issuetype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."support_disputes_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."support_disputes_disputetype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."account_support_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."account_support_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."account_support_issuetype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."referral_draws_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."user_referrals_status_enum"`);
  }
};
