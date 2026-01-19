module.exports = class AddCascadeToNotificationUserRelation1750763526320 {
  async up(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "notification"
      DROP CONSTRAINT IF EXISTS "FK_notification_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "notification"
      ADD CONSTRAINT "FK_notification_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "notification"
      DROP CONSTRAINT IF EXISTS "FK_notification_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "notification"
      ADD CONSTRAINT "FK_notification_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
    `);
  }
};
