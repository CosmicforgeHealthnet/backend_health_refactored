const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "PrescriptionCart",
    tableName: "prescription_carts",
    columns: {
        id:             { primary: true, type: "uuid", generated: "uuid" },
        sessionId:      { type: "uuid", nullable: false, unique: true },
        prescriptionId: { type: "uuid", nullable: false },
        pharmacyId:     { type: "uuid", nullable: false },
        patientId:      { type: "uuid", nullable: false },

        status: {
            type: "enum",
            enum: ["building", "ready", "approved"],
            default: "building",
        },

        // Amounts stored in NGN (what patient sees)
        totalAmountNgn:    { type: "decimal", precision: 14, scale: 4, nullable: true },
        platformFeeNgn:    { type: "decimal", precision: 14, scale: 4, nullable: true },
        pharmacyAmountNgn: { type: "decimal", precision: 14, scale: 4, nullable: true },
        currency:          { type: "varchar", length: 10, default: "NGN" },

        // USD amounts set at payment time (for pharmacy wallet credit)
        totalAmountUsd:    { type: "decimal", precision: 14, scale: 6, nullable: true },
        platformFeeUsd:    { type: "decimal", precision: 14, scale: 6, nullable: true },
        pharmacyAmountUsd: { type: "decimal", precision: 14, scale: 6, nullable: true },
        exchangeRateToUsd: { type: "decimal", precision: 14, scale: 6, nullable: true },

        paymentStatus: {
            type: "enum",
            enum: ["unpaid", "paid", "refunded"],
            default: "unpaid",
        },
        paymentReference: { type: "varchar", nullable: true },
        paymentProvider:  { type: "varchar", nullable: true },
        paymentAuthUrl:   { type: "varchar", nullable: true },
        paidAt:           { type: "timestamp", nullable: true },

        pharmacyNote: { type: "text", nullable: true },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        session: {
            type: "one-to-one",
            target: "PharmacySession",
            joinColumn: { name: "sessionId" },
            onDelete: "CASCADE",
            inverseSide: "cart",
        },
        items: {
            type: "one-to-many",
            target: "PrescriptionCartItem",
            inverseSide: "cart",
            cascade: true,
        },
    },
    indices: [
        { columns: ["sessionId"] },
        { columns: ["prescriptionId"] },
        { columns: ["pharmacyId"] },
        { columns: ["patientId"] },
        { columns: ["paymentStatus"] },
    ],
});
