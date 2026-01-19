// src/entities/Wallet.js
const { EntitySchema } = require("typeorm");
const { WALLET_STATUS, WALLET_TYPE } = require("../../utils/constants");

module.exports = new EntitySchema({
  name: "LabWallet",
  tableName: "lab_wallets",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // Owner Information
    userId: { type: "uuid", nullable: false },
    facilityId: { type: "uuid", nullable: true }, // For facility wallets
    
    // Wallet Details
    walletType: {
      type: "enum",
      enum: Object.values(WALLET_TYPE),
      nullable: false
    },
    status: {
      type: "enum",
      enum: Object.values(WALLET_STATUS),
      default: WALLET_STATUS.ACTIVE
    },
    
    // Balance Information
    balance: { type: "decimal", precision: 12, scale: 2, default: 0.00 },
    pendingBalance: { type: "decimal", precision: 12, scale: 2, default: 0.00 },
    frozenBalance: { type: "decimal", precision: 12, scale: 2, default: 0.00 },
    currency: { type: "varchar", length: 3, default: "USD" },
    
    // Limits and Controls
    dailySpendLimit: { type: "decimal", precision: 10, scale: 2, nullable: true },
    monthlySpendLimit: { type: "decimal", precision: 10, scale: 2, nullable: true },
    minimumBalance: { type: "decimal", precision: 10, scale: 2, default: 0.00 },
    
    // Security
    pin: { type: "varchar", length: 255, nullable: true }, // Hashed PIN
    pinAttempts: { type: "int", default: 0 },
    lockedUntil: { type: "timestamp", nullable: true },
    
    // Metadata
    lastTransactionAt: { type: "timestamp", nullable: true },
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true }
  },
  
  relations: {
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "userId", referencedColumnName: "id" },
      nullable: false
    },
    facility: {
      type: "many-to-one",
      target: "LabFacility",
      joinColumn: { name: "facilityId", referencedColumnName: "id" },
      nullable: true
    },
    transactions: {
      type: "one-to-many",
      target: "LabWalletTransaction",
      inverseSide: "wallet"
    }
  },
  
  indices: [
    { columns: ["userId"], unique: true }, // One wallet per user for now
    { columns: ["facilityId"] },
    { columns: ["walletType"] },
    { columns: ["status"] },
    { columns: ["userId", "walletType"] }
  ]
});
