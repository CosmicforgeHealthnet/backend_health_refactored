// src/entities/User.js - UPDATED WITH COUNTRY FIELD
const { EntitySchema } = require("typeorm");
const { USER_ROLES } = require("../../../shared/utils/constants");

const Status = {
  PENDING_EMAIL_VERIFICATION: "pending_email_verification",
  ACTIVE: "active",
  PENDING_DOCTOR_VERIFICATION: "pending_doctor_verification",
  DOCTOR_ACTIVE: "doctor_active",
  PENDING_PHARMACY_VERIFICATION: "pending_pharmacy_verification",
  PHARMACY_ACTIVE: "pharmacy_active",
  LOCKED: "locked",
};

const Provider = {
  LOCAL: "local",
  GOOGLE: "google",
};

const UserTier = {
  FREE: "free",
  BASIC: "basic",
  STANDARD: "standard",
  MEDIUM: "medium",
  PREMIUM: "premium",
  GOLD_ELITE: "gold_elite",
  PROFESSIONAL: "professional",
};

module.exports = new EntitySchema({
  name: "User",
  tableName: "users",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    fullName: { type: "varchar", nullable: false },
    email: { type: "varchar", unique: true },
    passwordHash: { type: "varchar", nullable: true },

    // PHARMACY FIELDS
    username: {
      type: "varchar",
      unique: true,
      nullable: true,
      comment: "Unique username for users",
    },
    bannerUrl: {
      type: "varchar",
      nullable: true,
      comment: "Banner image URL for user profile",
    },

    // 🌍 COUNTRY FIELD FOR LOCATION RESTRICTIONS
    country: {
      type: "varchar",
      length: 100,
      nullable: true,
      comment: "User's country detected during signup (for patient restrictions)",
    },

    role: {
      type: "enum",
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.PATIENT,
    },
    status: {
      type: "enum",
      enum: Object.values(Status),
      default: Status.PENDING_EMAIL_VERIFICATION,
    },
    phoneNumber: {
      type: "varchar",
      nullable: true,
      comment: "Phone number for doctors (optional)"
    },
    departmentSpecialty: {
      type: "varchar",
      nullable: true,
      comment: "Medical specialty/department for doctors (optional)"
    },
    provider: {
      type: "enum",
      enum: Object.values(Provider),
      default: Provider.LOCAL,
    },
    providerId: { type: "varchar", nullable: true },
    profileImageUrl: { type: "varchar", nullable: true },
    mfaEnabled: { type: "boolean", default: false },
    mfaSecret: { type: "varchar", nullable: true },
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },

    tier: {
      type: "enum",
      enum: Object.values(UserTier),
      default: UserTier.FREE,
      nullable: false,
      comment: "User subscription tier level",
    },

    isOnline: {
      type: "boolean",
      default: false,
    },

    referralCode: {
      type: "varchar",
      length: 50,
      unique: true,
      nullable: true,
      comment: "Unique referral code for this user",
    },
    totalReferrals: {
      type: "int",
      default: 0,
      comment: "Total number of verified referrals",
    },
    referredBy: {
      type: "uuid",
      nullable: true,
      comment: "User ID who referred this user",
    },

    // User's preferred timezone (can override auto-detected)
    timezone: {
      type: "varchar",
      length: 100,
      nullable: true,
      comment: "User's preferred timezone (IANA format: America/New_York, Africa/Lagos, etc.)",
    },
    lastDetectedTimezone: {
      type: "varchar",
      length: 100,
      nullable: true,
      comment: "Last auto-detected timezone from location middleware",
    },
    timezoneUpdatedAt: {
      type: "timestamp",
      nullable: true,
      comment: "When timezone was last updated",
    },

    averageRating: {
      type: 'decimal',
      precision: 2,
      scale: 1,
      default: 0,
      nullable: false,
      comment: 'Average rating (1–5)',
    },

    totalRatings: {
      type: 'int',
      default: 0,
      nullable: false,
      comment: 'Total number of ratings submitted',
    },
  },
  relations: {
    doctorProfile: {
      type: "one-to-one",
      target: "DoctorProfile",
      inverseSide: "user",
      cascade: true,
    },
    patientProfile: {
      type: "one-to-one",
      target: "PatientProfile",
      cascade: true,
      inverseSide: "user",
    },
    emailVerifications: {
      type: "one-to-many",
      target: "EmailVerification",
      inverseSide: "user",
    },
    magicLinkTokens: {
      type: "one-to-many",
      target: "MagicLinkToken",
      inverseSide: "user",
    },
    refreshTokens: {
      type: "one-to-many",
      target: "RefreshToken",
      inverseSide: "user",
    },
    authEvents: {
      type: "one-to-many",
      target: "AuthEvent",
      inverseSide: "user",
    },
    doctorPricing: {
      type: "one-to-many",
      target: "DoctorPricing",
      inverseSide: "doctor",
    },
    doctorAvailability: {
      type: "one-to-many",
      target: "DoctorAvailability",
      inverseSide: "doctor",
    },
    doctorUnavailability: {
      type: "one-to-many",
      target: "DoctorUnavailability",
      inverseSide: "doctor",
    },
    notifications: {
      type: "one-to-many",
      target: "Notification",
      inverseSide: "user",
    },
    subscriptions: {
      type: "one-to-many",
      target: "Subscription",
      inverseSide: "user",
      cascade: true,
    },
    chatParticipations: {
      target: "ChatParticipant",
      type: "one-to-many",
      inverseSide: "user",
    },
    sentMessages: {
      target: "ChatMessage",
      type: "one-to-many",
      inverseSide: "sender",
    },
    createdRooms: {
      target: "ChatRoom",
      type: "one-to-many",
      inverseSide: "createdBy",
    },
    patientTransactions: {
      type: "one-to-many",
      target: "Transaction",
      inverseSide: "patient",
      foreignKey: "patientId",
    },
    doctorTransactions: {
      type: "one-to-many",
      target: "Transaction",
      inverseSide: "doctor",
      foreignKey: "doctorId",
    },
    paymentMethods: {
      type: "one-to-many",
      target: "UserPaymentMethod",
      inverseSide: "user",
    },
    doctorWallet: {
      type: "one-to-one",
      target: "DoctorWallet",
      inverseSide: "doctor",
    },
    patientDisputes: {
      type: "one-to-many",
      target: "Dispute",
      inverseSide: "patient",
      foreignKey: "patientId",
    },
    doctorDisputes: {
      type: "one-to-many",
      target: "Dispute",
      inverseSide: "doctor",
      foreignKey: "doctorId",
    },
    pharmacyProfile: {
      type: "one-to-one",
      target: "PharmacyProfile",
      inverseSide: "user",
      cascade: true,
    },
    managedPharmacyBranches: {
      type: "one-to-many",
      target: "PharmacyBranch",
      inverseSide: "manager",
    },
    assignedVerificationRequests: {
      type: "one-to-many",
      target: "PharmacyVerificationRequest",
      inverseSide: "assignedAdmin",
    },
    reviewedVerificationRequests: {
      type: "one-to-many",
      target: "PharmacyVerificationRequest",
      inverseSide: "reviewer",
    },
    ratings: {
      target: 'UserRating',
      type: 'one-to-many',
      inverseSide: 'user',
    },
  },

  indices: [
    { columns: ["email"] },
    { columns: ["username"] },
    { columns: ["role"] },
    { columns: ["status"] },
    { columns: ["tier"] },
    { columns: ["provider"] },
    { columns: ["country"] }, // 🌍 INDEX FOR COUNTRY QUERIES
    { columns: ["createdAt"] },
  ],
});