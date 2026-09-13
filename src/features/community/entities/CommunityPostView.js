const { EntitySchema } = require("typeorm");

// One row per (post, user) — caps a post's viewCount to increment at most once
// per viewer, no matter how many times they open the post or ping the view endpoint.
module.exports = new EntitySchema({
    name: "CommunityPostView",
    tableName: "community_post_views",
    columns: {
        id:        { primary: true, type: "uuid", generated: "uuid" },
        createdAt: { type: "timestamp with time zone", createDate: true },
    },
    relations: {
        post: {
            type: "many-to-one",
            target: "CommunityPost",
            joinColumn: { name: "postId" },
            onDelete: "CASCADE",
            nullable: false,
            inverseSide: "views",
        },
        user: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "userId" },
            onDelete: "CASCADE",
            nullable: false,
        },
    },
    uniques: [
        { name: "UQ_COMMUNITY_POST_VIEW_POST_USER", columns: ["post", "user"] },
    ],
    indices: [
        { name: "IDX_COMMUNITY_POST_VIEW_POST", columns: ["post"] },
        { name: "IDX_COMMUNITY_POST_VIEW_USER", columns: ["user"] },
    ],
});
