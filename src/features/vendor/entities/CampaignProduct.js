const { EntitySchema } = require("typeorm");
const { ALL_CATEGORY_KEYS } = require("../constants/productCategories");

module.exports = new EntitySchema({
    name: "CampaignProduct",
    tableName: "campaign_products",
    columns: {
        id:          { primary: true, type: "uuid", generated: "uuid" },
        promotionId: { type: "uuid", nullable: false },

        title:         { type: "varchar", nullable: false },
        category:      { type: "enum", enum: ALL_CATEGORY_KEYS, nullable: false },
        description:   { type: "text", nullable: false },
        price:         { type: "decimal", precision: 12, scale: 2, nullable: false },
        stockQuantity: { type: "int", default: 0 },

        // Media stored as JSON array of URLs — campaign products are independent of the main product catalog
        mediaUrls: { type: "json", nullable: true, comment: "Array of image/video URLs" },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        promotion: {
            type: "one-to-one",
            target: "Promotion",
            joinColumn: { name: "promotionId" },
            onDelete: "CASCADE",
            inverseSide: "campaignProduct",
        },
    },
    indices: [
        { columns: ["promotionId"] },
    ],
});
