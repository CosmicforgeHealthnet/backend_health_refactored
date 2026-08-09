const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CommunityVoiceSpace",
    tableName: "community_voice_spaces",
    columns: {
        id:            { primary: true, type: "uuid", generated: "uuid" },
        title:         { type: "varchar", nullable: false },
        status:        { type: "enum", enum: ["live", "ended"], default: "live" },
        provider:      { type: "varchar", default: "zoom" },
        zoomMeetingId: { type: "varchar", nullable: true },
        joinUrl:       { type: "varchar", nullable: true },
        hostStartUrl:  { type: "varchar", nullable: true, comment: "Host-only Zoom start link — never expose to non-host viewers" },
        endedAt:       { type: "timestamp with time zone", nullable: true },
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
        host: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "hostId" },
            onDelete: "SET NULL",
            nullable: true,
        },
        participants: {
            type: "one-to-many",
            target: "CommunityVoiceSpaceParticipant",
            inverseSide: "space",
        },
    },
    indices: [
        { name: "IDX_COMMUNITY_VOICE_SPACE_COMMUNITY", columns: ["community"] },
        { name: "IDX_COMMUNITY_VOICE_SPACE_STATUS", columns: ["status"] },
        { name: "IDX_COMMUNITY_VOICE_SPACE_COMMUNITY_STATUS", columns: ["community", "status"] },
    ],
});
