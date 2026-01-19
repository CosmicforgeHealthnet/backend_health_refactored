// src/entities/pharmacy/PharmacyDocument.js - UPDATED
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "PharmacyDocument",
  tableName: "pharmacy_documents",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    pharmacyId: { type: "uuid", nullable: false },
    documentFileId: { type: "uuid", nullable: false }, // Link to your DocumentFile
    
    // Document classification
    documentType: { 
      type: "enum", 
      enum: ["pharmacy_license", "government_id", "business_registration", "tax_certificate", "other"],
      nullable: false
    },
    documentName: { type: "varchar", nullable: false },
    
    // Verification fields
    isVerified: { type: "boolean", default: false },
    verificationNotes: { type: "text", nullable: true },
    verifiedBy: { type: "uuid", nullable: true },
    verifiedAt: { type: "timestamp", nullable: true },
    
    // Status tracking
    submissionStatus: {
      type: "enum",
      enum: ["pending", "submitted", "under_review", "approved", "rejected", "resubmission_required"],
      default: "pending"
    },
    
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
    documentFile: {
      type: "one-to-one",
      target: "DocumentFile",
      joinColumn: { name: "documentFileId" },
      onDelete: "CASCADE",
    },
    verifier: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "verifiedBy" },
    },
  },
  indices: [
    { columns: ["pharmacyId"] },
    { columns: ["documentFileId"] },
    { columns: ["documentType"] },
    { columns: ["isVerified"] },
    { columns: ["submissionStatus"] },
  ],
});