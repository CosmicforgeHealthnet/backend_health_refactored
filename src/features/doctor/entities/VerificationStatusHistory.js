// src/entities/DoctorVerification/VerificationStatusHistory.js
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "VerificationStatusHistory",
  tableName: "verification_status_history",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    verificationRequestId: { type: "uuid", nullable: false },
    
    // Status change details
    fromStatus: { type: "varchar", nullable: true },
    toStatus: { type: "varchar", nullable: false },
    changedBy: { type: "uuid", nullable: false },
    changeReason: { type: "text", nullable: true },
    
    // Additional context
    metadata: { type: "jsonb", nullable: true }, // Any additional data
    automatedChange: { type: "boolean", default: false }, // Was this an automated status change?
    
    // Audit
    changedAt: { type: "timestamp", createDate: true }
  },
  relations: {
    verificationRequest: {
      type: "many-to-one",
      target: "VerificationRequest",
      joinColumn: { name: "verificationRequestId" },
      onDelete: "CASCADE"
    },
    changedByUser: {
      type: "many-to-one", 
      target: "User",
      onDelete: "CASCADE",
      joinColumn: { name: "changedBy" }
    }
  },
  indices: [
    { name: "idx_status_history_verification", columns: ["verificationRequestId"] },
    { name: "idx_status_history_changed", columns: ["changedAt"] },
    { name: "idx_status_history_user", columns: ["changedBy"] }
  ]
});
