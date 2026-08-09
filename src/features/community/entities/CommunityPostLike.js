const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CommunityPostLike",
    tableName: "community_post_likes",
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
            inverseSide: "likes",
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
        { name: "UQ_COMMUNITY_POST_LIKE_POST_USER", columns: ["post", "user"] },
    ],
    indices: [
        { name: "IDX_COMMUNITY_POST_LIKE_POST", columns: ["post"] },
        { name: "IDX_COMMUNITY_POST_LIKE_USER", columns: ["user"] },
    ],
});
