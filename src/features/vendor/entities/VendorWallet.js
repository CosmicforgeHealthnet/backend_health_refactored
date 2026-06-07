const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "VendorWallet",
    tableName: "vendor_wallets",
    columns: {
        id:       { primary: true, type: "uuid", generated: "uuid" },
        vendorId: { type: "uuid", nullable: false, unique: true },

        availableBalanceNgn:   { type: "decimal", precision: 14, scale: 4, default: 0 },
        pendingClearanceNgn:   { type: "decimal", precision: 14, scale: 4, default: 0 },
        totalEarningsNgn:      { type: "decimal", precision: 14, scale: 4, default: 0 },

        isActive:    { type: "boolean", default: true },
        isFrozen:    { type: "boolean", default: false },
        frozenReason: { type: "text", nullable: true },

        lastPayoutAt: { type: "timestamp", nullable: true },

        createdAt: { type: "timestamp", createDate: true },
        updatedAt: { type: "timestamp", updateDate: true },
    },
    relations: {
        vendor: {
            type: "one-to-one",
            target: "VendorProfile",
            joinColumn: { name: "vendorId" },
            onDelete: "CASCADE",
        },
        transactions: {
            type: "one-to-many",
            target: "VendorWalletTransaction",
            inverseSide: "wallet",
            cascade: true,
        },
    },
    indices: [
        { columns: ["vendorId"] },
    ],
});
