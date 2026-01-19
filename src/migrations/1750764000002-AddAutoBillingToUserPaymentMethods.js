module.exports = class AddAutoBillingToUserPaymentMethods1750764000002 {
  async up(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      ADD COLUMN "canAutoCharge" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      ADD COLUMN "tokenExpiryDate" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      ADD COLUMN "lastAutoBillingUse" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      ADD COLUMN "autoBillingSuccessCount" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "user_payment_methods"
      ADD COLUMN "autoBillingFailureCount" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payment_method_auto_charge" ON "user_payment_methods" ("canAutoCharge")
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