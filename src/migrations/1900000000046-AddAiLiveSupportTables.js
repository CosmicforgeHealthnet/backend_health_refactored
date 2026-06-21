module.exports = class AddAiLiveSupportTables1900000000046 {
  name = 'AddAiLiveSupportTables1900000000046';

  async up(queryRunner) {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ai_support_session_status_enum" AS ENUM ('active', 'escalated', 'agent_joined', 'closed');
      EXCEPTION WHEN duplicate_object THEN null; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ai_support_message_sender_type_enum" AS ENUM ('user', 'ai', 'agent');
      EXCEPTION WHEN duplicate_object THEN null; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_support_sessions" (
        "id"               UUID NOT NULL DEFAULT uuid_generate_v4(),
        "userId"           UUID NOT NULL,
        "userRole"         VARCHAR(50) NOT NULL,
        "status"           "ai_support_session_status_enum" NOT NULL DEFAULT 'active',
        "escalationReason" TEXT,
        "agentId"          UUID,
        "messageCount"     INTEGER NOT NULL DEFAULT 0,
        "lastActivityAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "closedAt"         TIMESTAMP,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_support_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_support_sessions_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ai_support_sessions_agent"
          FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_support_messages" (
        "id"          UUID NOT NULL DEFAULT uuid_generate_v4(),
        "sessionId"   UUID NOT NULL,
        "senderId"    UUID NOT NULL,
        "senderType"  "ai_support_message_sender_type_enum" NOT NULL,
        "content"     TEXT NOT NULL,
        "metadata"    JSONB,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_support_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_support_messages_session"
          FOREIGN KEY ("sessionId") REFERENCES "ai_support_sessions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_support_sessions_user"   ON "ai_support_sessions" ("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_support_sessions_status" ON "ai_support_sessions" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_support_sessions_agent"  ON "ai_support_sessions" ("agentId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_support_messages_session" ON "ai_support_messages" ("sessionId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_support_messages_type"    ON "ai_support_messages" ("senderType")`);
  }

  async down(queryRunner) {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_support_messages_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_support_messages_session"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_support_sessions_agent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_support_sessions_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_support_sessions_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_support_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_support_sessions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ai_support_message_sender_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ai_support_session_status_enum"`);
  }
};
