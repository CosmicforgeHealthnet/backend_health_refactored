// src/entities/Payment/Transaction.js
const { EntitySchema } = require("typeorm");

const TransactionStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  DISPUTED: "disputed",
  REFUNDED: "refunded",
  CANCELLED: "cancelled"
};

const PaymentProvider = {
  FLUTTERWAVE: "flutterwave",
  PAYSTACK: "paystack"
};

module.exports = new EntitySchema({
  name: "Transaction",
  tableName: "transactions",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // References
    patientId: { type: "uuid", nullable: false },
    doctorId: { 
      type: "uuid", 
      nullable: true,  // CHANGED: Made nullable for subscription payments
      comment: "Doctor ID - required for appointment payments, optional for subscription/other payments"
    },
    appointmentId: { type: "uuid", nullable: true }, // Could be for other services later
    paymentMethodId: { type: "uuid", nullable: true },
    
    // Service identification (Universal Payment Architecture)
    serviceType: {
      type: "enum",
      enum: ["appointment", "subscription", "lab_test", "pharmacy", "document_access", "verification_fee", "chat_premium", "other"],
      nullable: false
    },
    serviceId: { 
      type: "uuid", 
      nullable: true,
      comment: "ID of the service being paid for (appointment_id, subscription_id, etc.)"
    },
    planType: {
      type: "enum", 
      enum: ["free", "basic", "medium", "premium", "one_time"],
      nullable: true
    },
    // Billing cycle for subscriptions
    billingCycle: {
      type: "enum",
      enum: ["one_time", "monthly", "quarterly", "yearly"],
      default: "one_time"
    },
    // Service period for subscriptions
    servicePeriodStart: { type: "timestamp", nullable: true },
    servicePeriodEnd: { type: "timestamp", nullable: true },
    
    // Multi-currency storage (our Option B approach)
    originalAmount: { 
      type: "decimal", 
      precision: 10, 
      scale: 2,
      nullable: false,
      comment: "Amount in original currency patient paid"
    },
    originalCurrency: { 
      type: "varchar", 
      length: 3,
      nullable: false,
      comment: "ISO currency code (NGN, GHS, USD, etc.)"
    },
    usdAmount: { 
      type: "decimal", 
      precision: 10, 
      scale: 2,
      nullable: false,
      comment: "Amount converted to USD (base currency)"
    },
    exchangeRateUsed: { 
      type: "decimal", 
      precision: 10, 
      scale: 6,
      nullable: false,
      comment: "Exchange rate at time of conversion"
    },
    
    // Provider details
    paymentProvider: {
      type: "enum",
      enum: Object.values(PaymentProvider),
      nullable: false
    },
    providerTransactionId: { 
      type: "varchar", 
      nullable: true,
      comment: "Transaction ID from Flutterwave/Paystack"
    },
    providerReference: { 
      type: "varchar", 
      nullable: true,
      comment: "Provider's reference number"
    },
    providerFee: { 
      type: "decimal", 
      precision: 10, 
      scale: 2,
      nullable: true,
      comment: "Fee charged by payment provider"
    },
    
    // Transaction details
    description: { type: "varchar", nullable: true },
    status: {
      type: "enum",
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING
    },

    // ENHANCED: Appointment-based dispute window
    appointmentDate: {
      type: "timestamp",
      nullable: true,
      comment: "Date of appointment (for appointment payments)"
    },

    disputeWindowStartsAt: {
      type: "timestamp", 
      nullable: true,
      comment: "When dispute window actually starts (appointmentDate for appointments, completedAt for others)"
    },
    
    // Dispute handling
    disputeWindowEndsAt: {
      type: "timestamp",
      nullable: true,
      comment: "When 3-day dispute window ends (disputeWindowStartsAt + 3 days)"
    },

    // NEW: Status tracking for appointment payments
    fundsStatus: {
      type: "enum",
      enum: ["pending_appointment", "pending_dispute", "releasable", "released"],
      default: "pending_appointment",
      comment: "Status of funds for doctor access"
    },

    // Only these fields are needed:
    isCancelled: {
      type: "boolean", 
      default: false,
      comment: "Whether appointment was cancelled"
    },

    cancelledAt: {
      type: "timestamp",
      nullable: true, 
      comment: "When cancellation was processed by payment system"
    },

    refundStatus: {
      type: "enum",
      enum: ["none", "pending", "partial", "full", "failed"],
      default: "none"
    },

    refundAmount: {
      type: "decimal",
      precision: 10,
      scale: 2,
      nullable: true
    },

    refundProcessedAt: {
      type: "timestamp",
      nullable: true
    },
        // Auto-billing field (add this to your existing columns)
    isAutoBilling: {
      type: "boolean",
      default: false,
      comment: "Whether this transaction was created via auto-billing"
    },
    // Metadata
    metadata: {
      type: "jsonb",
      nullable: true,
      comment: "Additional payment data from provider"
    },
    
    // Timestamps
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
    completedAt: { type: "timestamp", nullable: true },
    failedAt: { type: "timestamp", nullable: true }
  },
  relations: {
    patient: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",

      joinColumn: { name: "patientId" }
    },
    doctor: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",

      joinColumn: { name: "doctorId" }
    },
    paymentMethod: {
      type: "many-to-one",
      target: "UserPaymentMethod",
      joinColumn: { name: "paymentMethodId" }
    },
    splits: {
      type: "one-to-many",
      target: "TransactionSplit",
      inverseSide: "transaction"
    },
    disputes: {
      type: "one-to-many",
      target: "Dispute",
      inverseSide: "transaction"
    }
  },
  indices: [
    { columns: ["patientId"] },
    { columns: ["doctorId"] },
    { columns: ["paymentProvider"] },
    { columns: ["status"] },
    { columns: ["serviceType"] },
    { columns: ["planType"] },
    { columns: ["createdAt"] },
    { columns: ["providerTransactionId"] }
  ]
});