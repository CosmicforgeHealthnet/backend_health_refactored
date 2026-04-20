/**
 * Safe migration: adds all missing columns to transactions and
 * user_payment_methods tables. Uses IF NOT EXISTS — idempotent.
 */
module.exports = class AddMissingTransactionAndPaymentColumns1762000000001 {
  name = 'AddMissingTransactionAndPaymentColumns1762000000001';

  async up(queryRunner) {
    // ── transactions ──────────────────────────────────────────────────────

    // fundsStatus enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "transactions_fundsstatus_enum"
          AS ENUM ('pending_appointment','pending_dispute','releasable','released');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // refundStatus enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "transactions_refundstatus_enum"
          AS ENUM ('none','pending','partial','full','failed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "appointmentDate"      TIMESTAMP DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "disputeWindowStartsAt" TIMESTAMP DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "fundsStatus"
      "transactions_fundsstatus_enum" NOT NULL DEFAULT 'pending_appointment'`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "isCancelled"          BOOLEAN NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "cancelledAt"          TIMESTAMP DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "refundStatus"
      "transactions_refundstatus_enum" NOT NULL DEFAULT 'none'`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "refundAmount"         DECIMAL(10,2) DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "refundProcessedAt"    TIMESTAMP DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "isAutoBilling"        BOOLEAN NOT NULL DEFAULT false`);

    // ── user_payment_methods ──────────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "canAutoCharge"           BOOLEAN NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "tokenExpiryDate"         TIMESTAMP DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "lastAutoBillingUse"      TIMESTAMP DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "autoBillingSuccessCount" INTEGER NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "user_payment_methods" ADD COLUMN IF NOT EXISTS "autoBillingFailureCount" INTEGER NOT NULL DEFAULT 0`);

    // ── Useful indexes ────────────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transactions_fundsStatus"   ON "transactions" ("fundsStatus")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transactions_isCancelled"   ON "transactions" ("isCancelled")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transactions_isAutoBilling" ON "transactions" ("isAutoBilling")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transactions_appointmentDate" ON "transactions" ("appointmentDate")`);
  }

  async down(queryRunner) {
    const txCols = [
      'appointmentDate','disputeWindowStartsAt','fundsStatus',
      'isCancelled','cancelledAt','refundStatus','refundAmount',
      'refundProcessedAt','isAutoBilling'
    ];
    for (const col of txCols) {
      await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "${col}"`);
    }

    const pmCols = [
      'canAutoCharge','tokenExpiryDate','lastAutoBillingUse',
      'autoBillingSuccessCount','autoBillingFailureCount'
    ];
    for (const col of pmCols) {
      await queryRunner.query(`ALTER TABLE "user_payment_methods" DROP COLUMN IF EXISTS "${col}"`);
    }
  }
};
