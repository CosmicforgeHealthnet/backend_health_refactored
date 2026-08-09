const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "CommunityVoiceSpaceParticipant",
    tableName: "community_voice_space_participants",
    columns: {
        id:          { primary: true, type: "uuid", generated: "uuid" },
        role:        { type: "enum", enum: ["host", "speaker", "listener"], default: "listener" },
        handRaised:  { type: "boolean", default: false },
        isActive:    { type: "boolean", default: true },
        joinedAt:    { type: "timestamp with time zone", nullable: true },
        leftAt:      { type: "timestamp with time zone", nullable: true },
        createdAt:   { type: "timestamp with time zone", createDate: true },
        updatedAt:   { type: "timestamp with time zone", updateDate: true },
    },
    relations: {
        space: {
            type: "many-to-one",
            target: "CommunityVoiceSpace",
            joinColumn: { name: "spaceId" },
            onDelete: "CASCADE",
            nullable: false,
            inverseSide: "participants",
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
        { name: "UQ_COMMUNITY_VOICE_SPACE_PARTICIPANT_SPACE_USER", columns: ["space", "user"] },
    ],
    indices: [
        { name: "IDX_COMMUNITY_VOICE_SPACE_PARTICIPANT_SPACE", columns: ["space"] },
        { name: "IDX_COMMUNITY_VOICE_SPACE_PARTICIPANT_USER", columns: ["user"] },
        { name: "IDX_COMMUNITY_VOICE_SPACE_PARTICIPANT_SPACE_ROLE", columns: ["space", "role"] },
    ],
});
