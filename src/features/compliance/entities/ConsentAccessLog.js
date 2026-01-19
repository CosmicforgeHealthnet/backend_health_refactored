// src/entities/ConsentAccessLog.js
const { EntitySchema } = require("typeorm");

const ConsentAccessLogSchema = new EntitySchema({
  name: "ConsentAccessLog",
  tableName: "consent_access_logs",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // Consent Reference
    consent_id: { type: "uuid", nullable: false },
    
    // Access Information
    accessedBy: { type: "uuid", nullable: false, name: "accessed_by" },
    accessType: {
      type: "varchar",
      nullable: false,
      name: "access_type",
      comment: "Type of access (view, download, modify, etc.)"
    },
    
    purposeOfUse: {
      type: "varchar",
      nullable: false,
      name: "purpose_of_use",
      comment: "Stated purpose of use for this access"
    },
    
    // Technical Details
    ipAddress: { type: "varchar", nullable: true, name: "ip_address" },
    userAgent: { type: "text", nullable: true, name: "user_agent" },
    
    // Decision Information
    accessGranted: {
      type: "boolean",
      nullable: false,
      name: "access_granted",
      comment: "Whether access was granted or denied"
    },
    
    denyReason: {
      type: "text",
      nullable: true,
      name: "deny_reason",
      comment: "Reason for access denial"
    },
    
    // Emergency Access
    isEmergencyAccess: {
      type: "boolean",
      default: false,
      name: "is_emergency_access",
      comment: "Whether this was emergency break-glass access"
    },
    
    emergencyJustification: {
      type: "text",
      nullable: true,
      name: "emergency_justification"
    },
    
    // Metadata
    metadata: { type: "jsonb", nullable: true },
    
    accessedAt: {
      type: "timestamp",
      createDate: true,
      name: "accessed_at"
    }
  },
  
  relations: {
    consent: {
      type: "many-to-one",
      target: "PatientConsent",
      joinColumn: { name: "consent_id" },
      nullable: false
    },
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "accessed_by" },
      nullable: false
    }
  },
  
  indices: [
    { name: "IDX_CONSENT_ACCESS_CONSENT", columns: ["consent_id"] },
    { name: "IDX_CONSENT_ACCESS_USER", columns: ["accessedBy"] },
    { name: "IDX_CONSENT_ACCESS_DATE", columns: ["accessedAt"] },
    { name: "IDX_EMERGENCY_ACCESS", columns: ["isEmergencyAccess"] }
  ]
});

module.exports = ConsentAccessLogSchema;