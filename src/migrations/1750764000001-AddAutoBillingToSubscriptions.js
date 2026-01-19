module.exports = class AddAutoBillingToSubscriptions1750764000001 {
  async up(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN "autoBillingEnabled" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN "preferredPaymentMethodId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN "autoBillingFailureCount" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN "lastAutoBillingAttempt" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN "autoBillingGracePeriod" integer NOT NULL DEFAULT 7
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_subscription_auto_billing" ON "subscriptions" ("autoBillingEnabled")
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD CONSTRAINT "FK_subscriptions_payment_method"
      FOREIGN KEY ("preferredPaymentMethodId") REFERENCES "user_payment_methods"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP CONSTRAINT IF EXISTS "FK_subscriptions_payment_method"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_subscription_auto_billing"
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP COLUMN "autoBillingGracePeriod"
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP COLUMN "lastAutoBillingAttempt"
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP COLUMN "autoBillingFailureCount"
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP COLUMN "preferredPaymentMethodId"
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP COLUMN "autoBillingEnabled"
    `);
  }
};