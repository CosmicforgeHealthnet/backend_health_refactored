const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "AppFeedback",
    tableName: "app_feedback",
    columns: {
        id: { primary: true, type: "uuid", generated: "uuid" },
        authorId: { type: "uuid" },
        role: { type: "varchar", length: 20 },
        experience: { type: "varchar", length: 30 },
        troubleAreas: { type: "jsonb", default: () => "'[]'::jsonb" },
        comment: { type: "text", nullable: true },
        createdAt: { type: "timestamp", createDate: true },
    },
    indices: [{ name: "IDX_APP_FEEDBACK_AUTHOR", columns: ["authorId"] }],
});
