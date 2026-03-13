const { EntitySchema } = require("typeorm");

const PharmacyPaymentStatus = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED:  "failed",
};

const PaymentProvider = {
  PAYSTACK:    "paystack",
  FLUTTERWAVE: "flutterwave",
};

const PaymentSchema = new EntitySchema({
  name: "PharmacyPayment",
  tableName: "pharmacy_payments",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },

    invoiceId:  { type: "uuid", nullable: false },
    patientId:  { type: "uuid", nullable: false },
    pharmacyId: { type: "uuid", nullable: false },

    // Unique per payment attempt — used for idempotency and gateway reference
    reference: { type: "varchar", length: 100, unique: true, nullable: false },

    // Amount charged to patient in their local currency
    amountLocal:  { type: "decimal", precision: 14, scale: 4, nullable: false },
    currency:     { type: "varchar", length: 3, nullable: false },
    exchangeRate: { type: "decimal", precision: 18, scale: 6, default: 1 },

    // USD equivalent for wallet crediting
    amountUsd: { type: "decimal", precision: 14, scale: 4, nullable: false },

    status: {
      type: "enum",
      enum: Object.values(PharmacyPaymentStatus),
      default: PharmacyPaymentStatus.PENDING,
      nullable: false,
    },
    provider: {
      type: "enum",
      enum: Object.values(PaymentProvider),
      nullable: false,
    },

    authorizationUrl:  { type: "varchar", length: 500, nullable: true },
    providerReference: { type: "varchar", length: 200, nullable: true },

    // Metadata sent to gateway so webhook can route without extra DB lookup
    metadata: {
      type: "jsonb",
      nullable: true,
    },

    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
  },
  relations: {
    invoice: {
      type: "many-to-one",
      target: "Invoice",
      joinColumn: { name: "invoiceId" },
      onDelete: "CASCADE",
      inverseSide: "payments",
    },
  },
  indices: [
    { columns: ["invoiceId"] },
    { columns: ["patientId"] },
    { columns: ["pharmacyId"] },
    { columns: ["reference"] },
    { columns: ["status"] },
    { columns: ["providerReference"] },
  ],
});

PaymentSchema.PharmacyPaymentStatus = PharmacyPaymentStatus;
PaymentSchema.PaymentProvider = PaymentProvider;

module.exports = PaymentSchema;
