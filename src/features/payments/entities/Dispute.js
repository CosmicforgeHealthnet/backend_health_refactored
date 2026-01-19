// src/entities/Payment/Dispute.js
const { EntitySchema } = require("typeorm");

const DisputeStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  ESCALATED: "escalated",
  RESOLVED: "resolved"
};

const DisputeType = {
  REFUND_REQUEST: "refund_request",
  CHARGEBACK: "chargeback",
  QUALITY_COMPLAINT: "quality_complaint"
};

module.exports = new EntitySchema({
  name: "Dispute",
  tableName: "disputes",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // References
    transactionId: { type: "uuid", nullable: false },
    patientId: { type: "uuid", nullable: false },
    doctorId: { type: "uuid", nullable: false },
    
    // Dispute details
    type: {
      type: "enum",
      enum: Object.values(DisputeType),
      default: DisputeType.REFUND_REQUEST
    },
    status: {
      type: "enum",
      enum: Object.values(DisputeStatus),
      default: DisputeStatus.PENDING
    },
    
    // Content
    reason: { type: "text", nullable: false },
    patientDescription: { type: "text", nullable: true },
    doctorResponse: { type: "text", nullable: true },
    adminNotes: { type: "text", nullable: true },
    
    // Resolution
    refundAmount: { 
      type: "decimal", 
      precision: 10, 
      scale: 2,
      nullable: true
    },
    refundCurrency: { type: "varchar", length: 3, nullable: true },
    
    // Evidence
    attachments: {
      type: "jsonb",
      nullable: true,
      comment: "File attachments for dispute evidence"
    },
    
    // Timestamps
    createdAt: { type: "timestamp", createDate: true },
    respondedAt: { type: "timestamp", nullable: true },
    resolvedAt: { type: "timestamp", nullable: true },
    escalatedAt: { type: "timestamp", nullable: true }
  },
  relations: {
    transaction: {
      type: "many-to-one",
      target: "Transaction",
      joinColumn: { name: "transactionId" }
    },
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
    }
  },
  indices: [
    { columns: ["transactionId"] },
    { columns: ["status"] },
    { columns: ["type"] },
    { columns: ["createdAt"] }
  ]
});