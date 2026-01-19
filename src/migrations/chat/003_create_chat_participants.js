const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class CreateChatParticipants1728705900000 {
  async up(queryRunner) {
    // Create the enum type for chat participant roles
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_participant_role') THEN
          CREATE TYPE chat_participant_role AS ENUM ('admin', 'moderator', 'member');
        END IF;
      END $$;
    `);

    // Create the chat_participants table with camelCase columns
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_participants" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "role" chat_participant_role DEFAULT 'member',
        "permissions" JSONB,
        "isActive" BOOLEAN DEFAULT true,
        "lastReadAt" TIMESTAMP,
        "joinedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "leftAt" TIMESTAMP,
        "metadata" JSONB,
        "userId" UUID NOT NULL,
        "roomId" UUID NOT NULL,
        "addedById" UUID,
        CONSTRAINT "FK_participant_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_participant_room" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_participant_added_by" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_CHAT_PARTICIPANT_USER_ROOM" UNIQUE ("userId", "roomId")
      );
    `);

    // Create indexes for camelCase columns
    await queryRunner.query(`CREATE INDEX "IDX_CHAT_PARTICIPANT_USER" ON "chat_participants" ("userId");`);
    await queryRunner.query(`CREATE INDEX "IDX_CHAT_PARTICIPANT_ROOM" ON "chat_participants" ("roomId");`);
    await queryRunner.query(`CREATE INDEX "IDX_CHAT_PARTICIPANT_ACTIVE" ON "chat_participants" ("isActive");`);
  }

  async down(queryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_participants";`);

    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_participant_role') THEN
          DROP TYPE chat_participant_role;
        END IF;
      END $$;
    `);
  }
};
