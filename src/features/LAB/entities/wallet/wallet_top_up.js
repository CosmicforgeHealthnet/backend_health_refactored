// src/entities/WalletTopUp.js
const { EntitySchema } = require("typeorm");
const { TOPUP_STATUS, PAYMENT_METHOD } = require("../../utils/constants");

module.exports = new EntitySchema({
  name: "LabWalletTopUp",
  tableName: "lab_wallet_topups",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    topupNumber: { type: "varchar", length: 20, unique: true }, // TOP-2024-001234
    
    // User and Wallet Information
    userId: { type: "uuid", nullable: false },
    walletId: { type: "uuid", nullable: false },
    
    // Top-up Details
    amount: { type: "decimal", precision: 10, scale: 2, nullable: false },
    currency: { type: "varchar", length: 3, default: "USD" },
    status: {
      type: "enum",
      enum: Object.values(TOPUP_STATUS),
      default: TOPUP_STATUS.PENDING
    },
    
    // Payment Information
    paymentMethod: {
      type: "enum",
      enum: Object.values(PAYMENT_METHOD),
      nullable: false
    },
    paymentIntentId: { type: "varchar", length: 100, nullable: true },
    paymentReference: { type: "varchar", length: 100, nullable: true },
    
    // Processing Information
    initiatedAt: { type: "timestamp", createDate: true },
    completedAt: { type: "timestamp", nullable: true },
    failedAt: { type: "timestamp", nullable: true },
    failureReason: { type: "text", nullable: true },
    
    // Metadata
    metadata: { type: "json", nullable: true },
    notes: { type: "text", nullable: true },
    
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
    wallet: {
      type: "many-to-one",
      target: "LabWallet",
      joinColumn: { name: "walletId", referencedColumnName: "id" },
      nullable: false
    },
    transaction: {
      type: "one-to-one",
      target: "LabWalletTransaction",
      joinColumn: { name: "transactionId" },
      nullable: true
    }
  },
  
  indices: [
    { columns: ["topupNumber"] },
    { columns: ["userId"] },
    { columns: ["walletId"] },
    { columns: ["status"] },
    { columns: ["paymentIntentId"] },
    { columns: ["createdAt"] }
  ]
});

