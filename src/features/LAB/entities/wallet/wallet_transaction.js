// src/entities/WalletTransaction.js
const { EntitySchema } = require("typeorm");
const { TRANSACTION_TYPE, TRANSACTION_STATUS, PAYMENT_METHOD } = require("../../utils/constants");

module.exports = new EntitySchema({
  name: "LabWalletTransaction",
  tableName: "lab_wallet_transactions",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    transactionNumber: { type: "varchar", length: 20, unique: true }, // TXN-2024-001234
    
    // Wallet and User Information
    walletId: { type: "uuid", nullable: false },
    userId: { type: "uuid", nullable: false },
    
    // Transaction Details
    type: {
      type: "enum",
      enum: Object.values(TRANSACTION_TYPE),
      nullable: false
    },
    status: {
      type: "enum",
      enum: Object.values(TRANSACTION_STATUS),
      default: TRANSACTION_STATUS.PENDING
    },
    
    // Amount Information
    amount: { type: "decimal", precision: 12, scale: 2, nullable: false },
    fee: { type: "decimal", precision: 10, scale: 2, default: 0.00 },
    netAmount: { type: "decimal", precision: 12, scale: 2, nullable: false },
    currency: { type: "varchar", length: 3, default: "USD" },
    
    // Balance Tracking
    balanceBefore: { type: "decimal", precision: 12, scale: 2, nullable: false },
    balanceAfter: { type: "decimal", precision: 12, scale: 2, nullable: false },
    
    // Payment Information
    paymentMethod: {
      type: "enum",
      enum: Object.values(PAYMENT_METHOD),
      nullable: true
    },
    externalTransactionId: { type: "varchar", length: 100, nullable: true },
    externalReference: { type: "varchar", length: 100, nullable: true },
    
    // Related Entities
    orderId: { type: "uuid", nullable: true }, // For order payments
    facilityId: { type: "uuid", nullable: true }, // For facility transactions
    
    // Transaction Details
    description: { type: "text", nullable: false },
    metadata: { type: "json", nullable: true },
    notes: { type: "text", nullable: true },
    
    // Processing Information
    processedAt: { type: "timestamp", nullable: true },
    failureReason: { type: "text", nullable: true },
    retryCount: { type: "int", default: 0 },
    
    // Timestamps
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true }
  },
  
  relations: {
    wallet: {
      type: "many-to-one",
      target: "LabWallet",
      joinColumn: { name: "walletId", referencedColumnName: "id" },
      nullable: false
    },
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "userId", referencedColumnName: "id" },
      nullable: false
    },
    order: {
      type: "many-to-one",
      target: "LabOrder",
      joinColumn: { name: "orderId", referencedColumnName: "id" },
      nullable: true
    },
    facility: {
      type: "many-to-one",
      target: "LabFacility",
      joinColumn: { name: "facilityId", referencedColumnName: "id" },
      nullable: true
    }
  },
  
  indices: [
    { columns: ["transactionNumber"] },
    { columns: ["walletId"] },
    { columns: ["userId"] },
    { columns: ["type"] },
    { columns: ["status"] },
    { columns: ["orderId"] },
    { columns: ["facilityId"] },
    { columns: ["createdAt"] },
    { columns: ["externalTransactionId"] },
    { columns: ["walletId", "createdAt"] },
    { columns: ["userId", "type"] }
  ]
});
