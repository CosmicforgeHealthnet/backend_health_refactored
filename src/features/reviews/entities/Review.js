const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Review",
    tableName: "reviews",
    columns: {
        id:            { primary: true, type: "uuid", generated: "uuid" },
        appointmentId: { type: "uuid", nullable: false },
        authorId:      { type: "uuid", nullable: false },
        targetId:      { type: "uuid", nullable: false },

        direction: {
            type: "enum",
            enum: ["patient_to_doctor", "doctor_to_patient"],
            nullable: false,
        },

        rating:  { type: "decimal", precision: 2, scale: 1, nullable: false },
        comment: { type: "text", nullable: true, comment: "Free text — about the consultation, the other party, or the app itself" },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        appointment: {
            type: "many-to-one",
            target: "Appointment",
            joinColumn: { name: "appointmentId" },
            onDelete: "CASCADE",
        },
        author: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "authorId" },
        },
        target: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "targetId" },
        },
    },
    indices: [
        { columns: ["appointmentId", "direction"], unique: true },
        { columns: ["targetId"] },
        { columns: ["authorId"] },
    ],
});
