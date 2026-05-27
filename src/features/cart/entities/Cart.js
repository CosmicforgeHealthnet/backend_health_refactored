const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Cart",
    tableName: "carts",
    columns: {
        id:        { primary: true, type: "uuid", generated: "uuid" },
        patientId: { type: "uuid", nullable: false },
        vendorId:  { type: "uuid", nullable: false },

        status: {
            type: "enum",
            enum: ["draft", "submitted", "confirmed", "cancelled"],
            default: "draft",
        },

        patientNote:    { type: "text",    nullable: true, comment: "Message from patient to vendor" },
        vendorNote:     { type: "text",    nullable: true, comment: "Vendor response / pricing notes" },
        confirmedTotal: { type: "decimal", precision: 12, scale: 2, nullable: true, comment: "Total confirmed by vendor" },

        submittedAt:  { type: "timestamp", nullable: true },
        confirmedAt:  { type: "timestamp", nullable: true },
        cancelledAt:  { type: "timestamp", nullable: true },
        cancelledBy:  { type: "varchar",   nullable: true, comment: "patient or vendor" },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        items: {
            type: "one-to-many",
            target: "CartItem",
            inverseSide: "cart",
            cascade: true,
        },
        patient: {
            type: "many-to-one",
            target: "User",
            joinColumn: { name: "patientId" },
        },
        vendor: {
            type: "many-to-one",
            target: "VendorProfile",
            joinColumn: { name: "vendorId" },
        },
    },
    indices: [
        { columns: ["patientId"] },
        { columns: ["vendorId"] },
        { columns: ["status"] },
        { columns: ["patientId", "vendorId"] },
    ],
});
