/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class Faqs1751653518201 {
    name = 'Faqs1751653518201'

    async up(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_0c1af27b469cb8dca420c160d6"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_13c2e57cb81b44f062ba24df57"`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'faqs_targetrole_enum') THEN CREATE TYPE "public"."faqs_targetrole_enum" AS ENUM('patient', 'doctor', 'general', 'all'); END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'faqs_status_enum') THEN CREATE TYPE "public"."faqs_status_enum" AS ENUM('draft', 'published', 'archived'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "faqs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(500) NOT NULL, "content" text NOT NULL, "slug" character varying(600) NOT NULL, "targetRole" "public"."faqs_targetrole_enum" NOT NULL DEFAULT 'general', "status" "public"."faqs_status_enum" NOT NULL DEFAULT 'draft', "isStatic" boolean NOT NULL DEFAULT false, "priority" integer NOT NULL DEFAULT '0', "viewCount" integer NOT NULL DEFAULT '0', "helpfulVotes" integer NOT NULL DEFAULT '0', "notHelpfulVotes" integer NOT NULL DEFAULT '0', "searchKeywords" text, "relatedLinks" jsonb, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "publishedAt" TIMESTAMP, "createdBy" uuid, "updatedBy" uuid, "categoryId" uuid, CONSTRAINT "UQ_8d36b9ca96f9c1f590431379f12" UNIQUE ("slug"), CONSTRAINT "PK_2ddf4f2c910f8e8fa2663a67bf0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_8d36b9ca96f9c1f590431379f1" ON "faqs" ("slug") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_827f313802faea681bd15c7817" ON "faqs" ("targetRole") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ec69ef8e48f54e2b8899131c86" ON "faqs" ("status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_7809bacb3493f6d80bcf26f412" ON "faqs" ("isStatic") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ae693878c4fc0f78238f11d7ea" ON "faqs" ("priority") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_c2f253ed34996b12cf17d261a0" ON "faqs" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_32f9825c80ee38dc4beb5d9b81" ON "faqs" ("publishedAt") `);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'faq_categories_targetrole_enum') THEN CREATE TYPE "public"."faq_categories_targetrole_enum" AS ENUM('patient', 'doctor', 'general', 'all'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "faq_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "slug" character varying(250) NOT NULL, "description" text, "icon" character varying(100), "color" character varying(50), "targetRole" "public"."faq_categories_targetrole_enum" NOT NULL DEFAULT 'general', "isActive" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_115c461144a448df2077e558412" UNIQUE ("slug"), CONSTRAINT "PK_c3a7f838a99baed5cbcbc5372db" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_115c461144a448df2077e55841" ON "faq_categories" ("slug") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_8c34adac00bcbbe53daf82523e" ON "faq_categories" ("targetRole") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_41fb4cb0a41ba49b17555a9aa0" ON "faq_categories" ("isActive") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_60a665bcd23f90bb671289a321" ON "faq_categories" ("sortOrder") `);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'faq_votes_votetype_enum') THEN CREATE TYPE "public"."faq_votes_votetype_enum" AS ENUM('helpful', 'not_helpful'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "faq_votes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "faqId" uuid NOT NULL, "userId" uuid, "voteType" "public"."faq_votes_votetype_enum" NOT NULL, "userRole" character varying(50), "ipAddress" character varying(45), "userAgent" text, "feedback" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a0c99323bba22486be5edf45083" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_49fbb79f24356992363e288e63" ON "faq_votes" ("faqId", "userId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ac8cc750d47a5fea0bcd6e3482" ON "faq_votes" ("voteType") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_58df1c6b7577b9264d530d6b87" ON "faq_votes" ("userRole") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_492d829f85fc7237a28bfa411d" ON "faq_votes" ("createdAt") `);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'faq_analytics_eventtype_enum') THEN CREATE TYPE "public"."faq_analytics_eventtype_enum" AS ENUM('view', 'search', 'vote', 'share'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "faq_analytics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eventType" "public"."faq_analytics_eventtype_enum" NOT NULL, "userRole" character varying(50), "searchQuery" character varying(500), "resultPosition" integer, "sessionId" character varying(100), "ipAddress" character varying(45), "userAgent" text, "referrer" character varying(500), "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "faqId" uuid, "userId" uuid, CONSTRAINT "PK_75f3ce5f3c94418e040ea330165" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_e9bc0a8cf1e90b0b41774c0e51" ON "faq_analytics" ("eventType") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_176620290175147533a0b66bd4" ON "faq_analytics" ("userRole") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_98a967d0ae1b9f493bd6e9736d" ON "faq_analytics" ("searchQuery") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_c8dca2130511a536f3b4197b60" ON "faq_analytics" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_f1613ba364ce83a0219458c557" ON "faq_analytics" ("sessionId") `);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "autoBillingEnabled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."autoBillingEnabled" IS 'Whether user has enabled auto-billing for this subscription'`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "preferredPaymentMethodId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."preferredPaymentMethodId" IS 'Payment method to use for auto-billing'`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "autoBillingFailureCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."autoBillingFailureCount" IS 'Number of consecutive auto-billing failures'`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "lastAutoBillingAttempt" TIMESTAMP`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."lastAutoBillingAttempt" IS 'When auto-billing was last attempted'`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "autoBillingGracePeriod" integer NOT NULL DEFAULT '7'`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."autoBillingGracePeriod" IS 'Days of grace period after failed auto-billing'`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "isAutoBilling" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions"."isAutoBilling" IS 'Whether this transaction was created via auto-billing'`);
        await queryRunner.query(`ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "canAutoCharge" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`COMMENT ON COLUMN "user_payment_methods"."canAutoCharge" IS 'Whether this payment method can be used for auto-billing'`);
        await queryRunner.query(`ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "tokenExpiryDate" TIMESTAMP`);
        await queryRunner.query(`COMMENT ON COLUMN "user_payment_methods"."tokenExpiryDate" IS 'When the payment provider token expires'`);
        await queryRunner.query(`ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "lastAutoBillingUse" TIMESTAMP`);
        await queryRunner.query(`COMMENT ON COLUMN "user_payment_methods"."lastAutoBillingUse" IS 'When this method was last used for auto-billing'`);
        await queryRunner.query(`ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "autoBillingSuccessCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "user_payment_methods"."autoBillingSuccessCount" IS 'Number of successful auto-billing charges'`);
        await queryRunner.query(`ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "autoBillingFailureCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "user_payment_methods"."autoBillingFailureCount" IS 'Number of failed auto-billing attempts'`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_fe8c81969cde9cf981451478b0e') THEN ALTER TABLE "faqs" ADD CONSTRAINT "FK_fe8c81969cde9cf981451478b0e" FOREIGN KEY ("categoryId") REFERENCES "faq_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_3f804d4844a34062b14e4666fd9') THEN ALTER TABLE "faqs" ADD CONSTRAINT "FK_3f804d4844a34062b14e4666fd9" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ec8d81aaf61b21ed1816f3a68fd') THEN ALTER TABLE "faqs" ADD CONSTRAINT "FK_ec8d81aaf61b21ed1816f3a68fd" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_fd449e14960320e8377e2cf8989') THEN ALTER TABLE "faq_votes" ADD CONSTRAINT "FK_fd449e14960320e8377e2cf8989" FOREIGN KEY ("faqId") REFERENCES "faqs"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_9883946e89376a3d67e40a9171b') THEN ALTER TABLE "faq_votes" ADD CONSTRAINT "FK_9883946e89376a3d67e40a9171b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_f559db0752d2b299520a959e804') THEN ALTER TABLE "faq_analytics" ADD CONSTRAINT "FK_f559db0752d2b299520a959e804" FOREIGN KEY ("faqId") REFERENCES "faqs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_1269cca22bd2d7a75b19e441cd8') THEN ALTER TABLE "faq_analytics" ADD CONSTRAINT "FK_1269cca22bd2d7a75b19e441cd8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "faq_analytics" DROP CONSTRAINT "FK_1269cca22bd2d7a75b19e441cd8"`);
        await queryRunner.query(`ALTER TABLE "faq_analytics" DROP CONSTRAINT "FK_f559db0752d2b299520a959e804"`);
        await queryRunner.query(`ALTER TABLE "faq_votes" DROP CONSTRAINT "FK_9883946e89376a3d67e40a9171b"`);
        await queryRunner.query(`ALTER TABLE "faq_votes" DROP CONSTRAINT "FK_fd449e14960320e8377e2cf8989"`);
        await queryRunner.query(`ALTER TABLE "faqs" DROP CONSTRAINT "FK_ec8d81aaf61b21ed1816f3a68fd"`);
        await queryRunner.query(`ALTER TABLE "faqs" DROP CONSTRAINT "FK_3f804d4844a34062b14e4666fd9"`);
        await queryRunner.query(`ALTER TABLE "faqs" DROP CONSTRAINT "FK_fe8c81969cde9cf981451478b0e"`);
        await queryRunner.query(`COMMENT ON COLUMN "user_payment_methods"."autoBillingFailureCount" IS 'Number of failed auto-billing attempts'`);
        await queryRunner.query(`ALTER TABLE "user_payment_methods" DROP COLUMN "autoBillingFailureCount"`);
        await queryRunner.query(`COMMENT ON COLUMN "user_payment_methods"."autoBillingSuccessCount" IS 'Number of successful auto-billing charges'`);
        await queryRunner.query(`ALTER TABLE "user_payment_methods" DROP COLUMN "autoBillingSuccessCount"`);
        await queryRunner.query(`COMMENT ON COLUMN "user_payment_methods"."lastAutoBillingUse" IS 'When this method was last used for auto-billing'`);
        await queryRunner.query(`ALTER TABLE "user_payment_methods" DROP COLUMN "lastAutoBillingUse"`);
        await queryRunner.query(`COMMENT ON COLUMN "user_payment_methods"."tokenExpiryDate" IS 'When the payment provider token expires'`);
        await queryRunner.query(`ALTER TABLE "user_payment_methods" DROP COLUMN "tokenExpiryDate"`);
        await queryRunner.query(`COMMENT ON COLUMN "user_payment_methods"."canAutoCharge" IS 'Whether this payment method can be used for auto-billing'`);
        await queryRunner.query(`ALTER TABLE "user_payment_methods" DROP COLUMN "canAutoCharge"`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions"."isAutoBilling" IS 'Whether this transaction was created via auto-billing'`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "isAutoBilling"`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."autoBillingGracePeriod" IS 'Days of grace period after failed auto-billing'`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "autoBillingGracePeriod"`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."lastAutoBillingAttempt" IS 'When auto-billing was last attempted'`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "lastAutoBillingAttempt"`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."autoBillingFailureCount" IS 'Number of consecutive auto-billing failures'`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "autoBillingFailureCount"`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."preferredPaymentMethodId" IS 'Payment method to use for auto-billing'`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "preferredPaymentMethodId"`);
        await queryRunner.query(`COMMENT ON COLUMN "subscriptions"."autoBillingEnabled" IS 'Whether user has enabled auto-billing for this subscription'`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "autoBillingEnabled"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f1613ba364ce83a0219458c557"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c8dca2130511a536f3b4197b60"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_98a967d0ae1b9f493bd6e9736d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_176620290175147533a0b66bd4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e9bc0a8cf1e90b0b41774c0e51"`);
        await queryRunner.query(`DROP TABLE "faq_analytics"`);
        await queryRunner.query(`DROP TYPE "public"."faq_analytics_eventtype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_492d829f85fc7237a28bfa411d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_58df1c6b7577b9264d530d6b87"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ac8cc750d47a5fea0bcd6e3482"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_49fbb79f24356992363e288e63"`);
        await queryRunner.query(`DROP TABLE "faq_votes"`);
        await queryRunner.query(`DROP TYPE "public"."faq_votes_votetype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_60a665bcd23f90bb671289a321"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_41fb4cb0a41ba49b17555a9aa0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8c34adac00bcbbe53daf82523e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_115c461144a448df2077e55841"`);
        await queryRunner.query(`DROP TABLE "faq_categories"`);
        await queryRunner.query(`DROP TYPE "public"."faq_categories_targetrole_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32f9825c80ee38dc4beb5d9b81"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c2f253ed34996b12cf17d261a0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ae693878c4fc0f78238f11d7ea"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7809bacb3493f6d80bcf26f412"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec69ef8e48f54e2b8899131c86"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_827f313802faea681bd15c7817"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8d36b9ca96f9c1f590431379f1"`);
        await queryRunner.query(`DROP TABLE "faqs"`);
        await queryRunner.query(`DROP TYPE "public"."faqs_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."faqs_targetrole_enum"`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_13c2e57cb81b44f062ba24df57" ON "appointments" ("patientId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_0c1af27b469cb8dca420c160d6" ON "appointments" ("doctorId") `);
    }
}
