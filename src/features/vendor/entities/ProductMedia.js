const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "ProductMedia",
    tableName: "product_media",
    columns: {
        id:        { primary: true, type: "uuid", generated: "uuid" },
        productId: { type: "uuid",    nullable: false },
        mediaUrl:  { type: "varchar", nullable: false },
        mediaType: {
            type: "enum",
            enum: ["image", "video"],
            default: "image",
        },
        isPrimary:  { type: "boolean", default: false },
        createdAt:  { type: "timestamp", createDate: true },
    },
    relations: {
        product: {
            type: "many-to-one",
            target: "Product",
            joinColumn: { name: "productId" },
            onDelete: "CASCADE",
            inverseSide: "media",
        },
    },
    indices: [
        { columns: ["productId"] },
        { columns: ["isPrimary"] },
    ],
});
