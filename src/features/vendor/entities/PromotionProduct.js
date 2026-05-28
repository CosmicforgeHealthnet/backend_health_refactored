const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "PromotionProduct",
    tableName: "promotion_products",
    columns: {
        id:          { primary: true, type: "uuid", generated: "uuid" },
        promotionId: { type: "uuid", nullable: false },
        productId:   { type: "uuid", nullable: false },
        createdAt:   { type: "timestamp", createDate: true },
    },
    relations: {
        promotion: {
            type: "many-to-one",
            target: "Promotion",
            joinColumn: { name: "promotionId" },
            onDelete: "CASCADE",
            inverseSide: "promotionProducts",
        },
        product: {
            type: "many-to-one",
            target: "Product",
            joinColumn: { name: "productId" },
        },
    },
    indices: [
        { columns: ["promotionId"] },
        { columns: ["productId"] },
    ],
});
