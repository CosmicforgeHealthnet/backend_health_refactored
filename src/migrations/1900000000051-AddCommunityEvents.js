/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddCommunityEvents1900000000051 {
    name = 'AddCommunityEvents1900000000051'

    async up(queryRunner) {
        // ── 1. community_events ─────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "community_events_status_enum" AS ENUM ('draft', 'published')
        `);
        await queryRunner.query(`
            CREATE TABLE "community_events" (
                "id"            uuid                                NOT NULL DEFAULT uuid_generate_v4(),
                "communityId"   uuid                                NOT NULL,
                "createdById"   uuid,
                "title"         character varying                   NOT NULL,
                "description"   text,
                "startAt"       TIMESTAMP WITH TIME ZONE            NOT NULL,
                "coverImageUrl" character varying,
                "status"        "community_events_status_enum"      NOT NULL DEFAULT 'draft',
                "guestCount"    integer                             NOT NULL DEFAULT 0,
                "isDeleted"     boolean                             NOT NULL DEFAULT false,
                "deletedAt"     TIMESTAMP WITH TIME ZONE,
                "createdAt"     TIMESTAMP WITH TIME ZONE            NOT NULL DEFAULT now(),
                "updatedAt"     TIMESTAMP WITH TIME ZONE            NOT NULL DEFAULT now(),
                CONSTRAINT "PK_community_events"           PRIMARY KEY ("id"),
                CONSTRAINT "FK_community_events_community" FOREIGN KEY ("communityId") REFERENCES "communities" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_events_createdBy" FOREIGN KEY ("createdById") REFERENCES "users"      ("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_EVENT_COMMUNITY"          ON "community_events" ("communityId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_EVENT_STATUS"             ON "community_events" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_EVENT_START_AT"           ON "community_events" ("startAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_EVENT_COMMUNITY_START_AT" ON "community_events" ("communityId", "startAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_EVENT_IS_DELETED"         ON "community_events" ("isDeleted")`);

        // ── 2. community_event_rsvps ────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "community_event_rsvps" (
                "id"             uuid                      NOT NULL DEFAULT uuid_generate_v4(),
                "eventId"        uuid                      NOT NULL,
                "userId"         uuid                      NOT NULL,
                "remindMe"       boolean                   NOT NULL DEFAULT true,
                "reminderSentAt" TIMESTAMP WITH TIME ZONE,
                "createdAt"      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
                CONSTRAINT "PK_community_event_rsvps"            PRIMARY KEY ("id"),
                CONSTRAINT "UQ_COMMUNITY_EVENT_RSVP_EVENT_USER"   UNIQUE ("eventId", "userId"),
                CONSTRAINT "FK_community_event_rsvps_event"       FOREIGN KEY ("eventId") REFERENCES "community_events" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_event_rsvps_user"        FOREIGN KEY ("userId")  REFERENCES "users"            ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_EVENT_RSVP_EVENT"      ON "community_event_rsvps" ("eventId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_EVENT_RSVP_USER"       ON "community_event_rsvps" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_EVENT_RSVP_REMIND_ME"  ON "community_event_rsvps" ("remindMe")`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "community_event_rsvps"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "community_events"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "community_events_status_enum"`);
    }
}
