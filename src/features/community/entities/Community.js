const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Community",
    tableName: "communities",
    columns: {
        id:            { primary: true, type: "uuid", generated: "uuid" },
        name:          { type: "varchar", nullable: false },
        slug:          { type: "varchar", nullable: false },
        description:   { type: "text", nullable: true },
        category:      { type: "varchar", nullable: true },
        tags:          { type: "jsonb", nullable: true },
        privacyType:   { type: "enum", enum: ["public", "private"], default: "public" },
        bannerUrl:     { type: "varchar", nullable: true },
        avatarUrl:     { type: "varchar", nullable: true },
        rules:         { type: "jsonb", nullable: true },
        memberCount:   { type: "integer", default: 0 },
        postCount:     { type: "integer", default: 0 },
        isActive:      { type: "boolean", default: true },
        createdAt:     { type: "timestamp with time zone", createDate: true },
        updatedAt:     { type: "timestamp with time zone", updateDate: true },
        deletedAt:     { type: "timestamp with time zone", nullable: true },
    },
    relations: {
        createdBy: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "createdById" },
            onDelete: "SET NULL",
            nullable: true,
        },
        members: {
            type: "one-to-many",
            target: "CommunityMember",
            inverseSide: "community",
        },
        posts: {
            type: "one-to-many",
            target: "CommunityPost",
            inverseSide: "community",
        },
        joinRequests: {
            type: "one-to-many",
            target: "CommunityJoinRequest",
            inverseSide: "community",
        },
        chatRoom: {
            type: "one-to-one",
            target: "ChatRoom",
            joinColumn: { name: "chatRoomId" },
            onDelete: "SET NULL",
            nullable: true,
        },
    },
    uniques: [
        { name: "UQ_COMMUNITY_SLUG", columns: ["slug"] },
    ],
    indices: [
        { name: "IDX_COMMUNITY_PRIVACY_TYPE", columns: ["privacyType"] },
        { name: "IDX_COMMUNITY_CATEGORY", columns: ["category"] },
        { name: "IDX_COMMUNITY_CREATED_BY", columns: ["createdBy"] },
        { name: "IDX_COMMUNITY_IS_ACTIVE", columns: ["isActive"] },
        { name: "IDX_COMMUNITY_CHAT_ROOM", columns: ["chatRoom"] },
    ],
});
