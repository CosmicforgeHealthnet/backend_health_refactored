const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CommunityMember",
    tableName: "community_members",
    columns: {
        id:        { primary: true, type: "uuid", generated: "uuid" },
        role:      {
            type: "enum",
            enum: ["owner", "admin", "moderator", "member", "pending_member"],
            default: "pending_member",
        },
        isActive:  { type: "boolean", default: true },
        joinedAt:  { type: "timestamp with time zone", nullable: true },
        leftAt:    { type: "timestamp with time zone", nullable: true },
        metadata:  { type: "jsonb", nullable: true },
        createdAt: { type: "timestamp with time zone", createDate: true },
        updatedAt: { type: "timestamp with time zone", updateDate: true },
    },
    relations: {
        community: {
            type: "many-to-one",
            target: "Community",
            joinColumn: { name: "communityId" },
            onDelete: "CASCADE",
            nullable: false,
            inverseSide: "members",
        },
        user: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "userId" },
            onDelete: "CASCADE",
            nullable: false,
        },
        invitedBy: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "invitedById" },
            onDelete: "SET NULL",
            nullable: true,
        },
    },
    uniques: [
        { name: "UQ_COMMUNITY_MEMBER_USER_COMMUNITY", columns: ["user", "community"] },
    ],
    indices: [
        { name: "IDX_COMMUNITY_MEMBER_COMMUNITY", columns: ["community"] },
        { name: "IDX_COMMUNITY_MEMBER_USER", columns: ["user"] },
        { name: "IDX_COMMUNITY_MEMBER_COMMUNITY_ROLE", columns: ["community", "role"] },
    ],
});
