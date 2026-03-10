const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class CreateChatFileAttachments1728705720000 {
  async up(queryRunner) {
    // Create table with camelCase column names
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_file_attachments" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "filename" VARCHAR(255) NOT NULL,
        "originalName" VARCHAR(255) NOT NULL,
        "mimeType" VARCHAR(100) NOT NULL,
        "fileSize" BIGINT NOT NULL,
        "filePath" VARCHAR(500) NOT NULL,
        "fileUrl" VARCHAR(500),
        "thumbnailPath" VARCHAR(500),
        "messageId" UUID NOT NULL,
        "uploadedById" UUID NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_CHAT_FILE_MESSAGE" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_CHAT_FILE_UPLOADER" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    // Create indexes using camelCase column names
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_CHAT_FILE_MESSAGE" ON "chat_file_attachments" ("messageId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_CHAT_FILE_UPLOADER" ON "chat_file_attachments" ("uploadedById");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_CHAT_FILE_MIME_TYPE" ON "chat_file_attachments" ("mimeType");`);
  }

  async down(queryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_file_attachments";`);
  }
};
