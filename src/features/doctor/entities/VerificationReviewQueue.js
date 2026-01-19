// src/entities/DoctorVerification/VerificationReviewQueue.js
const { EntitySchema } = require("typeorm");

const QueuePriority = {
  LOW: "low",
  NORMAL: "normal", 
  HIGH: "high",
  URGENT: "urgent"
};

module.exports = new EntitySchema({
  name: "VerificationReviewQueue",
  tableName: "verification_review_queue",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    verificationRequestId: { type: "uuid", nullable: false, unique: true },
    
    // Queue management
    priority: {
      type: "enum",
      enum: Object.values(QueuePriority),
      default: QueuePriority.NORMAL
    },
    assignedTo: { type: "uuid", nullable: true },
    
    // Timing
    addedToQueueAt: { type: "timestamp", createDate: true },
    assignedAt: { type: "timestamp", nullable: true },
    reviewStartedAt: { type: "timestamp", nullable: true },
    completedAt: { type: "timestamp", nullable: true },
    
    // SLA tracking
    slaTarget: { type: "timestamp", nullable: true }, // When this should be completed
    slaBreached: { type: "boolean", default: false },
    
    // Escalation
    escalated: { type: "boolean", default: false },
    escalatedAt: { type: "timestamp", nullable: true },
    escalatedTo: { type: "uuid", nullable: true },
    escalationReason: { type: "text", nullable: true },
    
    // Metadata
    queueNotes: { type: "text", nullable: true },
    complexity: { type: "varchar", nullable: true }, // simple, moderate, complex
    
    // Audit
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true }
  },
  relations: {
    verificationRequest: {
      type: "one-to-one",
      target: "VerificationRequest",
      joinColumn: { name: "verificationRequestId" },
      onDelete: "CASCADE"
    },
    assignedToUser: {
      type: "many-to-one",
      target: "User", 
      joinColumn: { name: "assignedTo" },
      nullable: true
    },
    escalatedToUser: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "escalatedTo" },
      nullable: true
    }
  },
  indices: [
    { name: "idx_queue_assigned", columns: ["assignedTo"] },
    { name: "idx_queue_priority", columns: ["priority"] },
    { name: "idx_queue_sla", columns: ["slaTarget"] },
    { name: "idx_queue_added", columns: ["addedToQueueAt"] }
  ]
});

module.exports.QueuePriority = QueuePriority;