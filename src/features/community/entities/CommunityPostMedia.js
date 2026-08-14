const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CommunityPostMedia",
    tableName: "community_post_media",
    columns: {
        id:        { primary: true, type: "uuid", generated: "uuid" },
        mediaUrl:  { type: "varchar", nullable: false },
        mediaType: { type: "enum", enum: ["image", "video"], default: "image" },
        order:     { type: "integer", default: 0 },
        createdAt: { type: "timestamp with time zone", createDate: true },
    },
    relations: {
        post: {
            type: "many-to-one",
            target: "CommunityPost",
            joinColumn: { name: "postId" },
            onDelete: "CASCADE",
            nullable: false,
            inverseSide: "media",
        },
    },
    indices: [
        { name: "IDX_COMMUNITY_POST_MEDIA_POST", columns: ["post"] },
    ],
});
