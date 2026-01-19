// src/entities/Payment/DoctorWallet.js (Enhanced version of existing Wallet)
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "DoctorWallet",
  tableName: "doctor_wallets",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // Doctor reference
    doctorId: { type: "uuid", unique: true, nullable: false },
    
    // Multi-currency balances (all in USD base)
    totalBalanceUsd: { 
      type: "decimal", 
      precision: 12, 
      scale: 2,
      default: 0.00,
      comment: "Total earnings in USD"
    },
    pendingCreditsUsd: { 
      type: "decimal", 
      precision: 12, 
      scale: 2,
      default: 0.00,
      comment: "Funds in 3-day dispute window"
    },
    availableBalanceUsd: { 
      type: "decimal", 
      precision: 12, 
      scale: 2,
      default: 0.00,
      comment: "Withdrawable funds"
    },

    
    walletPassword: {
      type: "varchar",
      length: 255,
      nullable: true,
      select: false, // Don't include in normal queries for security
      comment: "Hashed password for wallet operations"
    },



  // NEW: Password reset fields
  walletPasswordResetToken: {
    type: "varchar",
    length: 255,
    nullable: true,
    select: false,
    comment: "Token for wallet password reset"
  },

  walletPasswordResetExpiresAt: {
    type: "timestamp",
    nullable: true,
    comment: "When the wallet password reset token expires"
  },

  walletPasswordResetAttempts: {
    type: "int",
    default: 0,
    comment: "Number of reset attempts to prevent abuse"
  },
    
    // Display preferences
    preferredDisplayCurrency: { 
      type: "varchar", 
      length: 3,
      default: "USD",
      comment: "Currency for wallet display (NGN, GHS, USD, etc.)"
    },
    
    // Withdrawal settings
    minimumWithdrawal: { 
      type: "decimal", 
      precision: 10, 
      scale: 2,
      default: 10.00,
      comment: "Minimum withdrawal amount in USD"
    },
    
    // Bank details for withdrawals
    bankDetails: {
      type: "jsonb",
      nullable: true,
      comment: "Encrypted bank account details for withdrawals"
    },
    
    // Status
    isActive: { type: "boolean", default: true },
    isFrozen: { type: "boolean", default: false },
    frozenReason: { type: "varchar", nullable: true },
    
    // Timestamps
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
    lastWithdrawalAt: { type: "timestamp", nullable: true }
  },
  relations: {
    doctor: {
      type: "one-to-one",
      target: "User",
      onDelete: "CASCADE",

      joinColumn: { name: "doctorId" }
    },
    withdrawals: {
      type: "one-to-many",
      target: "WalletWithdrawal",
      inverseSide: "wallet"
    }
  },
  indices: [
    { columns: ["doctorId"] },
    { columns: ["isActive"] },
    { columns: ["isFrozen"] }
  ]
});