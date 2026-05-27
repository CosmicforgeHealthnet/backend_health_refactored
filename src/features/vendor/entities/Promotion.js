const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "Promotion",
    tableName: "promotions",
    columns: {
        id:       { primary: true, type: "uuid", generated: "uuid" },
        vendorId: { type: "uuid", nullable: false },

        type: {
            type: "enum",
            enum: ["boost_account", "get_sales", "campaign"],
            nullable: false,
        },
        subType: {
            type: "varchar",
            nullable: true,
            comment: "e.g. profile_visibility_boost, more_product_visibility, discounted_sales",
        },

        title: { type: "varchar", nullable: false, comment: "Display name for this promotion" },

        duration: {
            type: "enum",
            enum: ["one_day", "one_week", "one_month", "custom"],
            nullable: false,
        },
        customDays: { type: "int", nullable: true, comment: "Only used when duration is custom" },

        startDate: { type: "timestamp", nullable: true },
        endDate:   { type: "timestamp", nullable: true },

        status: {
            type: "enum",
            enum: ["pending", "active", "completed", "cancelled", "failed"],
            default: "pending",
        },

        pricePaid:         { type: "decimal", precision: 12, scale: 2, nullable: false },
        paymentStatus:     { type: "enum", enum: ["pending", "paid", "failed"], default: "pending" },
        paymentReference:  { type: "varchar", nullable: true },
        paymentAuthUrl:    { type: "varchar", nullable: true },
        paymentProvider:   { type: "varchar", nullable: true, comment: "paystack or flutterwave" },

        termsAccepted: { type: "boolean", default: false },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        vendor: {
            type: "many-to-one",
            target: "VendorProfile",
            joinColumn: { name: "vendorId" },
            onDelete: "CASCADE",
        },
        promotionProducts: {
            type: "one-to-many",
            target: "PromotionProduct",
            inverseSide: "promotion",
            cascade: true,
        },
        campaignProduct: {
            type: "one-to-one",
            target: "CampaignProduct",
            inverseSide: "promotion",
            cascade: true,
        },
    },
    indices: [
        { columns: ["vendorId"] },
        { columns: ["type"] },
        { columns: ["status"] },
        { columns: ["paymentStatus"] },
        { columns: ["paymentReference"] },
        { columns: ["endDate"] },
    ],
});
