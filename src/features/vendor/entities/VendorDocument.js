const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "VendorDocument",
    tableName: "vendor_documents",
    columns: {
        id: { primary: true, type: "uuid", generated: "uuid" },
        vendorId: { type: "uuid", nullable: false },

        documentType: {
            type: "enum",
            enum: ["government_id", "business_registration"],
            nullable: false,
        },
        documentUrl: { type: "varchar", nullable: false },
        fileName:    { type: "varchar", nullable: true },
        mimeType:    { type: "varchar", nullable: true },

        verificationStatus: {
            type: "enum",
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        vendor: {
            type: "many-to-one",
            target: "VendorProfile",
            joinColumn: { name: "vendorId" },
            onDelete: "CASCADE",
            inverseSide: "documents",
        },
    },
    indices: [
        { columns: ["vendorId"] },
        { columns: ["verificationStatus"] },
    ],
});
