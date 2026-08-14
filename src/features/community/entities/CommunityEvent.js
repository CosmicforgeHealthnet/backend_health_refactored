const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CommunityEvent",
    tableName: "community_events",
    columns: {
        id:            { primary: true, type: "uuid", generated: "uuid" },
        title:         { type: "varchar", nullable: false },
        description:   { type: "text", nullable: true },
        startAt:       { type: "timestamp with time zone", nullable: false },
        coverImageUrl: { type: "varchar", nullable: true },
        status:        { type: "enum", enum: ["draft", "published"], default: "draft" },
        guestCount:    { type: "integer", default: 0 },
        isDeleted:     { type: "boolean", default: false },
        deletedAt:     { type: "timestamp with time zone", nullable: true },
        createdAt:     { type: "timestamp with time zone", createDate: true },
        updatedAt:     { type: "timestamp with time zone", updateDate: true },
    },
    relations: {
        community: {
            type: "many-to-one",
            target: "Community",
            joinColumn: { name: "communityId" },
            onDelete: "CASCADE",
            nullable: false,
        },
        createdBy: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "createdById" },
            onDelete: "SET NULL",
            nullable: true,
        },
        rsvps: {
            type: "one-to-many",
            target: "CommunityEventRSVP",
            inverseSide: "event",
        },
    },
    indices: [
        { name: "IDX_COMMUNITY_EVENT_COMMUNITY", columns: ["community"] },
        { name: "IDX_COMMUNITY_EVENT_STATUS", columns: ["status"] },
        { name: "IDX_COMMUNITY_EVENT_START_AT", columns: ["startAt"] },
        { name: "IDX_COMMUNITY_EVENT_COMMUNITY_START_AT", columns: ["community", "startAt"] },
        { name: "IDX_COMMUNITY_EVENT_IS_DELETED", columns: ["isDeleted"] },
    ],
});
