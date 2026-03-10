const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class AddMessageReactions20250611094500 {
  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_message_reactions" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "emoji" VARCHAR(10) NOT NULL,
        "messageId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "FK_Reaction_Message" 
          FOREIGN KEY ("messageId") 
          REFERENCES "chat_messages"("id") 
          ON DELETE CASCADE,
          
        CONSTRAINT "FK_Reaction_User" 
          FOREIGN KEY ("userId") 
          REFERENCES "users"("id") 
          ON DELETE CASCADE,
          
        CONSTRAINT "UQ_Message_Reaction_User_Emoji" 
          UNIQUE ("messageId", "userId", "emoji")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_REACTION_MESSAGE" ON "chat_message_reactions" ("messageId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_REACTION_USER" ON "chat_message_reactions" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_REACTION_EMOJI" ON "chat_message_reactions" ("emoji");
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_message_reactions" CASCADE;`);
  }
};
