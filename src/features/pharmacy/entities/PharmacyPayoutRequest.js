const { EntitySchema } = require("typeorm");

const PayoutStatus = {
  PENDING:    "pending",
  PROCESSING: "processing",
  COMPLETED:  "completed",
  FAILED:     "failed",
  CANCELLED:  "cancelled",
};

const PayoutSchema = new EntitySchema({
  name: "PharmacyPayoutRequest",
  tableName: "pharmacy_payout_requests",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },

    pharmacyId:    { type: "uuid", nullable: false },
    walletId:      { type: "uuid", nullable: false },
    bankAccountId: { type: "uuid", nullable: false },

    // Amount in USD
    amountUsd: { type: "decimal", precision: 14, scale: 4, nullable: false },

    status: {
      type: "enum",
      enum: Object.values(PayoutStatus),
      default: PayoutStatus.PENDING,
      nullable: false,
    },

    reference:     { type: "varchar", length: 100, unique: true, nullable: false },
    transferCode:  { type: "varchar", length: 100, nullable: true },  // Paystack transfer code
    note:          { type: "varchar", length: 500, nullable: true },
    failureReason: { type: "varchar", length: 500, nullable: true },

    requestedAt:  { type: "timestamp", createDate: true },
    processedAt:  { type: "timestamp", nullable: true },
    createdAt:    { type: "timestamp", createDate: true },
    updatedAt:    { type: "timestamp", updateDate: true },
  },
  relations: {
    wallet: {
      type: "many-to-one",
      target: "PharmacyWallet",
      joinColumn: { name: "walletId" },
      onDelete: "CASCADE",
      inverseSide: "payouts",
    },
    bankAccount: {
      type: "many-to-one",
      target: "PharmacyBankAccount",
      joinColumn: { name: "bankAccountId" },
      onDelete: "RESTRICT",
      eager: true,
    },
  },
  indices: [
    { columns: ["pharmacyId"] },
    { columns: ["walletId"] },
    { columns: ["status"] },
    { columns: ["reference"] },
    { columns: ["createdAt"] },
  ],
});

PayoutSchema.PayoutStatus = PayoutStatus;

module.exports = PayoutSchema;
