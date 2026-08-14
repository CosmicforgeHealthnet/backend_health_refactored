/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddCommunityInvites1900000000055 {
    name = 'AddCommunityInvites1900000000055'

    async up(queryRunner) {
        await queryRunner.query(`
            CREATE TYPE "community_invites_status_enum" AS ENUM ('pending', 'accepted', 'declined', 'cancelled')
        `);
        await queryRunner.query(`
            CREATE TABLE "community_invites" (
                "id"           uuid                                 NOT NULL DEFAULT uuid_generate_v4(),
                "communityId"  uuid                                 NOT NULL,
                "invitedById"  uuid,
                "inviteeId"    uuid                                 NOT NULL,
                "status"       "community_invites_status_enum"     NOT NULL DEFAULT 'pending',
                "message"      text,
                "respondedAt"  TIMESTAMP WITH TIME ZONE,
                "createdAt"    TIMESTAMP WITH TIME ZONE            NOT NULL DEFAULT now(),
                "updatedAt"    TIMESTAMP WITH TIME ZONE            NOT NULL DEFAULT now(),
                CONSTRAINT "PK_community_invites"           PRIMARY KEY ("id"),
                CONSTRAINT "FK_community_invites_community" FOREIGN KEY ("communityId") REFERENCES "communities" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_invites_invitedBy" FOREIGN KEY ("invitedById") REFERENCES "users"      ("id") ON DELETE SET NULL,
                CONSTRAINT "FK_community_invites_invitee"   FOREIGN KEY ("inviteeId")   REFERENCES "users"      ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_INVITE_COMMUNITY"        ON "community_invites" ("communityId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_INVITE_INVITEE"          ON "community_invites" ("inviteeId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_INVITE_COMMUNITY_STATUS" ON "community_invites" ("communityId", "status")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_INVITE_INVITEE_STATUS"   ON "community_invites" ("inviteeId", "status")`);
        // Prevent duplicate pending invites to the same person for the same community.
        await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_COMMUNITY_INVITE_PENDING"
            ON "community_invites" ("communityId", "inviteeId")
            WHERE "status" = 'pending'
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "community_invites"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "community_invites_status_enum"`);
    }
}
