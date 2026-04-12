-- Safe migration: adds all missing columns to the users table
-- Run this directly in pgAdmin, DBeaver, or any SQL client
-- Every statement uses IF NOT EXISTS so it's safe to run multiple times

-- username (was causing the magic-link 500 error)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" VARCHAR UNIQUE DEFAULT NULL;

-- Profile / pharmacy fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bannerUrl" VARCHAR DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pharmacyId" UUID DEFAULT NULL;

-- Location
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "country" VARCHAR(100) DEFAULT NULL;

-- Contact
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phoneNumber" VARCHAR DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "departmentSpecialty" VARCHAR DEFAULT NULL;

-- Timezone
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(100) DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastDetectedTimezone" VARCHAR(100) DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezoneUpdatedAt" TIMESTAMP DEFAULT NULL;

-- Online status
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isOnline" BOOLEAN NOT NULL DEFAULT false;

-- Referral
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralCode" VARCHAR(50) UNIQUE DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totalReferrals" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referredBy" UUID DEFAULT NULL;

-- Ratings
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "averageRating" DECIMAL(2,1) NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totalRatings" INTEGER NOT NULL DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS "IDX_users_country"   ON "users" ("country");
CREATE INDEX IF NOT EXISTS "IDX_users_isOnline"  ON "users" ("isOnline");
CREATE INDEX IF NOT EXISTS "IDX_users_role"      ON "users" ("role");
CREATE INDEX IF NOT EXISTS "IDX_users_status"    ON "users" ("status");
CREATE INDEX IF NOT EXISTS "IDX_users_createdAt" ON "users" ("createdAt");
