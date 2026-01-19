const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class UpdateUsersForChat1728705780000 {
  async up(queryRunner) {
    // Add enum type for chatStatus
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_status') THEN
          CREATE TYPE chat_status AS ENUM ('available', 'busy', 'away', 'invisible');
        END IF;
      END $$;
    `);

    // Add new camelCase columns to 'users'
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "chatSettings" JSONB DEFAULT '{}' NULL,
      ADD COLUMN "isOnline" BOOLEAN DEFAULT false,
      ADD COLUMN "lastSeenAt" TIMESTAMP NULL,
      ADD COLUMN "chatStatus" chat_status DEFAULT 'available';
    `);

    // Create indexes with camelCase column names
    await queryRunner.query(`CREATE INDEX "IDX_USER_IS_ONLINE" ON "users" ("isOnline");`);
    await queryRunner.query(`CREATE INDEX "IDX_USER_CHAT_STATUS" ON "users" ("chatStatus");`);
    await queryRunner.query(`CREATE INDEX "IDX_USER_LAST_SEEN_AT" ON "users" ("lastSeenAt");`);
  }

  async down(queryRunner) {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_USER_IS_ONLINE";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_USER_CHAT_STATUS";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_USER_LAST_SEEN_AT";`);

    // Drop columns
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "chatSettings",
      DROP COLUMN IF EXISTS "isOnline",
      DROP COLUMN IF EXISTS "lastSeenAt",
      DROP COLUMN IF EXISTS "chatStatus";
    `);

    // Drop enum type
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_status') THEN
          DROP TYPE chat_status;
        END IF;
      END $$;
    `);
  }
};
