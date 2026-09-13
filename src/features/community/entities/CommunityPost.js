const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CommunityPost",
    tableName: "community_posts",
    columns: {
        id:           { primary: true, type: "uuid", generated: "uuid" },
        content:      { type: "text", nullable: true },
        likeCount:    { type: "integer", default: 0 },
        commentCount: { type: "integer", default: 0 },
        viewCount:    { type: "integer", default: 0 },
        isDeleted:    { type: "boolean", default: false },
        deletedAt:    { type: "timestamp with time zone", nullable: true },
        createdAt:    { type: "timestamp with time zone", createDate: true },
        updatedAt:    { type: "timestamp with time zone", updateDate: true },
    },
    relations: {
        community: {
            type: "many-to-one",
            target: "Community",
            joinColumn: { name: "communityId" },
            onDelete: "CASCADE",
            nullable: false,
            inverseSide: "posts",
        },
        author: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "authorId" },
            onDelete: "CASCADE",
            nullable: false,
        },
        deletedBy: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "deletedById" },
            onDelete: "SET NULL",
            nullable: true,
        },
        media: {
            type: "one-to-many",
            target: "CommunityPostMedia",
            inverseSide: "post",
        },
        comments: {
            type: "one-to-many",
            target: "CommunityPostComment",
            inverseSide: "post",
        },
        likes: {
            type: "one-to-many",
            target: "CommunityPostLike",
            inverseSide: "post",
        },
        saves: {
            type: "one-to-many",
            target: "CommunityPostSave",
            inverseSide: "post",
        },
        views: {
            type: "one-to-many",
            target: "CommunityPostView",
            inverseSide: "post",
        },
    },
    indices: [
        { name: "IDX_COMMUNITY_POST_COMMUNITY", columns: ["community"] },
        { name: "IDX_COMMUNITY_POST_AUTHOR", columns: ["author"] },
        { name: "IDX_COMMUNITY_POST_COMMUNITY_CREATED_AT", columns: ["community", "createdAt"] },
        { name: "IDX_COMMUNITY_POST_IS_DELETED", columns: ["isDeleted"] },
    ],
});
