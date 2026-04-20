module.exports = class AddCascadeToSubscriptionUserRelation1750764000000 {
  async up(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP CONSTRAINT IF EXISTS "FK_subscription_user"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_subscription_user' AND table_name = 'subscriptions') THEN
          ALTER TABLE "subscriptions"
          ADD CONSTRAINT "FK_subscription_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END
      $$
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
