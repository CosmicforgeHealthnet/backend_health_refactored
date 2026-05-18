/**
 * Migration: User Table Hardening
 * 
 * Ensures the 'users' table has all columns required by the User entity.
 * This is effectively a "sync" migration to fix cases where previous migrations 
 * were marked as applied but the columns were missing or dropped.
 */

module.exports = class UserTableHardening1762000000001 {
  name = "UserTableHardening1762000000001";

  async up(queryRunner) {
    await queryRunner.query(`SET LOCAL lock_timeout = '10s'`);

    // 1. Add missing Identity & Profile columns
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "username" character varying,
        ADD COLUMN IF NOT EXISTS "bannerUrl" character varying,
        ADD COLUMN IF NOT EXISTS "country" character varying(100),
        ADD COLUMN IF NOT EXISTS "pharmacyId" uuid,
        ADD COLUMN IF NOT EXISTS "departmentSpecialty" character varying,
        ADD COLUMN IF NOT EXISTS "provider" character varying DEFAULT 'local',
        ADD COLUMN IF NOT EXISTS "providerId" character varying,
        ADD COLUMN IF NOT EXISTS "profileImageUrl" character varying,
        ADD COLUMN IF NOT EXISTS "mfaEnabled" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "mfaSecret" character varying,
        ADD COLUMN IF NOT EXISTS "refreshTokenHash" character varying,
        ADD COLUMN IF NOT EXISTS "resetPasswordOTP" character varying,
        ADD COLUMN IF NOT EXISTS "resetPasswordOTPExpires" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "isOnline" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "referralCode" character varying(50),
        ADD COLUMN IF NOT EXISTS "totalReferrals" integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "referredBy" uuid,
        ADD COLUMN IF NOT EXISTS "timezone" character varying(100),
        ADD COLUMN IF NOT EXISTS "lastDetectedTimezone" character varying(100),
        ADD COLUMN IF NOT EXISTS "timezoneUpdatedAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "averageRating" numeric(2,1) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "totalRatings" integer DEFAULT 0
    `);

    // 2. Clean duplicate-prone identity fields before adding unique constraints.
    await queryRunner.query(`
      DO $$
      DECLARE
        item record;
      BEGIN
        FOR item IN
          SELECT c.conname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND t.relname = 'users'
            AND c.contype = 'u'
            AND (
              SELECT array_agg(a.attname ORDER BY x.ordinality)
              FROM unnest(c.conkey) WITH ORDINALITY AS x(attnum, ordinality)
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
            ) IN (
              ARRAY['email']::name[],
              ARRAY['username']::name[],
              ARRAY['referralCode']::name[]
            )
        LOOP
          EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT IF EXISTS %I', item.conname);
        END LOOP;

        FOR item IN
          SELECT i.relname
          FROM pg_index ix
          JOIN pg_class i ON i.oid = ix.indexrelid
          JOIN pg_class t ON t.oid = ix.indrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          LEFT JOIN pg_constraint c ON c.conindid = ix.indexrelid
          WHERE n.nspname = 'public'
            AND t.relname = 'users'
            AND ix.indisunique
            AND c.oid IS NULL
            AND (
              SELECT array_agg(a.attname ORDER BY x.ordinality)
              FROM unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ordinality)
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
            ) IN (
              ARRAY['email']::name[],
              ARRAY['username']::name[],
              ARRAY['referralCode']::name[]
            )
        LOOP
          EXECUTE format('DROP INDEX IF EXISTS public.%I', item.relname);
        END LOOP;
      END
      $$
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "email" = NULL
      WHERE "email" IS NOT NULL
        AND btrim("email") = ''
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "username" = NULL
      WHERE "username" IS NOT NULL
        AND btrim("username") = ''
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "referralCode" = NULL
      WHERE "referralCode" IS NOT NULL
        AND btrim("referralCode") = ''
    `);

    // Deduplicate one row at a time to avoid CTE multi-row update trigger conflicts
    await queryRunner.query(`
      DO $$
      DECLARE
        rec RECORD;
      BEGIN
        FOR rec IN
          SELECT DISTINCT ON ("email") "id" AS keep_id, "email"
          FROM "users"
          WHERE "email" IS NOT NULL AND "email" IN (
            SELECT "email" FROM "users" WHERE "email" IS NOT NULL GROUP BY "email" HAVING COUNT(*) > 1
          )
          ORDER BY "email", "createdAt" ASC NULLS LAST, "id" ASC
        LOOP
          UPDATE "users"
          SET "email" = concat('duplicate+', replace("id"::text, '-', ''), '@cosmicforge.invalid')
          WHERE "email" = rec."email"
            AND "id" != rec.keep_id
            AND "email" IS DISTINCT FROM concat('duplicate+', replace("id"::text, '-', ''), '@cosmicforge.invalid');
        END LOOP;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Email dedup skipped: %', SQLERRM;
      END
      $$
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        rec RECORD;
      BEGIN
        FOR rec IN
          SELECT DISTINCT ON ("username") "id" AS keep_id, "username"
          FROM "users"
          WHERE "username" IS NOT NULL AND "username" IN (
            SELECT "username" FROM "users" WHERE "username" IS NOT NULL GROUP BY "username" HAVING COUNT(*) > 1
          )
          ORDER BY "username", "createdAt" ASC NULLS LAST, "id" ASC
        LOOP
          UPDATE "users"
          SET "username" = concat('user_', replace("id"::text, '-', ''))
          WHERE "username" = rec."username"
            AND "id" != rec.keep_id
            AND "username" IS DISTINCT FROM concat('user_', replace("id"::text, '-', ''));
        END LOOP;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Username dedup skipped: %', SQLERRM;
      END
      $$
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        rec RECORD;
      BEGIN
        FOR rec IN
          SELECT DISTINCT ON ("referralCode") "id" AS keep_id, "referralCode"
          FROM "users"
          WHERE "referralCode" IS NOT NULL AND "referralCode" IN (
            SELECT "referralCode" FROM "users" WHERE "referralCode" IS NOT NULL GROUP BY "referralCode" HAVING COUNT(*) > 1
          )
          ORDER BY "referralCode", "createdAt" ASC NULLS LAST, "id" ASC
        LOOP
          UPDATE "users"
          SET "referralCode" = concat('REF_', upper(replace("id"::text, '-', '')))
          WHERE "referralCode" = rec."referralCode"
            AND "id" != rec.keep_id
            AND "referralCode" IS DISTINCT FROM concat('REF_', upper(replace("id"::text, '-', '')));
        END LOOP;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ReferralCode dedup skipped: %', SQLERRM;
      END
      $$
    `);

    // 3. Add Constraints & Comments
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND t.relname = 'users'
            AND c.contype = 'u'
            AND pg_get_constraintdef(c.oid) = 'UNIQUE (email)'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = 'users'
            AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
            AND indexdef LIKE '%(email)%'
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email");
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND t.relname = 'users'
            AND c.contype = 'u'
            AND pg_get_constraintdef(c.oid) = 'UNIQUE ("username")'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = 'users'
            AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
            AND indexdef LIKE '%("username")%'
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "UQ_users_username" UNIQUE ("username");
        END IF;
        
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND t.relname = 'users'
            AND c.contype = 'u'
            AND pg_get_constraintdef(c.oid) = 'UNIQUE ("referralCode")'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = 'users'
            AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
            AND indexdef LIKE '%("referralCode")%'
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "UQ_users_referralCode" UNIQUE ("referralCode");
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Add unique constraints skipped (duplicates may remain): %', SQLERRM;
      END
      $$
    `);

    // 4. Add Indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_username" ON "users" ("username")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_country" ON "users" ("country")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_pharmacyId" ON "users" ("pharmacyId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_referralCode" ON "users" ("referralCode")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_lastLoginAt" ON "users" ("lastLoginAt")`);
  }

  async down(queryRunner) {
    // We don't want a full revert of hardening columns as they might be needed by other features,
    // but we can remove the specific ones we added if explicitly asked.
    // For safety in this environment, down can be minimal or perform specific cleanup.
  }
};
