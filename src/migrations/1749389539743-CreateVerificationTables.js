/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class CreateVerificationTables1749389539743 {
    name = 'CreateVerificationTables1749389539743'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."verification_requests_status_enum" AS ENUM('pending', 'in_progress', 'api_verification', 'manual_review', 'approved', 'rejected', 'expired')`);
        await queryRunner.query(`CREATE TYPE "public"."verification_requests_method_enum" AS ENUM('automated', 'manual', 'hybrid')`);
        await queryRunner.query(`CREATE TYPE "public"."verification_requests_tier_enum" AS ENUM('tier_1', 'tier_2', 'tier_3')`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "verification_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "doctorId" uuid NOT NULL, "licenseNumber" character varying NOT NULL, "countryCode" character varying(2) NOT NULL, "issuingAuthority" character varying NOT NULL, "licenseType" character varying, "issueDate" date, "expiryDate" date, "status" "public"."verification_requests_status_enum" NOT NULL DEFAULT 'pending', "method" "public"."verification_requests_method_enum", "tier" "public"."verification_requests_tier_enum", "confidenceScore" integer NOT NULL DEFAULT '0', "apiVerificationData" jsonb, "apiVerifiedAt" TIMESTAMP, "apiErrors" text, "assignedReviewerId" uuid, "reviewStartedAt" TIMESTAMP, "reviewCompletedAt" TIMESTAMP, "reviewNotes" text, "rejectionReason" text, "submittedAt" TIMESTAMP NOT NULL DEFAULT now(), "approvedAt" TIMESTAMP, "rejectedAt" TIMESTAMP, "expiresAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" uuid, "updatedBy" uuid, CONSTRAINT "PK_c5d405ea25e8abd5b0b096a4f6f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_verification_doctor_status" ON "verification_requests" ("doctorId", "status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_verification_country_status" ON "verification_requests" ("countryCode", "status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_verification_reviewer" ON "verification_requests" ("assignedReviewerId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_verification_created" ON "verification_requests" ("createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."verification_documents_documenttype_enum" AS ENUM('medical_license', 'medical_degree', 'board_certification', 'postgraduate_certificate', 'government_id', 'proof_of_practice', 'good_standing_certificate', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."verification_documents_status_enum" AS ENUM('uploaded', 'processing', 'verified', 'rejected', 'expired')`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "verification_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "verificationRequestId" uuid NOT NULL, "documentType" "public"."verification_documents_documenttype_enum" NOT NULL, "originalFileName" character varying NOT NULL, "storedFileName" character varying NOT NULL, "filePath" character varying NOT NULL, "fileSize" integer NOT NULL, "mimeType" character varying NOT NULL, "fileHash" character varying NOT NULL, "encryptionKey" character varying, "digitalSignature" text, "status" "public"."verification_documents_status_enum" NOT NULL DEFAULT 'uploaded', "ocrText" text, "extractedData" jsonb, "aiAnalysisResult" jsonb, "ocrConfidence" double precision, "verifiedBy" character varying, "verifiedAt" TIMESTAMP, "rejectionReason" text, "uploadedAt" TIMESTAMP NOT NULL DEFAULT now(), "uploadedBy" uuid NOT NULL, "lastAccessedAt" TIMESTAMP, "accessCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b4dc59d87f87ce5a1bb1d3fe0bf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_document_verification_type" ON "verification_documents" ("verificationRequestId", "documentType") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_document_status" ON "verification_documents" ("status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_document_hash" ON "verification_documents" ("fileHash") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_document_uploaded" ON "verification_documents" ("uploadedAt") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "verification_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "verificationRequestId" uuid NOT NULL, "fromStatus" character varying, "toStatus" character varying NOT NULL, "changedBy" uuid NOT NULL, "changeReason" text, "metadata" jsonb, "automatedChange" boolean NOT NULL DEFAULT false, "changedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f46a2ebf1b77443a0f3bd928ba0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_status_history_verification" ON "verification_status_history" ("verificationRequestId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_status_history_changed" ON "verification_status_history" ("changedAt") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_status_history_user" ON "verification_status_history" ("changedBy") `);
        await queryRunner.query(`CREATE TYPE "public"."verification_api_logs_provider_enum" AS ENUM('mdcn_nigeria', 'hpcsa_south_africa', 'kmpdc_kenya', 'mdc_ghana', 'ecfmg', 'surepass', 'idfy', 'custom')`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "verification_api_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "verificationRequestId" uuid NOT NULL, "provider" "public"."verification_api_logs_provider_enum" NOT NULL, "endpoint" character varying NOT NULL, "method" character varying NOT NULL DEFAULT 'POST', "requestPayload" jsonb, "responsePayload" jsonb, "responseCode" integer, "responseTime" integer, "success" boolean NOT NULL DEFAULT false, "errorMessage" text, "rateLimitRemaining" integer, "rateLimitReset" TIMESTAMP, "calledAt" TIMESTAMP NOT NULL DEFAULT now(), "calledBy" uuid, CONSTRAINT "PK_e715c7fb8eb84bfadcbec665358" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_api_log_verification" ON "verification_api_logs" ("verificationRequestId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_api_log_provider" ON "verification_api_logs" ("provider") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_api_log_called" ON "verification_api_logs" ("calledAt") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_api_log_success" ON "verification_api_logs" ("success") `);
        await queryRunner.query(`CREATE TYPE "public"."country_verification_configs_tier_enum" AS ENUM('tier_1', 'tier_2', 'tier_3')`);
        await queryRunner.query(`CREATE TYPE "public"."country_verification_configs_method_enum" AS ENUM('automated', 'manual', 'hybrid')`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "country_verification_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "countryCode" character varying(2) NOT NULL, "countryName" character varying NOT NULL, "regulatoryBody" character varying NOT NULL, "tier" "public"."country_verification_configs_tier_enum" NOT NULL, "method" "public"."country_verification_configs_method_enum" NOT NULL, "hasApi" boolean NOT NULL DEFAULT false, "apiProvider" character varying, "apiEndpoint" character varying, "apiKeyRequired" boolean NOT NULL DEFAULT false, "apiRateLimit" integer, "avgProcessingTime" integer, "maxProcessingTime" integer, "requiresManualReview" boolean NOT NULL DEFAULT true, "requiredDocuments" jsonb, "optionalDocuments" jsonb, "isActive" boolean NOT NULL DEFAULT true, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" uuid, "updatedBy" uuid, CONSTRAINT "UQ_aa203f99b962c59d6557f58183a" UNIQUE ("countryCode"), CONSTRAINT "PK_aecc21f0b988bc120c6944e24cd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_country_config_code" ON "country_verification_configs" ("countryCode") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_country_config_tier" ON "country_verification_configs" ("tier") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_country_config_active" ON "country_verification_configs" ("isActive") `);
        await queryRunner.query(`CREATE TYPE "public"."verification_review_queue_priority_enum" AS ENUM('low', 'normal', 'high', 'urgent')`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "verification_review_queue" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "verificationRequestId" uuid NOT NULL, "priority" "public"."verification_review_queue_priority_enum" NOT NULL DEFAULT 'normal', "assignedTo" uuid, "addedToQueueAt" TIMESTAMP NOT NULL DEFAULT now(), "assignedAt" TIMESTAMP, "reviewStartedAt" TIMESTAMP, "completedAt" TIMESTAMP, "slaTarget" TIMESTAMP, "slaBreached" boolean NOT NULL DEFAULT false, "escalated" boolean NOT NULL DEFAULT false, "escalatedAt" TIMESTAMP, "escalatedTo" uuid, "escalationReason" text, "queueNotes" text, "complexity" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_062790df7e7504ca392d94ca4f6" UNIQUE ("verificationRequestId"), CONSTRAINT "REL_062790df7e7504ca392d94ca4f" UNIQUE ("verificationRequestId"), CONSTRAINT "PK_658be367eb955ab9ab1526eca1a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_queue_assigned" ON "verification_review_queue" ("assignedTo") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_queue_priority" ON "verification_review_queue" ("priority") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_queue_sla" ON "verification_review_queue" ("slaTarget") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_queue_added" ON "verification_review_queue" ("addedToQueueAt") `);
        await queryRunner.query(`ALTER TABLE "verification_requests" ADD CONSTRAINT "FK_34402df7434d02ccfdd5e297812" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "verification_requests" ADD CONSTRAINT "FK_0a9afbc975b680f23f5ae8e03dc" FOREIGN KEY ("assignedReviewerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "verification_documents" ADD CONSTRAINT "FK_9015d4092e960a1d446fef46f99" FOREIGN KEY ("verificationRequestId") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "verification_documents" ADD CONSTRAINT "FK_c8151e02245f8235220cc0956cd" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "verification_status_history" ADD CONSTRAINT "FK_5b2648346151573b7410c0f0152" FOREIGN KEY ("verificationRequestId") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "verification_status_history" ADD CONSTRAINT "FK_7f3d0e1e990affda263a1d81f35" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "verification_api_logs" ADD CONSTRAINT "FK_de6c468c37ac3acdc3019603cd3" FOREIGN KEY ("verificationRequestId") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "verification_review_queue" ADD CONSTRAINT "FK_062790df7e7504ca392d94ca4f6" FOREIGN KEY ("verificationRequestId") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "verification_review_queue" ADD CONSTRAINT "FK_df9b20576de1c20de1e31bf3c7b" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "verification_review_queue" ADD CONSTRAINT "FK_6aadc5f7b41ebd780c00dd8fcdb" FOREIGN KEY ("escalatedTo") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "verification_review_queue" DROP CONSTRAINT "FK_6aadc5f7b41ebd780c00dd8fcdb"`);
        await queryRunner.query(`ALTER TABLE "verification_review_queue" DROP CONSTRAINT "FK_df9b20576de1c20de1e31bf3c7b"`);
        await queryRunner.query(`ALTER TABLE "verification_review_queue" DROP CONSTRAINT "FK_062790df7e7504ca392d94ca4f6"`);
        await queryRunner.query(`ALTER TABLE "verification_api_logs" DROP CONSTRAINT "FK_de6c468c37ac3acdc3019603cd3"`);
        await queryRunner.query(`ALTER TABLE "verification_status_history" DROP CONSTRAINT "FK_7f3d0e1e990affda263a1d81f35"`);
        await queryRunner.query(`ALTER TABLE "verification_status_history" DROP CONSTRAINT "FK_5b2648346151573b7410c0f0152"`);
        await queryRunner.query(`ALTER TABLE "verification_documents" DROP CONSTRAINT "FK_c8151e02245f8235220cc0956cd"`);
        await queryRunner.query(`ALTER TABLE "verification_documents" DROP CONSTRAINT "FK_9015d4092e960a1d446fef46f99"`);
        await queryRunner.query(`ALTER TABLE "verification_requests" DROP CONSTRAINT "FK_0a9afbc975b680f23f5ae8e03dc"`);
        await queryRunner.query(`ALTER TABLE "verification_requests" DROP CONSTRAINT "FK_34402df7434d02ccfdd5e297812"`);
        await queryRunner.query(`DROP INDEX "public"."idx_queue_added"`);
        await queryRunner.query(`DROP INDEX "public"."idx_queue_sla"`);
        await queryRunner.query(`DROP INDEX "public"."idx_queue_priority"`);
        await queryRunner.query(`DROP INDEX "public"."idx_queue_assigned"`);
        await queryRunner.query(`DROP TABLE "verification_review_queue"`);
        await queryRunner.query(`DROP TYPE "public"."verification_review_queue_priority_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_country_config_active"`);
        await queryRunner.query(`DROP INDEX "public"."idx_country_config_tier"`);
        await queryRunner.query(`DROP INDEX "public"."idx_country_config_code"`);
        await queryRunner.query(`DROP TABLE "country_verification_configs"`);
        await queryRunner.query(`DROP TYPE "public"."country_verification_configs_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."country_verification_configs_tier_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_api_log_success"`);
        await queryRunner.query(`DROP INDEX "public"."idx_api_log_called"`);
        await queryRunner.query(`DROP INDEX "public"."idx_api_log_provider"`);
        await queryRunner.query(`DROP INDEX "public"."idx_api_log_verification"`);
        await queryRunner.query(`DROP TABLE "verification_api_logs"`);
        await queryRunner.query(`DROP TYPE "public"."verification_api_logs_provider_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_status_history_user"`);
        await queryRunner.query(`DROP INDEX "public"."idx_status_history_changed"`);
        await queryRunner.query(`DROP INDEX "public"."idx_status_history_verification"`);
        await queryRunner.query(`DROP TABLE "verification_status_history"`);
        await queryRunner.query(`DROP INDEX "public"."idx_document_uploaded"`);
        await queryRunner.query(`DROP INDEX "public"."idx_document_hash"`);
        await queryRunner.query(`DROP INDEX "public"."idx_document_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_document_verification_type"`);
        await queryRunner.query(`DROP TABLE "verification_documents"`);
        await queryRunner.query(`DROP TYPE "public"."verification_documents_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."verification_documents_documenttype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_verification_created"`);
        await queryRunner.query(`DROP INDEX "public"."idx_verification_reviewer"`);
        await queryRunner.query(`DROP INDEX "public"."idx_verification_country_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_verification_doctor_status"`);
        await queryRunner.query(`DROP TABLE "verification_requests"`);
        await queryRunner.query(`DROP TYPE "public"."verification_requests_tier_enum"`);
        await queryRunner.query(`DROP TYPE "public"."verification_requests_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."verification_requests_status_enum"`);
    }
}
