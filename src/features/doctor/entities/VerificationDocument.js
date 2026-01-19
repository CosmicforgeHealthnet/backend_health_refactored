// src/entities/DoctorVerification/VerificationDocument.js
const { EntitySchema } = require("typeorm");

const DocumentType = {
  MEDICAL_LICENSE: "medical_license",
  MEDICAL_DEGREE: "medical_degree", 
  BOARD_CERTIFICATION: "board_certification",
  POSTGRADUATE_CERTIFICATE: "postgraduate_certificate",
  GOVERNMENT_ID: "government_id",
  PROOF_OF_PRACTICE: "proof_of_practice",
  GOOD_STANDING_CERTIFICATE: "good_standing_certificate",
  OTHER: "other"
};

const DocumentStatus = {
  UPLOADED: "uploaded",
  PROCESSING: "processing",
  VERIFIED: "verified",
  REJECTED: "rejected",
  EXPIRED: "expired"
};

module.exports = new EntitySchema({
  name: "VerificationDocument",
  tableName: "verification_documents", 
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    verificationRequestId: { type: "uuid", nullable: false },
    
    // Document metadata
    documentType: {
      type: "enum",
      enum: Object.values(DocumentType),
      nullable: false
    },
    originalFileName: { type: "varchar", nullable: false },
    storedFileName: { type: "varchar", nullable: false }, // UUID-based filename
    filePath: { type: "varchar", nullable: false }, // S3/storage path
    fileSize: { type: "integer", nullable: false }, // bytes
    mimeType: { type: "varchar", nullable: false },
    
    // Security
    fileHash: { type: "varchar", nullable: false }, // SHA-256 hash
    encryptionKey: { type: "varchar", nullable: true }, // If file is encrypted
    digitalSignature: { type: "text", nullable: true }, // Digital signature of document
    
    // Processing status
    status: {
      type: "enum",
      enum: Object.values(DocumentStatus),
      default: DocumentStatus.UPLOADED
    },
    
    // OCR and AI processing
    ocrText: { type: "text", nullable: true },
    extractedData: { type: "jsonb", nullable: true }, // Structured data from OCR
    aiAnalysisResult: { type: "jsonb", nullable: true }, // AI fraud detection results
    ocrConfidence: { type: "float", nullable: true }, // 0-1 confidence score
    
    // Verification details
    verifiedBy: { type: "varchar", nullable: true }, // API, manual reviewer, AI
    verifiedAt: { type: "timestamp", nullable: true },
    rejectionReason: { type: "text", nullable: true },
    
    // Audit
    uploadedAt: { type: "timestamp", createDate: true },
    uploadedBy: { type: "uuid", nullable: false }, // Usually the doctor
    lastAccessedAt: { type: "timestamp", nullable: true },
    accessCount: { type: "integer", default: 0 },
    
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true }
  },
  relations: {
    verificationRequest: {
      type: "many-to-one",
      target: "VerificationRequest", 
      joinColumn: { name: "verificationRequestId" },
      onDelete: "CASCADE"
    },
    uploadedByUser: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",
      joinColumn: { name: "uploadedBy" }
    }
  },
  indices: [
    { name: "idx_document_verification_type", columns: ["verificationRequestId", "documentType"] },
    { name: "idx_document_status", columns: ["status"] },
    { name: "idx_document_hash", columns: ["fileHash"] },
    { name: "idx_document_uploaded", columns: ["uploadedAt"] }
  ]
});

module.exports.DocumentType = DocumentType;
module.exports.DocumentStatus = DocumentStatus;
