// src/entities/DoctorVerification/CountryVerificationConfig.js
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "CountryVerificationConfig", 
  tableName: "country_verification_configs",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // Country details
    countryCode: { type: "varchar", length: 2, unique: true }, // ISO 2-letter code
    countryName: { type: "varchar", nullable: false },
    regulatoryBody: { type: "varchar", nullable: false }, // MDCN, HPCSA, etc.
    
    // Verification configuration
    tier: {
      type: "enum",
      enum: ["tier_1", "tier_2", "tier_3"],
      nullable: false
    },
    method: {
      type: "enum", 
      enum: ["automated", "manual", "hybrid"],
      nullable: false
    },
    
    // API configuration
    hasApi: { type: "boolean", default: false },
    apiProvider: { type: "varchar", nullable: true },
    apiEndpoint: { type: "varchar", nullable: true },
    apiKeyRequired: { type: "boolean", default: false },
    apiRateLimit: { type: "integer", nullable: true }, // requests per hour
    
    // Processing details
    avgProcessingTime: { type: "integer", nullable: true }, // hours
    maxProcessingTime: { type: "integer", nullable: true }, // hours
    requiresManualReview: { type: "boolean", default: true },
    
    // Required documents
    requiredDocuments: { type: "jsonb", nullable: true }, // Array of required document types
    optionalDocuments: { type: "jsonb", nullable: true },
    
    // Configuration
    isActive: { type: "boolean", default: true },
    notes: { type: "text", nullable: true },
    
    // Audit
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
    createdBy: { type: "uuid", nullable: true },
    updatedBy: { type: "uuid", nullable: true }
  },
  indices: [
    { name: "idx_country_config_code", columns: ["countryCode"] },
    { name: "idx_country_config_tier", columns: ["tier"] },
    { name: "idx_country_config_active", columns: ["isActive"] }
  ]
});                                                                         