// ===== 1. CONSENT ENTITY =====
// src/entities/PatientConsent.js
const { EntitySchema } = require("typeorm");

const ConsentStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  WITHDRAWN: "withdrawn",
  EXPIRED: "expired"
};

const ConsentScope = {
  FULL_ACCESS: "full_access",
  LIMITED_ACCESS: "limited_access",
  TREATMENT_ONLY: "treatment_only",
  EMERGENCY_ONLY: "emergency_only",
  NO_ACCESS: "no_access"
};

const PurposeOfUse = {
  TREATMENT: "treatment",
  PAYMENT: "payment", 
  HEALTHCARE_OPERATIONS: "healthcare_operations",
  RESEARCH: "research",
  PUBLIC_HEALTH: "public_health",
  QUALITY_ASSURANCE: "quality_assurance",
  EMERGENCY: "emergency"
};

module.exports = new EntitySchema({
  name: "PatientConsent",
  tableName: "patient_consents",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // Patient Information
    patientIdentifier: {
      type: "varchar",
      nullable: false,
      name: "patient_identifier",
      comment: "Patient identifier from FHIR resources"
    },
    
    // Consent Details
    consentStatus: {
      type: "enum",
      enum: Object.values(ConsentStatus),
      default: ConsentStatus.ACTIVE,
      name: "consent_status"
    },
    
    consentScope: {
      type: "enum", 
      enum: Object.values(ConsentScope),
      default: ConsentScope.LIMITED_ACCESS,
      name: "consent_scope"
    },
    
    // Purpose of Use Permissions
    allowedPurposes: {
      type: "jsonb",
      nullable: false,
      default: '[]',
      name: "allowed_purposes",
      comment: "Array of allowed purposes of use"
    },
    
    // Access Controls
    allowedUsers: {
      type: "jsonb",
      nullable: true,
      name: "allowed_users",
      comment: "Specific users who can access (if limited access)"
    },
    
    allowedResourceTypes: {
      type: "jsonb",
      nullable: true,
      name: "allowed_resource_types",
      comment: "Specific FHIR resource types that can be accessed"
    },
    
    restrictedResourceTypes: {
      type: "jsonb", 
      nullable: true,
      name: "restricted_resource_types",
      comment: "FHIR resource types that are explicitly restricted"
    },
    
    // Time-based Controls
    effectiveDate: {
      type: "timestamp",
      nullable: false,
      name: "effective_date",
      comment: "When consent becomes effective"
    },
    
    expirationDate: {
      type: "timestamp",
      nullable: true,
      name: "expiration_date", 
      comment: "When consent expires (null = no expiration)"
    },
    
    // Emergency Access
    allowEmergencyAccess: {
      type: "boolean",
      default: true,
      name: "allow_emergency_access",
      comment: "Allow break-glass emergency access"
    },
    
    emergencyContactInfo: {
      type: "jsonb",
      nullable: true,
      name: "emergency_contact_info",
      comment: "Emergency contact information"
    },
    
    // Consent Metadata
    consentDocument: {
      type: "text",
      nullable: true,
      name: "consent_document",
      comment: "Original consent document or reference"
    },
    
    consentMethod: {
      type: "varchar",
      nullable: false,
      name: "consent_method",
      comment: "How consent was obtained (verbal, written, electronic)"
    },
    
    consentLanguage: {
      type: "varchar",
      default: "en",
      name: "consent_language"
    },
    
    // Audit Information
    grantor: { type: "uuid", nullable: false }, // Who granted consent
    grantorRole: {
      type: "varchar", 
      nullable: false,
      name: "grantor_role",
      comment: "Role of person granting consent (patient, guardian, etc.)"
    },
    
    witness: { type: "uuid", nullable: true }, // Who witnessed consent
    
    // Change Tracking
    version: { type: "int", default: 1 },
    previousConsentId: {
      type: "uuid",
      nullable: true,
      name: "previous_consent_id"
    },
    
    // Withdrawal Information
    withdrawnAt: {
      type: "timestamp",
      nullable: true,
      name: "withdrawn_at"
    },
    
    withdrawalReason: {
      type: "text",
      nullable: true,
      name: "withdrawal_reason"
    },
    
    withdrawnBy: {
      type: "uuid",
      nullable: true,
      name: "withdrawn_by"
    },
    
    // Standard Fields
    createdAt: { 
      type: "timestamp", 
      createDate: true,
      name: "created_at"
    },
    updatedAt: { 
      type: "timestamp", 
      updateDate: true,
      name: "updated_at"
    }
  },
  
  relations: {
    grantorUser: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",
      joinColumn: { name: "grantor" },
      nullable: false
    },
    witnessUser: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",
      joinColumn: { name: "witness" },
      nullable: true
    },
    withdrawnByUser: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",
      joinColumn: { name: "withdrawn_by" },
      nullable: true
    },
    accessLogs: {
      type: "one-to-many",
      target: "ConsentAccessLog",
      inverseSide: "consent"
    }
  },
  
  indices: [
    { name: "IDX_PATIENT_CONSENT", columns: ["patientIdentifier", "consentStatus"] },
    { name: "IDX_CONSENT_EFFECTIVE", columns: ["effectiveDate", "expirationDate"] },
    { name: "IDX_CONSENT_STATUS", columns: ["consentStatus"] },
    { name: "IDX_CONSENT_SCOPE", columns: ["consentScope"] }
  ]
});

// Export enums
module.exports.ConsentStatus = ConsentStatus;
module.exports.ConsentScope = ConsentScope; 
module.exports.PurposeOfUse = PurposeOfUse;