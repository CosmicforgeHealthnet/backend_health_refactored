module.exports = class AddAutoBillingToUserPaymentMethods1750764000002 {
  async up(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      ADD COLUMN IF NOT EXISTS "canAutoCharge" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      ADD COLUMN IF NOT EXISTS "tokenExpiryDate" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      ADD COLUMN IF NOT EXISTS "lastAutoBillingUse" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      ADD COLUMN IF NOT EXISTS "autoBillingSuccessCount" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      ADD COLUMN IF NOT EXISTS "autoBillingFailureCount" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_method_auto_charge" ON "user_payment_methods" ("canAutoCharge")
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_payment_method_auto_charge"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      DROP COLUMN "autoBillingFailureCount"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      DROP COLUMN "autoBillingSuccessCount"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      DROP COLUMN "lastAutoBillingUse"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      DROP COLUMN "tokenExpiryDate"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      DROP COLUMN "canAutoCharge"
    `);
  }
};