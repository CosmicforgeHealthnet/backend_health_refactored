const { EntitySchema } = require("typeorm");

const WalletTransactionType = {
  CREDIT: "credit",
  DEBIT:  "debit",
};

const WalletTransactionStatus = {
  COMPLETED:  "completed",
  PENDING:    "pending",     // In escrow clearance
  PROCESSING: "processing",  // In-flight payout
  FAILED:     "failed",
  REVERSED:   "reversed",
};

const WalletTransactionCategory = {
  INVOICE_PAYMENT:   "invoice_payment",
  PAYOUT:            "payout",
  REFUND:            "refund",
  DISPUTE_REVERSAL:  "dispute_reversal",
  ADJUSTMENT:        "adjustment",
};

const WalletTransactionSchema = new EntitySchema({
  name: "PharmacyWalletTransaction",
  tableName: "pharmacy_wallet_transactions",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },

    walletId:   { type: "uuid", nullable: false },
    pharmacyId: { type: "uuid", nullable: false },

    type: {
      type: "enum",
      enum: Object.values(WalletTransactionType),
      nullable: false,
    },
    status: {
      type: "enum",
      enum: Object.values(WalletTransactionStatus),
      default: WalletTransactionStatus.PENDING,
      nullable: false,
    },
    category: {
      type: "enum",
      enum: Object.values(WalletTransactionCategory),
      nullable: false,
    },

    // Amounts in USD
    amountUsd:       { type: "decimal", precision: 14, scale: 4, nullable: false },
    balanceAfterUsd: { type: "decimal", precision: 14, scale: 4, nullable: false },

    description: { type: "varchar", length: 500, nullable: false },
    reference:   { type: "varchar", length: 100, nullable: false },

    // Optional links
    invoiceId:       { type: "uuid", nullable: true },
    invoiceRef:      { type: "varchar", length: 30, nullable: true },
    patientId:       { type: "uuid", nullable: true },
    prescriptionId:  { type: "uuid", nullable: true },
    payoutRequestId: { type: "uuid", nullable: true },

    settledAt:  { type: "timestamp", nullable: true },
    createdAt:  { type: "timestamp", createDate: true },
    updatedAt:  { type: "timestamp", updateDate: true },
  },
  relations: {
    wallet: {
      type: "many-to-one",
      target: "PharmacyWallet",
      joinColumn: { name: "walletId" },
      onDelete: "CASCADE",
      inverseSide: "transactions",
    },
  },
  indices: [
    { columns: ["walletId"] },
    { columns: ["pharmacyId"] },
    { columns: ["type"] },
    { columns: ["status"] },
    { columns: ["category"] },
    { columns: ["reference"] },
    { columns: ["invoiceId"] },
    { columns: ["createdAt"] },
  ],
});

WalletTransactionSchema.WalletTransactionType = WalletTransactionType;
WalletTransactionSchema.WalletTransactionStatus = WalletTransactionStatus;
WalletTransactionSchema.WalletTransactionCategory = WalletTransactionCategory;

module.exports = WalletTransactionSchema;
