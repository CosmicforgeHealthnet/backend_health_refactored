const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class CreateChatMessages1728705660000 {
  async up(queryRunner) {
    // Create enum type for message types
    await queryRunner.query(`
      CREATE TYPE chat_message_type_enum AS ENUM ('text', 'image', 'file', 'system', 'typing');
    `);

    // Create the chat_messages table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "content" TEXT NOT NULL,
        "type" chat_message_type_enum DEFAULT 'text',
        "senderId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "roomId" UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
        "replyToId" UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
        "metadata" JSONB,
        "edited" BOOLEAN DEFAULT false,
        "editHistory" JSONB,
        "deleted" BOOLEAN DEFAULT false,
        "deletedAt" TIMESTAMP,
        "readBy" JSONB,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create essential indexes
    await queryRunner.query(`
    CREATE INDEX IF NOT EXISTS "IDX_CHAT_MESSAGE_ROOM" ON "chat_messages" ("roomId");
    CREATE INDEX IF NOT EXISTS "IDX_CHAT_MESSAGE_SENDER" ON "chat_messages" ("senderId");
    CREATE INDEX IF NOT EXISTS "IDX_CHAT_MESSAGE_CREATED" ON "chat_messages" ("createdAt");
    CREATE INDEX IF NOT EXISTS "IDX_CHAT_MESSAGE_TYPE" ON "chat_messages" ("type");
    `);

    // Create trigger for updatedAt timestamp
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."updatedAt" = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_chat_messages_updated_at 
        BEFORE UPDATE ON chat_messages 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  async down(queryRunner) {
    // Drop trigger and function
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON chat_messages;`
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS update_updated_at_column();`
    );

    // Drop table and enum
    await queryRunner.query(`DROP TABLE IF EXISTS chat_messages CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS chat_message_type_enum;`);
  }
};
