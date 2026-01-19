const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class CreateChatRoomsCamelCase1728705660000 {
  async up(queryRunner) {
    // Create enum type for `type` column
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chatroom_type_enum') THEN
          CREATE TYPE "chatroom_type_enum" AS ENUM ('direct', 'group', 'appointment', 'support');
        END IF;
      END$$;
    `);

    // Create the `chatRooms` table with camelCase column names
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_rooms" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "type" chatroom_type_enum DEFAULT 'direct',
        "isPrivate" BOOLEAN DEFAULT false,
        "maxParticipants" INT DEFAULT 50,
        "settings" JSONB,
        "metadata" JSONB,
        "createdById" UUID,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP,

        CONSTRAINT fk_chatroom_created_by FOREIGN KEY ("createdById")
          REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_CHAT_ROOM_TYPE" ON "chat_rooms"("type");`);
    await queryRunner.query(`CREATE INDEX "IDX_CHAT_ROOM_PRIVATE" ON "chat_rooms"("isPrivate");`);
    await queryRunner.query(`CREATE INDEX "IDX_CHAT_ROOM_CREATED_BY" ON "chat_rooms"("createdById");`);
  }

  async down(queryRunner) {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_CHAT_ROOM_CREATED_BY";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_CHAT_ROOM_PRIVATE";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_CHAT_ROOM_TYPE";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_rooms";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "chatroom_type_enum";`);
  }
};
