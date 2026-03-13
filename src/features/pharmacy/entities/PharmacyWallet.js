const { EntitySchema } = require("typeorm");

/**
 * PharmacyWallet — one wallet per pharmacy.
 * All monetary values stored in USD (same pattern as DoctorWallet).
 * Displayed to pharmacy in their preferredDisplayCurrency.
 *
 * Escrow model:
 *  - Online payments credited to pendingClearanceUsd (held 1-3 business days)
 *  - After clearance window + no open dispute → moved to availableBalanceUsd
 *  - Cash/POS (mark-paid) credited directly to availableBalanceUsd (no hold)
 *  - Payouts deducted from availableBalanceUsd only
 */
module.exports = new EntitySchema({
  name: "PharmacyWallet",
  tableName: "pharmacy_wallets",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },

    pharmacyId: { type: "uuid", unique: true, nullable: false },

    // Balances — all in USD
    availableBalanceUsd: {
      type: "decimal", precision: 14, scale: 4, default: 0,
      comment: "Funds cleared from escrow and available for payout",
    },
    pendingClearanceUsd: {
      type: "decimal", precision: 14, scale: 4, default: 0,
      comment: "Online payment funds in 1-3 day escrow window",
    },
    totalEarningsUsd: {
      type: "decimal", precision: 14, scale: 4, default: 0,
      comment: "All-time gross earnings",
    },

    // Display preference
    preferredDisplayCurrency: {
      type: "varchar", length: 3, default: "USD",
      comment: "Currency shown to pharmacy staff (e.g. NGN)",
    },

    // Status
    isActive:    { type: "boolean", default: true },
    isFrozen:    { type: "boolean", default: false },
    frozenReason: { type: "varchar", length: 500, nullable: true },

    lastPayoutAt: { type: "timestamp", nullable: true },
    createdAt:    { type: "timestamp", createDate: true },
    updatedAt:    { type: "timestamp", updateDate: true },
  },
  relations: {
    pharmacy: {
      type: "one-to-one",
      target: "PharmacyProfile",
      joinColumn: { name: "pharmacyId" },
      onDelete: "CASCADE",
    },
    transactions: {
      type: "one-to-many",
      target: "PharmacyWalletTransaction",
      inverseSide: "wallet",
    },
    payouts: {
      type: "one-to-many",
      target: "PharmacyPayoutRequest",
      inverseSide: "wallet",
    },
    bankAccounts: {
      type: "one-to-many",
      target: "PharmacyBankAccount",
      inverseSide: "wallet",
    },
  },
  indices: [
    { columns: ["pharmacyId"] },
    { columns: ["isActive"] },
    { columns: ["isFrozen"] },
  ],
});
