const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "VendorWalletTransaction",
    tableName: "vendor_wallet_transactions",
    columns: {
        id:       { primary: true, type: "uuid", generated: "uuid" },
        walletId: { type: "uuid", nullable: false },
        vendorId: { type: "uuid", nullable: false },

        type: {
            type: "enum",
            enum: ["credit", "debit"],
            nullable: false,
        },
        category: {
            type: "enum",
            enum: ["order_payment", "payout", "refund", "adjustment"],
            nullable: false,
        },
        status: {
            type: "enum",
            enum: ["completed", "pending", "failed"],
            default: "completed",
        },

        amountNgn:      { type: "decimal", precision: 14, scale: 4, nullable: false },
        balanceAfterNgn: { type: "decimal", precision: 14, scale: 4, nullable: false },

        orderId:     { type: "uuid", nullable: true },
        reference:   { type: "varchar", nullable: true },
        description: { type: "text", nullable: false },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        wallet: {
            type: "many-to-one",
            target: "VendorWallet",
            joinColumn: { name: "walletId" },
            onDelete: "CASCADE",
            inverseSide: "transactions",
        },
    },
    indices: [
        { columns: ["walletId"] },
        { columns: ["vendorId"] },
        { columns: ["orderId"] },
        { columns: ["type"] },
        { columns: ["category"] },
        { columns: ["createdAt"] },
    ],
});
