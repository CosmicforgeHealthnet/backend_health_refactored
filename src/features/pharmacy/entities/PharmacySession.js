const { EntitySchema } = require("typeorm");

// SESSION_TIMEOUT_MINUTES: how long pharmacy has to build the cart before it expires
const SESSION_TIMEOUT_MINUTES = parseInt(process.env.SESSION_TIMEOUT_MINUTES || "30", 10);

module.exports = new EntitySchema({
    name: "PharmacySession",
    tableName: "pharmacy_sessions",
    columns: {
        id:             { primary: true, type: "uuid", generated: "uuid" },
        prescriptionId: { type: "uuid", nullable: false },
        pharmacyId:     { type: "uuid", nullable: false },
        patientId:      { type: "uuid", nullable: false },

        status: {
            type: "enum",
            enum: ["active", "cart_ready", "approved", "expired", "cancelled"],
            default: "active",
        },

        expiresAt: {
            type: "timestamp",
            nullable: false,
            comment: `Auto-expires ${SESSION_TIMEOUT_MINUTES} minutes after creation`,
        },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        prescription: {
            type: "many-to-one",
            target: "Prescription",
            joinColumn: { name: "prescriptionId" },
            onDelete: "CASCADE",
        },
        cart: {
            type: "one-to-one",
            target: "PrescriptionCart",
            inverseSide: "session",
            cascade: true,
        },
    },
    indices: [
        { columns: ["prescriptionId"] },
        { columns: ["pharmacyId"] },
        { columns: ["patientId"] },
        { columns: ["status"] },
        { columns: ["expiresAt"] },
    ],
});

module.exports.SESSION_TIMEOUT_MINUTES = SESSION_TIMEOUT_MINUTES;
