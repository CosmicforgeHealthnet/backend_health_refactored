// src/entities/DoctorVerification/VerificationApiLog.js  
const { EntitySchema } = require("typeorm");

const ApiProvider = {
  MDCN_NIGERIA: "mdcn_nigeria",
  HPCSA_SOUTH_AFRICA: "hpcsa_south_africa", 
  KMPDC_KENYA: "kmpdc_kenya",
  MDC_GHANA: "mdc_ghana",
  ECFMG: "ecfmg",
  SUREPASS: "surepass",
  IDFY: "idfy",
  CUSTOM: "custom"
};

module.exports = new EntitySchema({
  name: "VerificationApiLog",
  tableName: "verification_api_logs",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    verificationRequestId: { type: "uuid", nullable: false },
    
    // API call details
    provider: {
      type: "enum",
      enum: Object.values(ApiProvider),
      nullable: false
    },
    endpoint: { type: "varchar", nullable: false },
    method: { type: "varchar", default: "POST" },
    
    // Request/Response
    requestPayload: { type: "jsonb", nullable: true },
    responsePayload: { type: "jsonb", nullable: true },
    responseCode: { type: "integer", nullable: true },
    
    // Performance
    responseTime: { type: "integer", nullable: true }, // milliseconds
    success: { type: "boolean", default: false },
    errorMessage: { type: "text", nullable: true },
    
    // Rate limiting
    rateLimitRemaining: { type: "integer", nullable: true },
    rateLimitReset: { type: "timestamp", nullable: true },
    
    // Audit
    calledAt: { type: "timestamp", createDate: true },
    calledBy: { type: "uuid", nullable: true } // System user or human
  },
  relations: {
    verificationRequest: {
      type: "many-to-one",
      target: "VerificationRequest",
      joinColumn: { name: "verificationRequestId" },
      onDelete: "CASCADE"
    }
  },
  indices: [
    { name: "idx_api_log_verification", columns: ["verificationRequestId"] },
    { name: "idx_api_log_provider", columns: ["provider"] },
    { name: "idx_api_log_called", columns: ["calledAt"] },
    { name: "idx_api_log_success", columns: ["success"] }
  ]
});

module.exports.ApiProvider = ApiProvider;

