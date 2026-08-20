/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddCommunityPostViews1900000000056 {
    name = 'AddCommunityPostViews1900000000056'

    async up(queryRunner) {
        await queryRunner.query(`
            CREATE TABLE "community_post_views" (
                "id"        uuid                      NOT NULL DEFAULT uuid_generate_v4(),
                "postId"    uuid                      NOT NULL,
                "userId"    uuid                      NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
                CONSTRAINT "PK_community_post_views"      PRIMARY KEY ("id"),
                CONSTRAINT "FK_community_post_views_post"  FOREIGN KEY ("postId") REFERENCES "community_posts" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_post_views_user"  FOREIGN KEY ("userId") REFERENCES "users"           ("id") ON DELETE CASCADE,
                CONSTRAINT "UQ_COMMUNITY_POST_VIEW_POST_USER" UNIQUE ("postId", "userId")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_VIEW_POST" ON "community_post_views" ("postId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_VIEW_USER" ON "community_post_views" ("userId")`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "community_post_views"`);
    }
}
