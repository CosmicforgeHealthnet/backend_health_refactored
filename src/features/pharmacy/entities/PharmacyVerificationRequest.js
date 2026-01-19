// src/entities/pharmacy/PharmacyVerificationRequest.js
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "PharmacyVerificationRequest",
  tableName: "pharmacy_verification_requests",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    pharmacyId: { type: "uuid", nullable: false },
    
    requestType: { 
      type: "enum", 
      enum: ["initial_verification", "re_verification", "document_update"],
      nullable: false
    },
    status: { 
      type: "enum", 
      enum: ["pending", "in_progress", "approved", "rejected", "requires_changes"],
      default: "pending"
    },
    priority: { 
      type: "enum", 
      enum: ["low", "medium", "high", "urgent"],
      default: "medium"
    },
    
    // Request details
    requestNotes: { type: "text", nullable: true },
    rejectionReason: { type: "text", nullable: true },
    
    // Admin handling
    assignedTo: { type: "uuid", nullable: true },
    reviewedBy: { type: "uuid", nullable: true },
    reviewNotes: { type: "text", nullable: true },
    
    // Timestamps
    submittedAt: { type: "timestamp", createDate: true },
    assignedAt: { type: "timestamp", nullable: true },
    reviewedAt: { type: "timestamp", nullable: true },
    completedAt: { type: "timestamp", nullable: true },
    
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
  },
  relations: {
    pharmacy: {
      type: "many-to-one",
      target: "PharmacyProfile",
      joinColumn: { name: "pharmacyId" },
      onDelete: "CASCADE",
    },
    assignedAdmin: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "assignedTo" },
    },
    reviewer: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "reviewedBy" },
    },
  },
  indices: [
    { columns: ["pharmacyId"] },
    { columns: ["status"] },
    { columns: ["priority"] },
    { columns: ["assignedTo"] },
  ],
});