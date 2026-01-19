// src/entities/Payment/WalletWithdrawal.js
const { EntitySchema } = require("typeorm");

const WithdrawalStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  PENDING_OTP: "pending_otp"  // ADD THIS LINE
};

module.exports = new EntitySchema({
  name: "WalletWithdrawal",
  tableName: "wallet_withdrawals",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // References
    walletId: { type: "uuid", nullable: false },
    doctorId: { type: "uuid", nullable: false },
    
    // Withdrawal details
    amountUsd: { 
      type: "decimal", 
      precision: 10, 
      scale: 2,
      nullable: false
    },
    requestedCurrency: { type: "varchar", length: 3, nullable: false },
    requestedAmount: { 
      type: "decimal", 
      precision: 10, 
      scale: 2,
      nullable: false
    },
    exchangeRateUsed: { 
      type: "decimal", 
      precision: 10, 
      scale: 6,
      nullable: true
    },
    
    // Bank details
    bankDetails: {
      type: "jsonb",
      nullable: false,
      comment: "Bank account details for this withdrawal"
    },

    // ADD THIS:
    processor: { 
      type: "varchar", 
      length: 20, 
      nullable: false,
      default: "flutterwave", // Add this line
      comment: "Payment processor used (flutterwave, paystack)"
    },

        // Paystack OTP fields
    // 
    
    otpCode: {
      type: "varchar",
      length: 6,
      nullable: true,
      comment: "6-digit OTP code for withdrawal verification"
    },

    otpExpiresAt: {
      type: "timestamp",
      nullable: true,
      comment: "When the OTP expires"
    },

    otpAttempts: {
      type: "int",
      default: 0,
      comment: "Number of OTP attempts made"
    },

    maxOtpAttempts: {
      type: "int",
      default: 3,
      comment: "Maximum allowed OTP attempts"
    },

    isOtpVerified: {
      type: "boolean",
      default: false,
      comment: "Whether OTP has been successfully verified"
    },

    // For split withdrawals
    parentWithdrawalId: { 
      type: "uuid", 
      nullable: true,
      comment: "Links multiple withdrawals from same request"
    },

    
    // Processing
    status: {
      type: "enum",
      enum: Object.values(WithdrawalStatus),
      default: WithdrawalStatus.PENDING
    },
    providerReference: { type: "varchar", nullable: true },
    failureReason: { type: "text", nullable: true },
    
    // Timestamps
    createdAt: { type: "timestamp", createDate: true },
    processedAt: { type: "timestamp", nullable: true },
    completedAt: { type: "timestamp", nullable: true }
  },
  relations: {
    wallet: {
      type: "many-to-one",
      target: "DoctorWallet",
      joinColumn: { name: "walletId" }
    },
    doctor: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",

      joinColumn: { name: "doctorId" }
    }
  },
  indices: [
    { columns: ["walletId"] },
    { columns: ["doctorId"] },
    { columns: ["status"] },
    { columns: ["createdAt"] }
  ]
});