const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class AddChatRoomLastActivity1728705600000 {
  async up(queryRunner) {
    // Use camelCase column names
    await queryRunner.query(`
      ALTER TABLE chat_rooms 
      ADD COLUMN "lastActivityAt" TIMESTAMP NULL,
      ADD COLUMN "lastMessageId" UUID NULL,
      ADD COLUMN "messageCount" INTEGER DEFAULT 0;
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE chat_rooms 
      ADD CONSTRAINT "FK_ChatRoom_LastMessage" 
      FOREIGN KEY ("lastMessageId") 
      REFERENCES chat_messages(id) 
      ON DELETE SET NULL;
    `);

    // Add index on lastActivityAt
    await queryRunner.query(`
      CREATE INDEX "IDX_CHATROOM_LASTACTIVITY" 
      ON chat_rooms ("lastActivityAt");
    `);
  }

  async down(queryRunner) {
    // Drop foreign key
    await queryRunner.query(`
      ALTER TABLE chat_rooms 
      DROP CONSTRAINT IF EXISTS "FK_ChatRoom_LastMessage";
    `);

    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_CHATROOM_LASTACTIVITY";
    `);

    // Drop columns
    await queryRunner.query(`
      ALTER TABLE chat_rooms 
      DROP COLUMN IF EXISTS "lastActivityAt",
      DROP COLUMN IF EXISTS "lastMessageId",
      DROP COLUMN IF EXISTS "messageCount";
    `);
  }
};
