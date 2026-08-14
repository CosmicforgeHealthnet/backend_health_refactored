/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddCommunityHealthSystem1900000000050 {
    name = 'AddCommunityHealthSystem1900000000050'

    async up(queryRunner) {
        // ── 1. communities ──────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "communities_privacytype_enum" AS ENUM ('public', 'private')
        `);
        await queryRunner.query(`
            CREATE TABLE "communities" (
                "id"           uuid                              NOT NULL DEFAULT uuid_generate_v4(),
                "name"         character varying                 NOT NULL,
                "slug"         character varying                 NOT NULL,
                "description"  text,
                "category"     character varying,
                "tags"         jsonb,
                "privacyType"  "communities_privacytype_enum"    NOT NULL DEFAULT 'public',
                "bannerUrl"    character varying,
                "avatarUrl"    character varying,
                "rules"        text,
                "memberCount"  integer                           NOT NULL DEFAULT 0,
                "postCount"    integer                           NOT NULL DEFAULT 0,
                "isActive"     boolean                           NOT NULL DEFAULT true,
                "createdById"  uuid,
                "createdAt"    TIMESTAMP WITH TIME ZONE          NOT NULL DEFAULT now(),
                "updatedAt"    TIMESTAMP WITH TIME ZONE          NOT NULL DEFAULT now(),
                "deletedAt"    TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_communities"        PRIMARY KEY ("id"),
                CONSTRAINT "UQ_communities_slug"   UNIQUE ("slug"),
                CONSTRAINT "FK_communities_createdBy" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_PRIVACY_TYPE" ON "communities" ("privacyType")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_CATEGORY"     ON "communities" ("category")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_CREATED_BY"   ON "communities" ("createdById")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_IS_ACTIVE"    ON "communities" ("isActive")`);

        // ── 2. community_members ────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "community_members_role_enum" AS ENUM ('owner', 'admin', 'moderator', 'member', 'pending_member')
        `);
        await queryRunner.query(`
            CREATE TABLE "community_members" (
                "id"          uuid                              NOT NULL DEFAULT uuid_generate_v4(),
                "communityId" uuid                              NOT NULL,
                "userId"      uuid                              NOT NULL,
                "invitedById" uuid,
                "role"        "community_members_role_enum"    NOT NULL DEFAULT 'pending_member',
                "isActive"    boolean                           NOT NULL DEFAULT true,
                "joinedAt"    TIMESTAMP WITH TIME ZONE,
                "leftAt"      TIMESTAMP WITH TIME ZONE,
                "metadata"    jsonb,
                "createdAt"   TIMESTAMP WITH TIME ZONE          NOT NULL DEFAULT now(),
                "updatedAt"   TIMESTAMP WITH TIME ZONE          NOT NULL DEFAULT now(),
                CONSTRAINT "PK_community_members"             PRIMARY KEY ("id"),
                CONSTRAINT "UQ_COMMUNITY_MEMBER_USER_COMMUNITY" UNIQUE ("userId", "communityId"),
                CONSTRAINT "FK_community_members_community" FOREIGN KEY ("communityId") REFERENCES "communities" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_members_user"      FOREIGN KEY ("userId")      REFERENCES "users"      ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_members_invitedBy" FOREIGN KEY ("invitedById") REFERENCES "users"      ("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_MEMBER_COMMUNITY"      ON "community_members" ("communityId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_MEMBER_USER"           ON "community_members" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_MEMBER_COMMUNITY_ROLE" ON "community_members" ("communityId", "role")`);

        // ── 3. community_join_requests ──────────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "community_join_requests_status_enum" AS ENUM ('pending', 'approved', 'rejected')
        `);
        await queryRunner.query(`
            CREATE TABLE "community_join_requests" (
                "id"              uuid                                      NOT NULL DEFAULT uuid_generate_v4(),
                "communityId"     uuid                                      NOT NULL,
                "userId"          uuid                                      NOT NULL,
                "reviewedById"    uuid,
                "status"          "community_join_requests_status_enum"    NOT NULL DEFAULT 'pending',
                "message"         text,
                "rejectionReason" text,
                "reviewedAt"      TIMESTAMP WITH TIME ZONE,
                "createdAt"       TIMESTAMP WITH TIME ZONE                 NOT NULL DEFAULT now(),
                "updatedAt"       TIMESTAMP WITH TIME ZONE                 NOT NULL DEFAULT now(),
                CONSTRAINT "PK_community_join_requests"          PRIMARY KEY ("id"),
                CONSTRAINT "FK_community_join_requests_community" FOREIGN KEY ("communityId")  REFERENCES "communities" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_join_requests_user"      FOREIGN KEY ("userId")       REFERENCES "users"      ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_join_requests_reviewedBy" FOREIGN KEY ("reviewedById") REFERENCES "users"      ("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_JOIN_REQUEST_COMMUNITY"        ON "community_join_requests" ("communityId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_JOIN_REQUEST_USER"             ON "community_join_requests" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_JOIN_REQUEST_COMMUNITY_STATUS" ON "community_join_requests" ("communityId", "status")`);
        // Prevent duplicate pending requests from the same user for the same community
        await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_COMMUNITY_JOIN_REQUEST_PENDING"
            ON "community_join_requests" ("communityId", "userId")
            WHERE "status" = 'pending'
        `);

        // ── 4. community_posts ──────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "community_posts" (
                "id"            uuid                      NOT NULL DEFAULT uuid_generate_v4(),
                "communityId"   uuid                      NOT NULL,
                "authorId"      uuid                      NOT NULL,
                "deletedById"   uuid,
                "content"       text,
                "likeCount"     integer                   NOT NULL DEFAULT 0,
                "commentCount"  integer                   NOT NULL DEFAULT 0,
                "viewCount"     integer                   NOT NULL DEFAULT 0,
                "isDeleted"     boolean                   NOT NULL DEFAULT false,
                "deletedAt"     TIMESTAMP WITH TIME ZONE,
                "createdAt"     TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
                "updatedAt"     TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
                CONSTRAINT "PK_community_posts"           PRIMARY KEY ("id"),
                CONSTRAINT "FK_community_posts_community" FOREIGN KEY ("communityId") REFERENCES "communities" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_posts_author"    FOREIGN KEY ("authorId")    REFERENCES "users"      ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_posts_deletedBy" FOREIGN KEY ("deletedById") REFERENCES "users"      ("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_COMMUNITY"            ON "community_posts" ("communityId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_AUTHOR"               ON "community_posts" ("authorId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_COMMUNITY_CREATED_AT" ON "community_posts" ("communityId", "createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_IS_DELETED"           ON "community_posts" ("isDeleted")`);

        // ── 5. community_post_media ─────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "community_post_media_mediatype_enum" AS ENUM ('image', 'video')
        `);
        await queryRunner.query(`
            CREATE TABLE "community_post_media" (
                "id"        uuid                                     NOT NULL DEFAULT uuid_generate_v4(),
                "postId"    uuid                                     NOT NULL,
                "mediaUrl"  character varying                        NOT NULL,
                "mediaType" "community_post_media_mediatype_enum"    NOT NULL DEFAULT 'image',
                "order"     integer                                  NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP WITH TIME ZONE                 NOT NULL DEFAULT now(),
                CONSTRAINT "PK_community_post_media"      PRIMARY KEY ("id"),
                CONSTRAINT "FK_community_post_media_post" FOREIGN KEY ("postId") REFERENCES "community_posts" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_MEDIA_POST" ON "community_post_media" ("postId")`);

        // ── 6. community_post_likes ─────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "community_post_likes" (
                "id"        uuid                      NOT NULL DEFAULT uuid_generate_v4(),
                "postId"    uuid                      NOT NULL,
                "userId"    uuid                      NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
                CONSTRAINT "PK_community_post_likes"          PRIMARY KEY ("id"),
                CONSTRAINT "UQ_COMMUNITY_POST_LIKE_POST_USER" UNIQUE ("postId", "userId"),
                CONSTRAINT "FK_community_post_likes_post"     FOREIGN KEY ("postId") REFERENCES "community_posts" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_post_likes_user"     FOREIGN KEY ("userId") REFERENCES "users"           ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_LIKE_POST" ON "community_post_likes" ("postId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_LIKE_USER" ON "community_post_likes" ("userId")`);

        // ── 7. community_post_comments ──────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "community_post_comments" (
                "id"              uuid                      NOT NULL DEFAULT uuid_generate_v4(),
                "postId"          uuid                      NOT NULL,
                "authorId"        uuid                      NOT NULL,
                "parentCommentId" uuid,
                "content"         text                      NOT NULL,
                "isDeleted"       boolean                   NOT NULL DEFAULT false,
                "deletedAt"       TIMESTAMP WITH TIME ZONE,
                "createdAt"       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
                "updatedAt"       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
                CONSTRAINT "PK_community_post_comments"            PRIMARY KEY ("id"),
                CONSTRAINT "FK_community_post_comments_post"       FOREIGN KEY ("postId")          REFERENCES "community_posts"        ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_post_comments_author"     FOREIGN KEY ("authorId")        REFERENCES "users"                  ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_post_comments_parent"     FOREIGN KEY ("parentCommentId")  REFERENCES "community_post_comments" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_COMMENT_POST"            ON "community_post_comments" ("postId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_COMMENT_AUTHOR"          ON "community_post_comments" ("authorId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_COMMENT_POST_CREATED_AT" ON "community_post_comments" ("postId", "createdAt")`);

        // ── 8. community_post_saves ─────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "community_post_saves" (
                "id"        uuid                      NOT NULL DEFAULT uuid_generate_v4(),
                "postId"    uuid                      NOT NULL,
                "userId"    uuid                      NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
                CONSTRAINT "PK_community_post_saves"          PRIMARY KEY ("id"),
                CONSTRAINT "UQ_COMMUNITY_POST_SAVE_POST_USER" UNIQUE ("postId", "userId"),
                CONSTRAINT "FK_community_post_saves_post"     FOREIGN KEY ("postId") REFERENCES "community_posts" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_community_post_saves_user"     FOREIGN KEY ("userId") REFERENCES "users"           ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_SAVE_USER" ON "community_post_saves" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_POST_SAVE_POST" ON "community_post_saves" ("postId")`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "community_post_saves"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "community_post_comments"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "community_post_likes"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "community_post_media"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "community_posts"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "community_join_requests"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "community_members"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "communities"`);

        await queryRunner.query(`DROP TYPE IF EXISTS "community_post_media_mediatype_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "community_join_requests_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "community_members_role_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "communities_privacytype_enum"`);
    }
}
