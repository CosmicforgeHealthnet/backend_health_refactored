module.exports = class AddCascadeToSubscriptionUserRelation1750764000000 {
  async up(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP CONSTRAINT IF EXISTS "FK_subscription_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD CONSTRAINT "FK_subscription_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP CONSTRAINT IF EXISTS "FK_subscription_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD CONSTRAINT "FK_subscription_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
    `);
  }
};
