const { EntitySchema } = require("typeorm");
const { ALL_CATEGORY_KEYS, ALL_SUBCATEGORY_KEYS } = require("../constants/productCategories");

module.exports = new EntitySchema({
    name: "Product",
    tableName: "products",
    columns: {
        id:       { primary: true, type: "uuid", generated: "uuid" },
        vendorId: { type: "uuid", nullable: false },

        title:       { type: "varchar", nullable: false },
        description: { type: "text",    nullable: false },

        price:         { type: "decimal", precision: 12, scale: 2, nullable: false },
        stockQuantity: { type: "int",     default: 0,               nullable: false },

        category: {
            type: "enum",
            enum: ALL_CATEGORY_KEYS,
            nullable: false,
        },
        subcategory: {
            type: "enum",
            enum: ALL_SUBCATEGORY_KEYS,
            nullable: false,
        },

        status: {
            type: "enum",
            enum: ["pending", "approved", "failed"],
            default: "pending",
        },
        rejectionReason: { type: "text", nullable: true },

        prescriptionRequired: { type: "boolean", default: false },

        isActive: { type: "boolean", default: true },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        vendor: {
            type: "many-to-one",
            target: "VendorProfile",
            joinColumn: { name: "vendorId" },
            onDelete: "CASCADE",
            inverseSide: "products",
        },
        media: {
            type: "one-to-many",
            target: "ProductMedia",
            inverseSide: "product",
            cascade: true,
        },
    },
    indices: [
        { columns: ["vendorId"] },
        { columns: ["category"] },
        { columns: ["subcategory"] },
        { columns: ["status"] },
        { columns: ["price"] },
        { columns: ["createdAt"] },
    ],
});
