
// src/entities/Payment/UserPaymentMethod.js
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "UserPaymentMethod",
  tableName: "user_payment_methods",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // User reference
    userId: { type: "uuid", nullable: false },
    
    // Card details (masked for security)
    cardLast4: { type: "varchar", length: 4, nullable: false },
    cardType: { 
      type: "varchar", 
      nullable: true,
      comment: "Visa, Mastercard, etc."
    },
    cardBrand: { type: "varchar", nullable: true },
    bankName: { type: "varchar", nullable: true },
    
    // Provider tokens (for saved cards)
    flutterwaveToken: { type: "varchar", nullable: true },
    paystackToken: { type: "varchar", nullable: true },
    
    // Performance tracking per provider
    flutterwaveSuccessCount: { type: "integer", default: 0 },
    flutterwaveAttemptCount: { type: "integer", default: 0 },
    paystackSuccessCount: { type: "integer", default: 0 },
    paystackAttemptCount: { type: "integer", default: 0 },

        // Auto-billing fields (add these to your existing columns)
    canAutoCharge: {
      type: "boolean",
      default: true,
      comment: "Whether this payment method can be used for auto-billing"
    },

    tokenExpiryDate: {
      type: "timestamp",
      nullable: true,
      comment: "When the payment provider token expires"
    },

    lastAutoBillingUse: {
      type: "timestamp",
      nullable: true,
      comment: "When this method was last used for auto-billing"
    },

    autoBillingSuccessCount: {
      type: "integer",
      default: 0,
      comment: "Number of successful auto-billing charges"
    },

    autoBillingFailureCount: {
      type: "integer",
      default: 0,
      comment: "Number of failed auto-billing attempts"
    },
    
    // Intelligence
    lastSuccessfulProvider: {
      type: "enum",
      enum: ["flutterwave", "paystack"],
      nullable: true
    },
    isDefault: { type: "boolean", default: false },
    isActive: { type: "boolean", default: true },
    
    // Timestamps
    createdAt: { type: "timestamp", createDate: true },
    lastUsedAt: { type: "timestamp", nullable: true },
    updatedAt: { type: "timestamp", updateDate: true }
  },
  relations: {
    user: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",

      joinColumn: { name: "userId" }
    },
    transactions: {
      type: "one-to-many",
      target: "Transaction",
      inverseSide: "paymentMethod"
    }
  },
  indices: [
    { columns: ["userId"] },
    { columns: ["cardLast4"] },
    { columns: ["lastSuccessfulProvider"] },
    { columns: ["isDefault"] }
  ]
});