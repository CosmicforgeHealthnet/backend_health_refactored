module.exports = class AddAutoBillingToTransactions1750764000003 {
  async up(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD COLUMN IF NOT EXISTS "isAutoBilling" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transaction_auto_billing" ON "transactions" ("isAutoBilling")
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_transaction_auto_billing"
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      DROP COLUMN "isAutoBilling"
    `);
  }
};