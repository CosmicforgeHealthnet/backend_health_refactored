const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CommunityJoinRequest",
    tableName: "community_join_requests",
    columns: {
        id:               { primary: true, type: "uuid", generated: "uuid" },
        status:           { type: "enum", enum: ["pending", "approved", "rejected"], default: "pending" },
        message:          { type: "text", nullable: true },
        rejectionReason:  { type: "text", nullable: true },
        reviewedAt:       { type: "timestamp with time zone", nullable: true },
        createdAt:        { type: "timestamp with time zone", createDate: true },
        updatedAt:        { type: "timestamp with time zone", updateDate: true },
    },
    relations: {
        community: {
            type: "many-to-one",
            target: "Community",
            joinColumn: { name: "communityId" },
            onDelete: "CASCADE",
            nullable: false,
            inverseSide: "joinRequests",
        },
        user: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "userId" },
            onDelete: "CASCADE",
            nullable: false,
        },
        reviewedBy: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "reviewedById" },
            onDelete: "SET NULL",
            nullable: true,
        },
    },
    indices: [
        { name: "IDX_COMMUNITY_JOIN_REQUEST_COMMUNITY", columns: ["community"] },
        { name: "IDX_COMMUNITY_JOIN_REQUEST_USER", columns: ["user"] },
        { name: "IDX_COMMUNITY_JOIN_REQUEST_COMMUNITY_STATUS", columns: ["community", "status"] },
    ],
});
