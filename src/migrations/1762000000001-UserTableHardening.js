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
        ADD COLUMN IF NOT EXISTS "mfaEnabled" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "mfaSecret" character varying,
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

    // 2. Add Constraints & Comments
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_fe0bb3f6520ee0469504521e710') THEN
          ALTER TABLE "users" ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username");
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_user_referral_code') THEN
          ALTER TABLE "users" ADD CONSTRAINT "UQ_user_referral_code" UNIQUE ("referralCode");
        END IF;
      END
      $$
    `);

    // 3. Add Indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_username" ON "users" ("username")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_country" ON "users" ("country")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_pharmacyId" ON "users" ("pharmacyId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_referralCode" ON "users" ("referralCode")`);
  }

  async down(queryRunner) {
    // We don't want a full revert of hardening columns as they might be needed by other features,
    // but we can remove the specific ones we added if explicitly asked.
    // For safety in this environment, down can be minimal or perform specific cleanup.
  }
};
