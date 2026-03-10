/**
 * Migration: Fix Missing Pharmacy Columns & Tables
 *
 * Fixes identified schema gaps between entities and actual DB state:
 *
 * pharmacy_profiles (BOTH DBs):
 *   + defaultCurrency  varchar(3) NOT NULL DEFAULT 'NGN'
 *   + serviceRadius    decimal(10,2) NOT NULL DEFAULT 0
 *   + notificationPreferences json nullable
 *
 * prescriptions (BOTH DBs):
 *   + diagnosis         text nullable
 *   + doctorSignature   text nullable
 *   + internalNotes     json nullable DEFAULT '[]'
 *   + availabilityStatus enum NOT NULL DEFAULT 'pending'
 *   + currency          varchar(3) nullable
 *
 * pharmacy_pricing (PROD only — table completely missing in cosmicforge_v2):
 *   CREATE TABLE with all columns
 *
 * users (PROD only — pharmacyId column missing in cosmicforge_v2):
 *   + pharmacyId uuid nullable
 */

module.exports = class FixPharmacyMissingColumns1760500000000 {
  name = "FixPharmacyMissingColumns1760500000000";

  async up(queryRunner) {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. pharmacy_profiles — add missing operational columns
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "pharmacy_profiles"
        ADD COLUMN IF NOT EXISTS "defaultCurrency" character varying(3) NOT NULL DEFAULT 'NGN',
        ADD COLUMN IF NOT EXISTS "serviceRadius" numeric(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "notificationPreferences" json
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. prescriptions — add missing clinical / operational columns
    // ─────────────────────────────────────────────────────────────────────────

    // 2a. Create the enum type for availabilityStatus if it doesn't already exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'prescriptions_availabilitystatus_enum'
        ) THEN
          CREATE TYPE "public"."prescriptions_availabilitystatus_enum"
            AS ENUM('pending', 'confirmed', 'unavailable', 'alternatives_proposed');
        END IF;
      END
      $$
    `);

    // 2b. Add missing columns to prescriptions
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
        ADD COLUMN IF NOT EXISTS "diagnosis" text,
        ADD COLUMN IF NOT EXISTS "doctorSignature" text,
        ADD COLUMN IF NOT EXISTS "internalNotes" json DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "currency" character varying(3)
    `);

    // 2c. Add availabilityStatus — needs to be added separately because of the enum cast
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'prescriptions' AND column_name = 'availabilityStatus'
        ) THEN
          ALTER TABLE "prescriptions"
            ADD COLUMN IF NOT EXISTS "availabilityStatus"
              "public"."prescriptions_availabilitystatus_enum"
              NOT NULL DEFAULT 'pending';
        END IF;
      END
      $$
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. pharmacy_pricing — create table if it doesn't exist (PROD is missing it)
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'pharmacy_pricing_feetype_enum'
        ) THEN
          CREATE TYPE "public"."pharmacy_pricing_feetype_enum"
            AS ENUM('delivery', 'consultation', 'handling', 'processing');
        END IF;
      END
      $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pharmacy_pricing" (
        "id"          uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "pharmacyId"  uuid         NOT NULL,
        "feeType"     "public"."pharmacy_pricing_feetype_enum" NOT NULL,
        "price"       numeric(10,2) NOT NULL,
        "currency"    character varying(3) NOT NULL DEFAULT 'NGN',
        "isActive"    boolean      NOT NULL DEFAULT true,
        "createdAt"   TIMESTAMP    NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pharmacy_pricing" PRIMARY KEY ("id")
      )
    `);

    // FK: pharmacy_pricing -> pharmacy_profiles
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_pharmacy_pricing_pharmacyId'
            AND table_name = 'pharmacy_pricing'
        ) THEN
          ALTER TABLE "pharmacy_pricing"
            ADD CONSTRAINT "FK_pharmacy_pricing_pharmacyId"
            FOREIGN KEY ("pharmacyId")
            REFERENCES "pharmacy_profiles"("id")
            ON DELETE CASCADE;
        END IF;
      END
      $$
    `);

    // Indexes for pharmacy_pricing
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_pricing_pharmacyId" ON "pharmacy_pricing" ("pharmacyId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_pricing_feeType"    ON "pharmacy_pricing" ("feeType")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_pricing_isActive"   ON "pharmacy_pricing" ("isActive")`);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. users — add pharmacyId if it doesn't exist (missing in PROD)
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "pharmacyId" uuid
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_pharmacyId" ON "users" ("pharmacyId")`);
  }

  async down(queryRunner) {
    // Remove pharmacyId from users
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_pharmacyId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "pharmacyId"`);

    // Drop pharmacy_pricing table and its type
    await queryRunner.query(`DROP TABLE IF EXISTS "pharmacy_pricing"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."pharmacy_pricing_feetype_enum"`);

    // Remove added prescription columns
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
        DROP COLUMN IF EXISTS "diagnosis",
        DROP COLUMN IF EXISTS "doctorSignature",
        DROP COLUMN IF EXISTS "internalNotes",
        DROP COLUMN IF EXISTS "availabilityStatus",
        DROP COLUMN IF EXISTS "currency"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."prescriptions_availabilitystatus_enum"`);

    // Remove added pharmacy_profile columns
    await queryRunner.query(`
      ALTER TABLE "pharmacy_profiles"
        DROP COLUMN IF EXISTS "defaultCurrency",
        DROP COLUMN IF EXISTS "serviceRadius",
        DROP COLUMN IF EXISTS "notificationPreferences"
    `);
  }
};
