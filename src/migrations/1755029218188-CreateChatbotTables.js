/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class CreateChatbotTables1755029218188 {
    name = 'CreateChatbotTables1755029218188'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."chatbot_sessions_sessiontype_enum" AS ENUM('general', 'doctor')`);
        await queryRunner.query(`CREATE TYPE "public"."chatbot_sessions_usertype_enum" AS ENUM('patient', 'doctor')`);
        await queryRunner.query(`CREATE TABLE "chatbot_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255), "sessionType" "public"."chatbot_sessions_sessiontype_enum" NOT NULL, "userId" uuid NOT NULL, "userType" "public"."chatbot_sessions_usertype_enum" NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "metadata" jsonb, "messageCount" integer NOT NULL DEFAULT '0', "lastActivityAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cceaa5ac7326e15858987f9dde9" PRIMARY KEY ("id")); COMMENT ON COLUMN "chatbot_sessions"."title" IS 'Auto-generated from first message'; COMMENT ON COLUMN "chatbot_sessions"."sessionType" IS 'general for /chat, doctor for /doctorchat'; COMMENT ON COLUMN "chatbot_sessions"."metadata" IS 'Store conversation context and AI metadata'; COMMENT ON COLUMN "chatbot_sessions"."messageCount" IS 'Total messages in this session'`);
        await queryRunner.query(`CREATE INDEX "IDX_CHATBOT_SESSION_USER_TYPE" ON "chatbot_sessions" ("userId", "sessionType") `);
        await queryRunner.query(`CREATE INDEX "IDX_CHATBOT_SESSION_ACTIVE" ON "chatbot_sessions" ("isActive", "lastActivityAt") `);
        await queryRunner.query(`CREATE TYPE "public"."chatbot_messages_messagetype_enum" AS ENUM('user', 'bot')`);
        await queryRunner.query(`CREATE TABLE "chatbot_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "messageType" "public"."chatbot_messages_messagetype_enum" NOT NULL, "role" character varying(50) NOT NULL, "metadata" jsonb, "sessionId" uuid NOT NULL, "userId" uuid NOT NULL, "processingTime" integer, "tokenCount" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fa71cffb10870b351cfad908cfc" PRIMARY KEY ("id")); COMMENT ON COLUMN "chatbot_messages"."role" IS 'user, assistant, system for AI context'; COMMENT ON COLUMN "chatbot_messages"."metadata" IS 'Store AI response metadata, tokens used, etc.'; COMMENT ON COLUMN "chatbot_messages"."processingTime" IS 'Time taken for AI to respond in milliseconds'; COMMENT ON COLUMN "chatbot_messages"."tokenCount" IS 'Number of tokens used for this message'`);
        await queryRunner.query(`CREATE INDEX "IDX_CHATBOT_MESSAGE_SESSION" ON "chatbot_messages" ("sessionId", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_CHATBOT_MESSAGE_TYPE" ON "chatbot_messages" ("messageType") `);
        await queryRunner.query(`ALTER TABLE "chatbot_sessions" ADD CONSTRAINT "FK_1d1ad76c8158319069fbbab5475" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chatbot_messages" ADD CONSTRAINT "FK_e10358f7e9dd169a5e4e177af98" FOREIGN KEY ("sessionId") REFERENCES "chatbot_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chatbot_messages" ADD CONSTRAINT "FK_f2c83d9cee2aab35489be92163f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "chatbot_messages" DROP CONSTRAINT "FK_f2c83d9cee2aab35489be92163f"`);
        await queryRunner.query(`ALTER TABLE "chatbot_messages" DROP CONSTRAINT "FK_e10358f7e9dd169a5e4e177af98"`);
        await queryRunner.query(`ALTER TABLE "chatbot_sessions" DROP CONSTRAINT "FK_1d1ad76c8158319069fbbab5475"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CHATBOT_MESSAGE_TYPE"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CHATBOT_MESSAGE_SESSION"`);
        await queryRunner.query(`DROP TABLE "chatbot_messages"`);
        await queryRunner.query(`DROP TYPE "public"."chatbot_messages_messagetype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CHATBOT_SESSION_ACTIVE"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CHATBOT_SESSION_USER_TYPE"`);
        await queryRunner.query(`DROP TABLE "chatbot_sessions"`);
        await queryRunner.query(`DROP TYPE "public"."chatbot_sessions_usertype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."chatbot_sessions_sessiontype_enum"`);
    }
}
