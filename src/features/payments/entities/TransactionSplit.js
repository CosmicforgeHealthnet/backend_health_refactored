// src/entities/Payment/TransactionSplit.js
const { EntitySchema } = require("typeorm");

const SplitType = {
  APPOINTMENT_FEE: "appointment_fee",
  SERVICE_FEE: "service_fee",
  VAT: "vat"
};

const RecipientType = {
  DOCTOR_WALLET: "doctor_wallet",
  COMPANY_WALLET: "company_wallet"
};

const SplitStatus = {
  PENDING: "pending",
  RELEASED: "released",
  REFUNDED: "refunded",
  HELD: "held"
};

module.exports = new EntitySchema({
  name: "TransactionSplit",
  tableName: "transaction_splits",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // References
    transactionId: { type: "uuid", nullable: false },
    
    // Split details
    type: {
      type: "enum",
      enum: Object.values(SplitType),
      nullable: false
    },
    
    // Multi-currency amounts
    originalAmount: { 
      type: "decimal", 
      precision: 10, 
      scale: 2,
      nullable: false
    },
    originalCurrency: { type: "varchar", length: 3, nullable: false },
    usdAmount: { 
      type: "decimal", 
      precision: 10, 
      scale: 2,
      nullable: false
    },
    
    // Routing information
    recipientType: {
      type: "enum",
      enum: Object.values(RecipientType),
      nullable: false
    },
    recipientId: { 
      type: "uuid", 
      nullable: true,
      comment: "Doctor ID for doctor_wallet, null for company_wallet"
    },
    
    // Status tracking
    status: {
      type: "enum",
      enum: Object.values(SplitStatus),
      default: SplitStatus.PENDING
    },
    
    // Timestamps
    createdAt: { type: "timestamp", createDate: true },
    releasedAt: { type: "timestamp", nullable: true },
    refundedAt: { type: "timestamp", nullable: true }
  },
  relations: {
    transaction: {
      type: "many-to-one",
      target: "Transaction",
      onDelete: "CASCADE",
      joinColumn: { name: "transactionId" }
    }
  },
  indices: [
    { columns: ["transactionId"] },
    { columns: ["type"] },
    { columns: ["recipientType"] },
    { columns: ["status"] }
  ]
});
