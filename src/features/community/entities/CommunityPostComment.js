const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CommunityPostComment",
    tableName: "community_post_comments",
    columns: {
        id:        { primary: true, type: "uuid", generated: "uuid" },
        content:   { type: "text", nullable: false },
        isDeleted: { type: "boolean", default: false },
        deletedAt: { type: "timestamp with time zone", nullable: true },
        createdAt: { type: "timestamp with time zone", createDate: true },
        updatedAt: { type: "timestamp with time zone", updateDate: true },
    },
    relations: {
        post: {
            type: "many-to-one",
            target: "CommunityPost",
            joinColumn: { name: "postId" },
            onDelete: "CASCADE",
            nullable: false,
            inverseSide: "comments",
        },
        author: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "authorId" },
            onDelete: "CASCADE",
            nullable: false,
        },
        parentComment: {
            type: "many-to-one",
            target: "CommunityPostComment",
            joinColumn: { name: "parentCommentId" },
            onDelete: "CASCADE",
            nullable: true,
        },
    },
    indices: [
        { name: "IDX_COMMUNITY_POST_COMMENT_POST", columns: ["post"] },
        { name: "IDX_COMMUNITY_POST_COMMENT_AUTHOR", columns: ["author"] },
        { name: "IDX_COMMUNITY_POST_COMMENT_POST_CREATED_AT", columns: ["post", "createdAt"] },
    ],
});
