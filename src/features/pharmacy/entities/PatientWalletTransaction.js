const { EntitySchema } = require("typeorm");

const PatientTxnType = {
  CREDIT: "credit",
  DEBIT:  "debit",
};

const PatientTxnStatus = {
  PENDING:   "pending",
  COMPLETED: "completed",
  FAILED:    "failed",
};

const PatientTxnCategory = {
  PAYMENT:    "payment",    // debit — invoice payment
  TOP_UP:     "top_up",     // credit — wallet top-up
  REFUND:     "refund",     // credit — dispute refund
  ADJUSTMENT: "adjustment", // admin correction
};

const PatientWalletTransactionSchema = new EntitySchema({
  name: "PatientWalletTransaction",
  tableName: "patient_wallet_transactions",
  columns: {
    id:        { primary: true, type: "uuid", generated: "uuid" },
    walletId:  { type: "uuid", nullable: false },
    patientId: { type: "uuid", nullable: false },

    type:     { type: "enum", enum: Object.values(PatientTxnType), nullable: false },
    status:   { type: "enum", enum: Object.values(PatientTxnStatus), default: PatientTxnStatus.PENDING },
    category: { type: "enum", enum: Object.values(PatientTxnCategory), nullable: false },

    amountUsd:       { type: "decimal", precision: 14, scale: 4, nullable: false },
    balanceAfterUsd: { type: "decimal", precision: 14, scale: 4, nullable: false },

    description: { type: "varchar", length: 500, nullable: false },
    reference:   { type: "varchar", length: 100, nullable: true },
    invoiceId:   { type: "uuid", nullable: true },

    // Gateway fields (used for top-ups)
    authorizationUrl: { type: "varchar", length: 1000, nullable: true },
    provider:         { type: "varchar", length: 20, nullable: true },

    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
  },
  relations: {
    wallet: {
      type: "many-to-one",
      target: "PatientWallet",
      joinColumn: { name: "walletId" },
      onDelete: "CASCADE",
      inverseSide: "transactions",
    },
  },
  indices: [
    { columns: ["walletId"] },
    { columns: ["patientId"] },
    { columns: ["reference"] },
    { columns: ["category"] },
    { columns: ["createdAt"] },
  ],
});

PatientWalletTransactionSchema.PatientTxnType     = PatientTxnType;
PatientWalletTransactionSchema.PatientTxnStatus   = PatientTxnStatus;
PatientWalletTransactionSchema.PatientTxnCategory = PatientTxnCategory;

module.exports = PatientWalletTransactionSchema;
