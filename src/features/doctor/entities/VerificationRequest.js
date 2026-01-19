// src/entities/DoctorVerification/VerificationRequest.js
const { EntitySchema } = require("typeorm");

const VerificationStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  PENDING_DOCUMENTS: "pending_documents",
  API_VERIFICATION: "api_verification",
  MANUAL_REVIEW: "manual_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired"
};

const VerificationMethod = {
  AUTOMATED: "automated",
  MANUAL: "manual", 
  HYBRID: "hybrid"
};

const VerificationTier = {
  TIER_1: "tier_1", // High confidence (APIs available)
  TIER_2: "tier_2", // Medium confidence (Manual + some APIs)
  TIER_3: "tier_3"  // Lower confidence (Manual only)
};

module.exports = new EntitySchema({
  name: "VerificationRequest",
  tableName: "verification_requests",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    doctorId: { type: "uuid", nullable: false },
    
    // Core verification data
    licenseNumber: { type: "varchar", nullable: false },
    countryCode: { type: "varchar", length: 2, nullable: false }, // NG, ZA, KE, etc.
    issuingAuthority: { type: "varchar", nullable: false }, // MDCN, HPCSA, etc.
    licenseType: { type: "varchar", nullable: true }, // General Practice, Specialist, etc.
    issueDate: { type: "date", nullable: true },
    expiryDate: { type: "date", nullable: true },
    
    // Verification process
    status: {
      type: "enum",
      enum: Object.values(VerificationStatus),
      default: VerificationStatus.PENDING
    },
    method: {
      type: "enum", 
      enum: Object.values(VerificationMethod),
      nullable: true
    },
    tier: {
      type: "enum",
      enum: Object.values(VerificationTier),
      nullable: true
    },
    confidenceScore: { type: "integer", default: 0 }, // 0-100
    
    // API verification data
    apiVerificationData: { type: "jsonb", nullable: true },
    apiVerifiedAt: { type: "timestamp", nullable: true },
    apiErrors: { type: "text", nullable: true },
    
    // Manual review data
    assignedReviewerId: { type: "uuid", nullable: true },
    reviewStartedAt: { type: "timestamp", nullable: true },
    reviewCompletedAt: { type: "timestamp", nullable: true },
    reviewNotes: { type: "text", nullable: true },
    rejectionReason: { type: "text", nullable: true },
    
    // Metadata
    submittedAt: { type: "timestamp", createDate: true },
    approvedAt: { type: "timestamp", nullable: true },
    rejectedAt: { type: "timestamp", nullable: true },
    expiresAt: { type: "timestamp", nullable: true }, // Auto-expire pending requests
    
    // Audit trail
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
    createdBy: { type: "uuid", nullable: true },
    updatedBy: { type: "uuid", nullable: true }
  },
  relations: {
    doctor: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "doctorId" },
      onDelete: "CASCADE"
    },
    assignedReviewer: {
      type: "many-to-one", 
      target: "User",
      joinColumn: { name: "assignedReviewerId" },
      nullable: true,
      onDelete: "CASCADE"

    },
    documents: {
      type: "one-to-many",
      target: "VerificationDocument",
      inverseSide: "verificationRequest"
    },
    statusHistory: {
      type: "one-to-many",
      target: "VerificationStatusHistory", 
      inverseSide: "verificationRequest"
    },
    apiLogs: {
      type: "one-to-many",
      target: "VerificationApiLog",
      inverseSide: "verificationRequest"
    }
  },
  indices: [
    { name: "idx_verification_doctor_status", columns: ["doctorId", "status"] },
    { name: "idx_verification_country_status", columns: ["countryCode", "status"] },
    { name: "idx_verification_reviewer", columns: ["assignedReviewerId"] },
    { name: "idx_verification_created", columns: ["createdAt"] }
  ]
});

// Export enums for use in other files
module.exports.VerificationStatus = VerificationStatus;
module.exports.VerificationMethod = VerificationMethod;
module.exports.VerificationTier = VerificationTier;