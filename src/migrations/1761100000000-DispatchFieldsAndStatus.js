/**
 * Migration: DispatchFieldsAndStatus
 *
 * - Adds `out_for_delivery` to prescriptions_status_enum
 *   (replaces the old `ready_for_delivery` value which was renamed per dispatch spec)
 * - Adds `dispatchedAt` column to prescriptions table
 *   (nullable timestamp, set once when status → out_for_delivery, never overwritten)
 */
module.exports = class DispatchFieldsAndStatus1761100000000 {
  name = "DispatchFieldsAndStatus1761100000000";

  async up(queryRunner) {
    // Add new enum value (IF NOT EXISTS guard via DO block)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE prescriptions_status_enum ADD VALUE IF NOT EXISTS 'out_for_delivery';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add dispatchedAt column (idempotent)
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
        ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP;
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "dispatchedAt";
    `);
    // Note: PostgreSQL does not support DROP VALUE from an enum.
    // To fully revert, recreate the enum without out_for_delivery.
  }
};
