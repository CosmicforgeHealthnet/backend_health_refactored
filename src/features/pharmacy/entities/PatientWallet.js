const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "PatientWallet",
  tableName: "patient_wallets",
  columns: {
    id:        { primary: true, type: "uuid", generated: "uuid" },
    patientId: { type: "uuid", unique: true, nullable: false },

    // All amounts stored in USD
    balanceUsd:     { type: "decimal", precision: 14, scale: 4, default: 0, comment: "Current available balance" },
    totalSpentUsd:  { type: "decimal", precision: 14, scale: 4, default: 0, comment: "All-time spending" },
    totalTopUpsUsd: { type: "decimal", precision: 14, scale: 4, default: 0, comment: "All-time top-ups credited" },

    preferredDisplayCurrency: { type: "varchar", length: 3, default: "USD" },

    isActive:  { type: "boolean", default: true },
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
  },
  relations: {
    patient: {
      type: "one-to-one",
      target: "User",
      joinColumn: { name: "patientId" },
      onDelete: "CASCADE",
    },
    transactions: {
      type: "one-to-many",
      target: "PatientWalletTransaction",
      inverseSide: "wallet",
    },
  },
  indices: [{ columns: ["patientId"] }],
});
