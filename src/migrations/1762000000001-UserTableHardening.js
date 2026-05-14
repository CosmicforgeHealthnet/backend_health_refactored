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

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          "id",
          row_number() OVER (
            PARTITION BY "email"
            ORDER BY "createdAt" ASC NULLS LAST, "id" ASC
          ) AS rn
        FROM "users"
        WHERE "email" IS NOT NULL
      )
      UPDATE "users" u
      SET "email" = concat('duplicate+', replace(u."id"::text, '-', ''), '@cosmicforge.invalid')
      FROM ranked r
      WHERE u."id" = r."id"
        AND r.rn > 1
        AND u."email" IS DISTINCT FROM concat('duplicate+', replace(u."id"::text, '-', ''), '@cosmicforge.invalid')
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          "id",
          row_number() OVER (
            PARTITION BY "username"
            ORDER BY "createdAt" ASC NULLS LAST, "id" ASC
          ) AS rn
        FROM "users"
        WHERE "username" IS NOT NULL
      )
      UPDATE "users" u
      SET "username" = concat('user_', replace(u."id"::text, '-', ''))
      FROM ranked r
      WHERE u."id" = r."id"
        AND r.rn > 1
        AND u."username" IS DISTINCT FROM concat('user_', replace(u."id"::text, '-', ''))
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          "id",
          row_number() OVER (
            PARTITION BY "referralCode"
            ORDER BY "createdAt" ASC NULLS LAST, "id" ASC
          ) AS rn
        FROM "users"
        WHERE "referralCode" IS NOT NULL
      )
      UPDATE "users" u
      SET "referralCode" = concat('REF_', upper(replace(u."id"::text, '-', '')))
      FROM ranked r
      WHERE u."id" = r."id"
        AND r.rn > 1
        AND u."referralCode" IS DISTINCT FROM concat('REF_', upper(replace(u."id"::text, '-', '')))
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
