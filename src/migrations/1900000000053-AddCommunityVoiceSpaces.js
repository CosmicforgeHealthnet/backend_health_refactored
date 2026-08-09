/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddCommunityVoiceSpaces1900000000053 {
    name = 'AddCommunityVoiceSpaces1900000000053'

    async up(queryRunner) {
        // ── 1. community_voice_spaces ───────────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "community_voice_spaces_status_enum" AS ENUM ('live', 'ended')
        `);
        await queryRunner.query(`
            CREATE TABLE "community_voice_spaces" (
                "id"            uuid                                     NOT NULL DEFAULT uuid_generate_v4(),
                "communityId"   uuid                                     NOT NULL,
                "hostId"        uuid,
                "title"         character varying                        NOT NULL,
                "status"        "community_voice_spaces_status_enum"    NOT NULL DEFAULT 'live',
                "provider"      character varying                        NOT NULL DEFAULT 'zoom',
                "zoomMeetingId" character varying,
                "joinUrl"       character varying,
                "hostStartUrl"  character varying,
                "endedAt"       TIMESTAMP WITH TIME ZONE,
                "createdAt"     TIMESTAMP WITH TIME ZONE                NOT NULL DEFAULT now(),
                "updatedAt"     TIMESTAMP WITH TIME ZONE                NOT NULL DEFAULT now(),
                CONSTRAINT "PK_community_voice_spaces"           PRIMARY KEY ("id"),
                CONSTRAINT "FK_community_voice_spaces_community" FOREIGN KEY ("communityId") REFERENCES "communities" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_voice_spaces_host"      FOREIGN KEY ("hostId")      REFERENCES "users"      ("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_VOICE_SPACE_COMMUNITY"        ON "community_voice_spaces" ("communityId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_VOICE_SPACE_STATUS"           ON "community_voice_spaces" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_VOICE_SPACE_COMMUNITY_STATUS" ON "community_voice_spaces" ("communityId", "status")`);
        // Only one live space per community at a time.
        await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_COMMUNITY_VOICE_SPACE_ONE_LIVE_PER_COMMUNITY"
            ON "community_voice_spaces" ("communityId")
            WHERE "status" = 'live'
        `);

        // ── 2. community_voice_space_participants ───────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "community_voice_space_participants_role_enum" AS ENUM ('host', 'speaker', 'listener')
        `);
        await queryRunner.query(`
            CREATE TABLE "community_voice_space_participants" (
                "id"          uuid                                                NOT NULL DEFAULT uuid_generate_v4(),
                "spaceId"     uuid                                                NOT NULL,
                "userId"      uuid                                                NOT NULL,
                "role"        "community_voice_space_participants_role_enum"    NOT NULL DEFAULT 'listener',
                "handRaised"  boolean                                             NOT NULL DEFAULT false,
                "isActive"    boolean                                             NOT NULL DEFAULT true,
                "joinedAt"    TIMESTAMP WITH TIME ZONE,
                "leftAt"      TIMESTAMP WITH TIME ZONE,
                "createdAt"   TIMESTAMP WITH TIME ZONE                           NOT NULL DEFAULT now(),
                "updatedAt"   TIMESTAMP WITH TIME ZONE                           NOT NULL DEFAULT now(),
                CONSTRAINT "PK_community_voice_space_participants"          PRIMARY KEY ("id"),
                CONSTRAINT "UQ_COMMUNITY_VOICE_SPACE_PARTICIPANT_SPACE_USER" UNIQUE ("spaceId", "userId"),
                CONSTRAINT "FK_community_voice_space_participants_space"    FOREIGN KEY ("spaceId") REFERENCES "community_voice_spaces" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_voice_space_participants_user"     FOREIGN KEY ("userId")  REFERENCES "users"                   ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_VOICE_SPACE_PARTICIPANT_SPACE"      ON "community_voice_space_participants" ("spaceId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_VOICE_SPACE_PARTICIPANT_USER"       ON "community_voice_space_participants" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_VOICE_SPACE_PARTICIPANT_SPACE_ROLE" ON "community_voice_space_participants" ("spaceId", "role")`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "community_voice_space_participants"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "community_voice_spaces"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "community_voice_space_participants_role_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "community_voice_spaces_status_enum"`);
    }
}
