// src/entities/ComprehensiveAuditLog.js
const { EntitySchema } = require("typeorm");

const AuditEventType = {
  // File Operations
  FILE_UPLOAD: "file_upload",
  FILE_DOWNLOAD: "file_download", 
  FILE_VIEW: "file_view",
  FILE_DELETE: "file_delete",
  FILE_MODIFY: "file_modify",
  
  // FHIR Operations
  FHIR_RESOURCE_ACCESS: "fhir_resource_access",
  PATIENT_DATA_ACCESS: "patient_data_access",
  FHIR_SEARCH: "fhir_search",
  
  // Consent Operations
  CONSENT_GRANTED: "consent_granted",
  CONSENT_WITHDRAWN: "consent_withdrawn",
  CONSENT_MODIFIED: "consent_modified",
  CONSENT_CHECKED: "consent_checked",
  
  // Security Operations
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILURE: "login_failure",
  LOGOUT: "logout",
  PERMISSION_DENIED: "permission_denied",
  EMERGENCY_ACCESS: "emergency_access",
  
  // System Operations
  KEY_ROTATION: "key_rotation",
  KEY_GENERATION: "key_generation",
  ENCRYPTION_EVENT: "encryption_event",
  DECRYPTION_EVENT: "decryption_event",
  
  // Compliance Operations emergency_access_review
  COMPLIANCE_REPORT: "compliance_report",
  DATA_EXPORT: "data_export",
  DATA_RETENTION: "data_retention",
  ANONYMIZATION: "anonymization",

  CONSENT_HISTORY_ACCESS: "consent_history_access",
  EMERGENCY_ACCESS_REVIEW: 'emergency_access_review',
};

const AuditSeverity = {
  LOW: "low",
  MEDIUM: "medium", 
  HIGH: "high",
  CRITICAL: "critical"
};

const ComplianceFramework = {
  HIPAA: "hipaa",
  GDPR: "gdpr",
  FDA_21CFR11: "fda_21cfr11",
  SOX: "sox",
  ISO27001: "iso27001",
  NIST: "nist",
  PCI_DSS: "pci_dss"
};

module.exports = new EntitySchema({
  name: "ComprehensiveAuditLog",
  tableName: "comprehensive_audit_logs",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // Event Classification
    eventType: {
      type: "enum",
      enum: Object.values(AuditEventType),
      nullable: false,
      name: "event_type"
    },
    
    severity: {
      type: "enum",
      enum: Object.values(AuditSeverity),
      default: AuditSeverity.MEDIUM,
      nullable: false
    },
    
    complianceFrameworks: {
      type: "jsonb",
      nullable: false,
      default: '[]',
      name: "compliance_frameworks",
      comment: "Which compliance frameworks this event relates to"
    },
    
    // Actor Information
    userId: {
      type: "uuid",
      nullable: true,
      name: "user_id",
      comment: "User who performed the action"
    },
    
    userRole: {
      type: "varchar",
      nullable: true,
      name: "user_role",
      comment: "Role of the user at time of action"
    },
    
    sessionId: {
      type: "varchar",
      nullable: true,
      name: "session_id",
      comment: "User session identifier"
    },
    
    // Subject Information
    patientIdentifier: {
      type: "varchar",
      nullable: true,
      name: "patient_identifier",
      comment: "Patient whose data was accessed"
    },
    
    resourceId: {
      type: "uuid",
      nullable: true,
      name: "resource_id",
      comment: "File or resource that was accessed"
    },
    
    resourceType: {
      type: "varchar",
      nullable: true,
      name: "resource_type",
      comment: "Type of resource (file, folder, patient, etc.)"
    },
    
    fhirResourceType: {
      type: "varchar",
      nullable: true,
      name: "fhir_resource_type",
      comment: "FHIR resource type if applicable"
    },
    
    // Event Details
    eventDescription: {
      type: "text",
      nullable: false,
      name: "event_description",
      comment: "Human-readable description of the event"
    },
    
    purposeOfUse: {
      type: "varchar",
      nullable: true,
      name: "purpose_of_use",
      comment: "Stated purpose for the action"
    },
    
    accessMethod: {
      type: "varchar",
      nullable: true,
      name: "access_method",
      comment: "How access was obtained (API, web, mobile, etc.)"
    },
    
    // Technical Details
    ipAddress: {
      type: "varchar",
      nullable: true,
      name: "ip_address"
    },
    
    userAgent: {
      type: "text",
      nullable: true,
      name: "user_agent"
    },
    
    requestHeaders: {
      type: "jsonb",
      nullable: true,
      name: "request_headers",
      comment: "Relevant HTTP headers"
    },
    
    // Outcome Information
    outcome: {
      type: "varchar",
      nullable: false,
      comment: "SUCCESS, FAILURE, or PARTIAL"
    },
    
    outcomeReason: {
      type: "text",
      nullable: true,
      name: "outcome_reason",
      comment: "Reason for failure or additional outcome details"
    },
    
    // Security Context
    authenticationMethod: {
      type: "varchar",
      nullable: true,
      name: "authentication_method",
      comment: "How user was authenticated"
    },
    
    encryptionUsed: {
      type: "boolean",
      default: false,
      name: "encryption_used",
      comment: "Whether encryption was involved"
    },
    
    encryptionKeyId: {
      type: "uuid",
      nullable: true,
      name: "encryption_key_id",
      comment: "Which encryption key was used"
    },
    
    // Emergency Access
    isEmergencyAccess: {
      type: "boolean",
      default: false,
      name: "is_emergency_access"
    },
    
    emergencyJustification: {
      type: "text",
      nullable: true,
      name: "emergency_justification"
    },
    
    // Data Movement
    dataExported: {
      type: "boolean",
      default: false,
      name: "data_exported",
      comment: "Whether data left the system"
    },
    
    exportDestination: {
      type: "varchar",
      nullable: true,
      name: "export_destination",
      comment: "Where data was exported to"
    },
    
    dataSize: {
      type: "bigint",
      nullable: true,
      name: "data_size",
      comment: "Size of data involved in bytes"
    },
    
    // Compliance Specific
    retentionPeriod: {
      type: "int",
      nullable: true,
      name: "retention_period",
      comment: "How long this log should be retained (days)"
    },
    
    minimumDisclosure: {
      type: "boolean",
      default: true,
      name: "minimum_disclosure",
      comment: "Whether minimum necessary disclosure was followed"
    },
    
    consentChecked: {
      type: "boolean",
      default: false,
      name: "consent_checked",
      comment: "Whether patient consent was verified"
    },
    
    consentId: {
      type: "uuid",
      nullable: true,
      name: "consent_id",
      comment: "Which consent record was used"
    },
    
    // Risk Assessment
    riskScore: {
      type: "int",
      nullable: true,
      name: "risk_score",
      comment: "Calculated risk score (0-100)"
    },
    
    riskFactors: {
      type: "jsonb",
      nullable: true,
      name: "risk_factors",
      comment: "Factors that contributed to risk score"
    },
    
    // Additional Metadata
    metadata: {
      type: "jsonb",
      nullable: true,
      comment: "Additional event-specific metadata"
    },
    
    // Tampering Detection
    digitalSignature: {
      type: "text",
      nullable: true,
      name: "digital_signature",
      comment: "Digital signature for tamper detection"
    },
    
    checksumHash: {
      type: "varchar",
      nullable: true,
      name: "checksum_hash",
      comment: "Hash of the complete log entry"
    },
    
    // Timing
    eventTimestamp: {
      type: "timestamp",
      nullable: false,
      name: "event_timestamp",
      comment: "When the actual event occurred"
    },
    
    loggedAt: {
      type: "timestamp",
      createDate: true,
      name: "logged_at",
      comment: "When this log entry was created"
    }
  },
  
  relations: {
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "user_id" },
      nullable: true
    },
    resource: {
      type: "many-to-one", 
      target: "DocumentFile",
      joinColumn: { name: "resource_id" },
      nullable: true
    },
    encryptionKey: {
      type: "many-to-one",
      target: "EncryptionKey",
      joinColumn: { name: "encryption_key_id" },
      nullable: true
    },
    consent: {
      type: "many-to-one",
      target: "PatientConsent",
      joinColumn: { name: "consent_id" },
      nullable: true
    }
  },
  
  indices: [
    { name: "IDX_AUDIT_EVENT_TYPE", columns: ["eventType"] },
    { name: "IDX_AUDIT_USER", columns: ["userId"] },
    { name: "IDX_AUDIT_PATIENT", columns: ["patientIdentifier"] },
    { name: "IDX_AUDIT_TIMESTAMP", columns: ["eventTimestamp"] },
    { name: "IDX_AUDIT_SEVERITY", columns: ["severity"] },
    { name: "IDX_AUDIT_OUTCOME", columns: ["outcome"] },
    { name: "IDX_AUDIT_EMERGENCY", columns: ["isEmergencyAccess"] },
    { name: "IDX_AUDIT_COMPLIANCE", columns: ["complianceFrameworks"] },
    { name: "IDX_AUDIT_RISK", columns: ["riskScore"] },
    { name: "IDX_AUDIT_TAMPER", columns: ["checksumHash"] }
  ]
});

// Export enums
module.exports.AuditEventType = AuditEventType;
module.exports.AuditSeverity = AuditSeverity;
module.exports.ComplianceFramework = ComplianceFramework;
