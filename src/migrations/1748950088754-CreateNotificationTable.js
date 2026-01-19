/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class CreateNotificationTable1748950088754 {
  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS  "notification" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" varchar(50) NOT NULL,
        "message" text NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "metadata" json,
        "createdAt" TIMESTAMPTZ DEFAULT now(),
        "readAt" TIMESTAMPTZ,
        "userId" uuid NOT NULL,
        "isDeleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "FK_user_notification" FOREIGN KEY("userId") REFERENCES "user"("id")
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`DROP TABLE "notification"`);
  }
};
