const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CommunityInvite",
    tableName: "community_invites",
    columns: {
        id:          { primary: true, type: "uuid", generated: "uuid" },
        status:      { type: "enum", enum: ["pending", "accepted", "declined", "cancelled"], default: "pending" },
        message:     { type: "text", nullable: true },
        respondedAt: { type: "timestamp with time zone", nullable: true },
        createdAt:   { type: "timestamp with time zone", createDate: true },
        updatedAt:   { type: "timestamp with time zone", updateDate: true },
    },
    relations: {
        community: {
            type: "many-to-one",
            target: "Community",
            joinColumn: { name: "communityId" },
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
        invitee: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "inviteeId" },
            onDelete: "CASCADE",
            nullable: false,
        },
    },
    indices: [
        { name: "IDX_COMMUNITY_INVITE_COMMUNITY", columns: ["community"] },
        { name: "IDX_COMMUNITY_INVITE_INVITEE", columns: ["invitee"] },
        { name: "IDX_COMMUNITY_INVITE_COMMUNITY_STATUS", columns: ["community", "status"] },
        { name: "IDX_COMMUNITY_INVITE_INVITEE_STATUS", columns: ["invitee", "status"] },
    ],
});
