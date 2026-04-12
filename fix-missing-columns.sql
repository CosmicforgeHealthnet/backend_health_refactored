-- ============================================================
-- Safe migration: all missing columns across users,
-- transactions and user_payment_methods tables.
-- Safe to run multiple times (IF NOT EXISTS everywhere).
-- Run in pgAdmin / DBeaver connected to cosmicforge_clean
-- ============================================================

-- ── USERS ────────────────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username"              VARCHAR UNIQUE DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bannerUrl"             VARCHAR DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pharmacyId"            UUID DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "country"               VARCHAR(100) DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phoneNumber"           VARCHAR DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "departmentSpecialty"   VARCHAR DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone"              VARCHAR(100) DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastDetectedTimezone"  VARCHAR(100) DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezoneUpdatedAt"     TIMESTAMP DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isOnline"              BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralCode"          VARCHAR(50) UNIQUE DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totalReferrals"        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referredBy"            UUID DEFAULT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "averageRating"         DECIMAL(2,1) NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totalRatings"          INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "IDX_users_country"   ON "users" ("country");
CREATE INDEX IF NOT EXISTS "IDX_users_isOnline"  ON "users" ("isOnline");
CREATE INDEX IF NOT EXISTS "IDX_users_role"      ON "users" ("role");
CREATE INDEX IF NOT EXISTS "IDX_users_status"    ON "users" ("status");
CREATE INDEX IF NOT EXISTS "IDX_users_createdAt" ON "users" ("createdAt");

-- ── TRANSACTIONS ──────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "transactions_fundsstatus_enum"
    AS ENUM ('pending_appointment','pending_dispute','releasable','released');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "transactions_refundstatus_enum"
    AS ENUM ('none','pending','partial','full','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "appointmentDate"       TIMESTAMP DEFAULT NULL;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "disputeWindowStartsAt" TIMESTAMP DEFAULT NULL;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "fundsStatus"           "transactions_fundsstatus_enum" NOT NULL DEFAULT 'pending_appointment';
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "isCancelled"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "cancelledAt"           TIMESTAMP DEFAULT NULL;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "refundStatus"          "transactions_refundstatus_enum" NOT NULL DEFAULT 'none';
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "refundAmount"          DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "refundProcessedAt"     TIMESTAMP DEFAULT NULL;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "isAutoBilling"         BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "IDX_transactions_fundsStatus"    ON "transactions" ("fundsStatus");
CREATE INDEX IF NOT EXISTS "IDX_transactions_isCancelled"    ON "transactions" ("isCancelled");
CREATE INDEX IF NOT EXISTS "IDX_transactions_isAutoBilling"  ON "transactions" ("isAutoBilling");
CREATE INDEX IF NOT EXISTS "IDX_transactions_appointmentDate" ON "transactions" ("appointmentDate");

-- ── USER_PAYMENT_METHODS ──────────────────────────────────────
ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "canAutoCharge"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "tokenExpiryDate"         TIMESTAMP DEFAULT NULL;
ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "lastAutoBillingUse"      TIMESTAMP DEFAULT NULL;
ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "autoBillingSuccessCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "autoBillingFailureCount" INTEGER NOT NULL DEFAULT 0;
