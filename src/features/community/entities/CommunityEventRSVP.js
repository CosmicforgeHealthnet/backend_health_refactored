const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CommunityEventRSVP",
    tableName: "community_event_rsvps",
    columns: {
        id:              { primary: true, type: "uuid", generated: "uuid" },
        remindMe:        { type: "boolean", default: true },
        reminderSentAt:  { type: "timestamp with time zone", nullable: true },
        createdAt:       { type: "timestamp with time zone", createDate: true },
    },
    relations: {
        event: {
            type: "many-to-one",
            target: "CommunityEvent",
            joinColumn: { name: "eventId" },
            onDelete: "CASCADE",
            nullable: false,
            inverseSide: "rsvps",
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
        { name: "UQ_COMMUNITY_EVENT_RSVP_EVENT_USER", columns: ["event", "user"] },
    ],
    indices: [
        { name: "IDX_COMMUNITY_EVENT_RSVP_EVENT", columns: ["event"] },
        { name: "IDX_COMMUNITY_EVENT_RSVP_USER", columns: ["user"] },
        { name: "IDX_COMMUNITY_EVENT_RSVP_REMIND_ME", columns: ["remindMe"] },
    ],
});
