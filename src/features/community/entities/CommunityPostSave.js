const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CommunityPostSave",
    tableName: "community_post_saves",
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
            inverseSide: "saves",
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
        { name: "UQ_COMMUNITY_POST_SAVE_POST_USER", columns: ["post", "user"] },
    ],
    indices: [
        { name: "IDX_COMMUNITY_POST_SAVE_USER", columns: ["user"] },
        { name: "IDX_COMMUNITY_POST_SAVE_POST", columns: ["post"] },
    ],
});
