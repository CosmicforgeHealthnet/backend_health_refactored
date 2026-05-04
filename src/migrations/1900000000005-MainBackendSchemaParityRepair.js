module.exports = class MainBackendSchemaParityRepair1900000000005 {
  name = "MainBackendSchemaParityRepair1900000000005";

  async up(queryRunner) {
    const run = (sql) => queryRunner.query(sql);
    const addColumnIfMissing = (table, column, definition) =>
      run(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${definition}`);
    const quoteEnum = (value) => `'${value.replace(/'/g, "''")}'`;
    const ensureEnum = async (typeName, values) => {
      await run(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typeName}') THEN
            CREATE TYPE "public"."${typeName}" AS ENUM(${values.map(quoteEnum).join(", ")});
          END IF;
        END
        $$
      `);

      for (const value of values) {
        await run(`ALTER TYPE "public"."${typeName}" ADD VALUE IF NOT EXISTS ${quoteEnum(value)}`);
      }
    };

    await run(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await run(`SET LOCAL lock_timeout = '10s'`);

    await this.repairChatSchema(run);
    await this.repairFaqSchema(run, ensureEnum);
    await this.repairSearchSchema(run, ensureEnum);
    await this.repairComplianceSchema(run);
    await this.repairColumnDrift(run, addColumnIfMissing);
  }

  async repairChatSchema(run) {
    await run(`
      CREATE TABLE IF NOT EXISTS "chat_file_attachments" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "filename" VARCHAR(255) NOT NULL,
        "originalName" VARCHAR(255) NOT NULL,
        "mimeType" VARCHAR(100) NOT NULL,
        "fileSize" BIGINT NOT NULL,
        "filePath" VARCHAR(500) NOT NULL,
        "fileUrl" VARCHAR(500),
        "thumbnailPath" VARCHAR(500),
        "messageId" UUID NOT NULL,
        "uploadedById" UUID NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_CHAT_FILE_MESSAGE" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_CHAT_FILE_UPLOADER" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_CHAT_FILE_MESSAGE" ON "chat_file_attachments" ("messageId")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_CHAT_FILE_UPLOADER" ON "chat_file_attachments" ("uploadedById")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_CHAT_FILE_MIME_TYPE" ON "chat_file_attachments" ("mimeType")`);

    await run(`
      CREATE TABLE IF NOT EXISTS "chat_message_reactions" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "emoji" VARCHAR(10) NOT NULL,
        "messageId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_Reaction_Message" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_Reaction_User" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_Message_Reaction_User_Emoji" UNIQUE ("messageId", "userId", "emoji")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_REACTION_MESSAGE" ON "chat_message_reactions" ("messageId")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_REACTION_USER" ON "chat_message_reactions" ("userId")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_REACTION_EMOJI" ON "chat_message_reactions" ("emoji")`);

    await run(`
      DO $$
      BEGIN
        IF to_regclass('public.chat_rooms') IS NOT NULL THEN
          ALTER TABLE "chat_rooms" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true;
          ALTER TABLE "chat_rooms" ADD COLUMN IF NOT EXISTS "isArchived" boolean NOT NULL DEFAULT false;
          ALTER TABLE "chat_rooms" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP;
          CREATE INDEX IF NOT EXISTS "IDX_CHAT_ROOM_ACTIVE" ON "chat_rooms" ("isActive");
          CREATE INDEX IF NOT EXISTS "IDX_CHAT_ROOM_ARCHIVED" ON "chat_rooms" ("isArchived");
        END IF;
      END
      $$
    `);
  }

  async repairFaqSchema(run, ensureEnum) {
    await ensureEnum("faqs_targetrole_enum", ["patient", "doctor", "general", "all"]);
    await ensureEnum("faqs_status_enum", ["draft", "published", "archived"]);
    await ensureEnum("faq_categories_targetrole_enum", ["patient", "doctor", "general", "all"]);
    await ensureEnum("faq_votes_votetype_enum", ["helpful", "not_helpful"]);
    await ensureEnum("faq_analytics_eventtype_enum", ["view", "search", "vote", "share"]);

    await run(`
      CREATE TABLE IF NOT EXISTS "faq_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "slug" character varying(250) NOT NULL,
        "description" text,
        "icon" character varying(100),
        "color" character varying(50),
        "targetRole" "public"."faq_categories_targetrole_enum" NOT NULL DEFAULT 'general',
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_115c461144a448df2077e558412" UNIQUE ("slug"),
        CONSTRAINT "PK_c3a7f838a99baed5cbcbc5372db" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_115c461144a448df2077e55841" ON "faq_categories" ("slug")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_8c34adac00bcbbe53daf82523e" ON "faq_categories" ("targetRole")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_41fb4cb0a41ba49b17555a9aa0" ON "faq_categories" ("isActive")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_60a665bcd23f90bb671289a321" ON "faq_categories" ("sortOrder")`);

    await run(`
      CREATE TABLE IF NOT EXISTS "faqs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(500) NOT NULL,
        "content" text NOT NULL,
        "slug" character varying(600) NOT NULL,
        "targetRole" "public"."faqs_targetrole_enum" NOT NULL DEFAULT 'general',
        "status" "public"."faqs_status_enum" NOT NULL DEFAULT 'draft',
        "isStatic" boolean NOT NULL DEFAULT false,
        "priority" integer NOT NULL DEFAULT 0,
        "viewCount" integer NOT NULL DEFAULT 0,
        "helpfulVotes" integer NOT NULL DEFAULT 0,
        "notHelpfulVotes" integer NOT NULL DEFAULT 0,
        "searchKeywords" text,
        "relatedLinks" jsonb,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "publishedAt" TIMESTAMP,
        "createdBy" uuid,
        "updatedBy" uuid,
        "categoryId" uuid,
        CONSTRAINT "UQ_8d36b9ca96f9c1f590431379f12" UNIQUE ("slug"),
        CONSTRAINT "PK_2ddf4f2c910f8e8fa2663a67bf0" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_8d36b9ca96f9c1f590431379f1" ON "faqs" ("slug")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_827f313802faea681bd15c7817" ON "faqs" ("targetRole")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_ec69ef8e48f54e2b8899131c86" ON "faqs" ("status")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_7809bacb3493f6d80bcf26f412" ON "faqs" ("isStatic")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_ae693878c4fc0f78238f11d7ea" ON "faqs" ("priority")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_c2f253ed34996b12cf17d261a0" ON "faqs" ("createdAt")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_32f9825c80ee38dc4beb5d9b81" ON "faqs" ("publishedAt")`);

    await run(`
      CREATE TABLE IF NOT EXISTS "faq_votes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "faqId" uuid NOT NULL,
        "userId" uuid,
        "voteType" "public"."faq_votes_votetype_enum" NOT NULL,
        "userRole" character varying(50),
        "ipAddress" character varying(45),
        "userAgent" text,
        "feedback" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_a0c99323bba22486be5edf45083" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_49fbb79f24356992363e288e63" ON "faq_votes" ("faqId", "userId")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_ac8cc750d47a5fea0bcd6e3482" ON "faq_votes" ("voteType")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_58df1c6b7577b9264d530d6b87" ON "faq_votes" ("userRole")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_492d829f85fc7237a28bfa411d" ON "faq_votes" ("createdAt")`);

    await run(`
      CREATE TABLE IF NOT EXISTS "faq_analytics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "eventType" "public"."faq_analytics_eventtype_enum" NOT NULL,
        "userRole" character varying(50),
        "searchQuery" character varying(500),
        "resultPosition" integer,
        "sessionId" character varying(100),
        "ipAddress" character varying(45),
        "userAgent" text,
        "referrer" character varying(500),
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "faqId" uuid,
        "userId" uuid,
        CONSTRAINT "PK_75f3ce5f3c94418e040ea330165" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_e9bc0a8cf1e90b0b41774c0e51" ON "faq_analytics" ("eventType")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_176620290175147533a0b66bd4" ON "faq_analytics" ("userRole")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_98a967d0ae1b9f493bd6e9736d" ON "faq_analytics" ("searchQuery")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_c8dca2130511a536f3b4197b60" ON "faq_analytics" ("createdAt")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_f1613ba364ce83a0219458c557" ON "faq_analytics" ("sessionId")`);

    await run(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_fe8c81969cde9cf981451478b0e') THEN
          ALTER TABLE "faqs" ADD CONSTRAINT "FK_fe8c81969cde9cf981451478b0e" FOREIGN KEY ("categoryId") REFERENCES "faq_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_3f804d4844a34062b14e4666fd9') THEN
          ALTER TABLE "faqs" ADD CONSTRAINT "FK_3f804d4844a34062b14e4666fd9" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ec8d81aaf61b21ed1816f3a68fd') THEN
          ALTER TABLE "faqs" ADD CONSTRAINT "FK_ec8d81aaf61b21ed1816f3a68fd" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_fd449e14960320e8377e2cf8989') THEN
          ALTER TABLE "faq_votes" ADD CONSTRAINT "FK_fd449e14960320e8377e2cf8989" FOREIGN KEY ("faqId") REFERENCES "faqs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_9883946e89376a3d67e40a9171b') THEN
          ALTER TABLE "faq_votes" ADD CONSTRAINT "FK_9883946e89376a3d67e40a9171b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_f559db0752d2b299520a959e804') THEN
          ALTER TABLE "faq_analytics" ADD CONSTRAINT "FK_f559db0752d2b299520a959e804" FOREIGN KEY ("faqId") REFERENCES "faqs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_1269cca22bd2d7a75b19e441cd8') THEN
          ALTER TABLE "faq_analytics" ADD CONSTRAINT "FK_1269cca22bd2d7a75b19e441cd8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$
    `);
  }

  async repairSearchSchema(run, ensureEnum) {
    await ensureEnum("search_logs_userrole_enum", [
      "patient",
      "doctor",
      "pharmacy",
      "pharmacist",
      "pharmacy_manager",
      "pharmacy_admin",
      "lab",
      "admin",
      "super_admin",
      "marketer",
    ]);

    await run(`
      CREATE TABLE IF NOT EXISTS "search_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "query" character varying(255) NOT NULL,
        "userRole" "public"."search_logs_userrole_enum" NOT NULL,
        "resultsCount" integer NOT NULL DEFAULT 0,
        "searchTime" integer,
        "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        "sessionFingerprint" character varying(64),
        CONSTRAINT "PK_a7de6b052b1a608961dc46e843d" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_b9ed845f64d320e335caee62d3" ON "search_logs" ("query")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_8185b39c539ce71478d7604bbd" ON "search_logs" ("userRole")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_bac4164acefd9d64d941eae63a" ON "search_logs" ("timestamp")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_a9792fc773a92f36302cb532fe" ON "search_logs" ("query", "userRole")`);
  }

  async repairComplianceSchema(run) {
    await run(`
      CREATE TABLE IF NOT EXISTS "data_lineage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source_id" uuid NOT NULL,
        "source_type" character varying NOT NULL,
        "source_location" character varying,
        "destination_id" uuid,
        "destination_type" character varying,
        "destination_location" character varying,
        "transformation_type" character varying NOT NULL,
        "transformation_rules" jsonb,
        "algorithm_used" character varying,
        "data_quality_score" integer,
        "quality_metrics" jsonb,
        "privacy_level" character varying,
        "anonymization_level" character varying,
        "privacy_budget_used" numeric(10,6),
        "transformed_by" uuid NOT NULL,
        "transformed_at" TIMESTAMP NOT NULL,
        "purpose_of_transformation" character varying NOT NULL,
        "compliance_checks" jsonb,
        "retention_policy" character varying,
        "metadata" jsonb,
        CONSTRAINT "PK_data_lineage" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_LINEAGE_SOURCE" ON "data_lineage" ("source_id", "source_type")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_LINEAGE_DESTINATION" ON "data_lineage" ("destination_id", "destination_type")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_LINEAGE_TRANSFORMATION" ON "data_lineage" ("transformation_type")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_LINEAGE_TRANSFORMED_AT" ON "data_lineage" ("transformed_at")`);
    await run(`CREATE INDEX IF NOT EXISTS "IDX_LINEAGE_PRIVACY" ON "data_lineage" ("privacy_level")`);
    await run(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_data_lineage_transformed_by') THEN
          ALTER TABLE "data_lineage" ADD CONSTRAINT "FK_data_lineage_transformed_by" FOREIGN KEY ("transformed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$
    `);
  }

  async repairColumnDrift(run, addColumnIfMissing) {
    await addColumnIfMissing("users", "refreshTokenHash", "character varying");
    await addColumnIfMissing("users", "resetPasswordOTP", "character varying");
    await addColumnIfMissing("users", "resetPasswordOTPExpires", "TIMESTAMP");
    await addColumnIfMissing("users", "mustChangePassword", "boolean NOT NULL DEFAULT false");
    await addColumnIfMissing("users", "passwordChangedAt", "TIMESTAMP");
    await addColumnIfMissing("users", "lastLoginAt", "TIMESTAMP");
    await run(`CREATE INDEX IF NOT EXISTS "IDX_users_lastLoginAt" ON "users" ("lastLoginAt")`);

    await run(`
      DO $$
      BEGIN
        IF to_regclass('public.profile_options') IS NOT NULL THEN
          ALTER TABLE "profile_options" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT now();
        END IF;
      END
      $$
    `);

    await run(`
      DO $$
      BEGIN
        IF to_regclass('public.patient_wallet_transactions') IS NOT NULL THEN
          ALTER TABLE "patient_wallet_transactions" ADD COLUMN IF NOT EXISTS "patientId" uuid;
          ALTER TABLE "patient_wallet_transactions" ADD COLUMN IF NOT EXISTS "balanceAfterUsd" DECIMAL(14,4);
          ALTER TABLE "patient_wallet_transactions" ADD COLUMN IF NOT EXISTS "invoiceId" uuid;
          ALTER TABLE "patient_wallet_transactions" ADD COLUMN IF NOT EXISTS "metadata" jsonb;

          UPDATE "patient_wallet_transactions" txn
          SET "patientId" = wallet."patientId"
          FROM "patient_wallets" wallet
          WHERE txn."walletId" = wallet."id"
            AND txn."patientId" IS NULL;

          UPDATE "patient_wallet_transactions"
          SET "balanceAfterUsd" = 0
          WHERE "balanceAfterUsd" IS NULL;

          ALTER TABLE "patient_wallet_transactions" ALTER COLUMN "balanceAfterUsd" SET DEFAULT 0;
          ALTER TABLE "patient_wallet_transactions" ALTER COLUMN "balanceAfterUsd" SET NOT NULL;

          IF NOT EXISTS (SELECT 1 FROM "patient_wallet_transactions" WHERE "patientId" IS NULL) THEN
            ALTER TABLE "patient_wallet_transactions" ALTER COLUMN "patientId" SET NOT NULL;
          END IF;

          CREATE INDEX IF NOT EXISTS "IDX_patient_wallet_transactions_patientId" ON "patient_wallet_transactions" ("patientId");
          CREATE INDEX IF NOT EXISTS "IDX_patient_wallet_transactions_invoiceId" ON "patient_wallet_transactions" ("invoiceId");
          CREATE INDEX IF NOT EXISTS "IDX_patient_wallet_transactions_category" ON "patient_wallet_transactions" ("category");
          CREATE INDEX IF NOT EXISTS "IDX_patient_wallet_transactions_createdAt" ON "patient_wallet_transactions" ("createdAt");
        END IF;
      END
      $$
    `);
  }

  async down() {
    // No-op by design. This migration is a production schema repair and should
    // not drop tables/columns that may already contain production data.
  }
};
