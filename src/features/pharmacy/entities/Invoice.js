const { EntitySchema } = require("typeorm");

const InvoiceStatus = {
  DRAFT: "draft",
  SENT: "sent",
  VIEWED: "viewed",
  AWAITING_PAYMENT: "awaiting_payment",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
};

const InvoicePaymentMethod = {
  ONLINE: "online",
  PAY_ON_PICKUP: "pay_on_pickup",
};

const InvoiceSchema = new EntitySchema({
  name: "Invoice",
  tableName: "invoices",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },

    // Human-readable reference per pharmacy, e.g. #192030
    reference: { type: "varchar", length: 20, nullable: false },

    // Foreign keys
    prescriptionId: { type: "uuid", nullable: false },
    pharmacyId:    { type: "uuid", nullable: false },
    patientId:     { type: "uuid", nullable: false },

    // Amounts stored in USD (4 decimal places for precision)
    subtotalUsd:     { type: "decimal", precision: 14, scale: 4, default: 0 },
    deliveryFeeUsd:  { type: "decimal", precision: 14, scale: 4, default: 0 },
    totalAmountUsd:  { type: "decimal", precision: 14, scale: 4, default: 0 },

    // The pharmacy's display currency at invoice creation time (e.g. "NGN")
    // Used to convert back for display — never changes after creation
    displayCurrency:    { type: "varchar", length: 3, default: "USD", nullable: false },
    // How many display-currency units = 1 USD at creation time
    exchangeRateToUsd:  { type: "decimal", precision: 18, scale: 6, default: 1, nullable: false },

    paymentMethod: {
      type: "enum",
      enum: Object.values(InvoicePaymentMethod),
      nullable: false,
    },
    status: {
      type: "enum",
      enum: Object.values(InvoiceStatus),
      default: InvoiceStatus.DRAFT,
      nullable: false,
    },

    paidAt:    { type: "timestamp", nullable: true },
    dueAt:     { type: "timestamp", nullable: true },
    notes:     { type: "text", nullable: true },

    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
  },
  relations: {
    prescription: {
      type: "many-to-one",
      target: "Prescription",
      joinColumn: { name: "prescriptionId" },
      onDelete: "CASCADE",
    },
    pharmacy: {
      type: "many-to-one",
      target: "PharmacyProfile",
      joinColumn: { name: "pharmacyId" },
      onDelete: "CASCADE",
    },
    patient: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "patientId" },
      onDelete: "CASCADE",
    },
    lineItems: {
      type: "one-to-many",
      target: "InvoiceLineItem",
      inverseSide: "invoice",
      cascade: true,
      eager: true,
    },
    payments: {
      type: "one-to-many",
      target: "PharmacyPayment",
      inverseSide: "invoice",
    },
  },
  indices: [
    { columns: ["pharmacyId"] },
    { columns: ["patientId"] },
    { columns: ["prescriptionId"] },
    { columns: ["status"] },
    { columns: ["reference", "pharmacyId"], unique: true },
    { columns: ["createdAt"] },
  ],
});

InvoiceSchema.InvoiceStatus = InvoiceStatus;
InvoiceSchema.InvoicePaymentMethod = InvoicePaymentMethod;

module.exports = InvoiceSchema;
