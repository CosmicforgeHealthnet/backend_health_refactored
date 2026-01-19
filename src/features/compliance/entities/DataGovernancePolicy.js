// src/entities/DataGovernancePolicy.js
const { EntitySchema } = require("typeorm");

const PolicyType = {
  RETENTION: "retention",
  ANONYMIZATION: "anonymization",
  ACCESS_CONTROL: "access_control",
  DATA_CLASSIFICATION: "data_classification",
  CROSS_BORDER: "cross_border",
  PRIVACY_PRESERVATION: "privacy_preservation"
};

const PolicyStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  PENDING: "pending",
  DEPRECATED: "deprecated"
};

const DataJurisdiction = {
  US: "us",
  EU: "eu",
  UK: "uk",
  CANADA: "canada",
  AUSTRALIA: "australia",
  GLOBAL: "global"
};

module.exports = new EntitySchema({
  name: "DataGovernancePolicy",
  tableName: "data_governance_policies",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // Policy Identification
    policyName: {
      type: "varchar",
      nullable: false,
      name: "policy_name"
    },
    
    policyType: {
      type: "enum",
      enum: Object.values(PolicyType),
      nullable: false,
      name: "policy_type"
    },
    
    policyVersion: {
      type: "varchar",
      nullable: false,
      default: "1.0",
      name: "policy_version"
    },
    
    policyStatus: {
      type: "enum",
      enum: Object.values(PolicyStatus),
      default: PolicyStatus.ACTIVE,
      name: "policy_status"
    },
    
    // Policy Definition
    policyDescription: {
      type: "text",
      nullable: false,
      name: "policy_description"
    },
    
    policyRules: {
      type: "jsonb",
      nullable: false,
      name: "policy_rules",
      comment: "JSON object defining the policy rules"
    },
    
    // Scope and Applicability
    applicableDataTypes: {
      type: "jsonb",
      nullable: true,
      name: "applicable_data_types",
      comment: "FHIR resource types this policy applies to"
    },
    
    applicableJurisdictions: {
      type: "jsonb",
      nullable: false,
      default: '["global"]',
      name: "applicable_jurisdictions"
    },
    
    sensitivityLevels: {
      type: "jsonb",
      nullable: true,
      name: "sensitivity_levels",
      comment: "Data sensitivity levels this policy applies to"
    },
    
    // Automation
    isAutomated: {
      type: "boolean",
      default: false,
      name: "is_automated",
      comment: "Whether this policy is automatically enforced"
    },
    
    automationSchedule: {
      type: "jsonb",
      nullable: true,
      name: "automation_schedule",
      comment: "Cron-like schedule for automated enforcement"
    },
    
    // Compliance
    regulatoryBasis: {
      type: "jsonb",
      nullable: true,
      name: "regulatory_basis",
      comment: "Regulatory requirements this policy addresses"
    },
    
    complianceFrameworks: {
      type: "jsonb",
      nullable: false,
      default: '[]',
      name: "compliance_frameworks"
    },
    
    // Lifecycle
    effectiveDate: {
      type: "timestamp",
      nullable: false,
      name: "effective_date"
    },
    
    expirationDate: {
      type: "timestamp",
      nullable: true,
      name: "expiration_date"
    },
    
    reviewDate: {
      type: "timestamp",
      nullable: true,
      name: "review_date",
      comment: "When this policy should be reviewed"
    },
    
    // Ownership
    policyOwner: {
      type: "uuid",
      nullable: false,
      name: "policy_owner"
    },
    
    approvedBy: {
      type: "uuid",
      nullable: true,
      name: "approved_by"
    },
    
    approvalDate: {
      type: "timestamp",
      nullable: true,
      name: "approval_date"
    },
    
    // Metrics
    enforcementCount: {
      type: "bigint",
      default: 0,
      name: "enforcement_count",
      comment: "Number of times this policy has been enforced"
    },
    
    violationCount: {
      type: "bigint",
      default: 0,
      name: "violation_count",
      comment: "Number of policy violations detected"
    },
    
    lastEnforcedAt: {
      type: "timestamp",
      nullable: true,
      name: "last_enforced_at"
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
    owner: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "policy_owner" },
      nullable: false
    },
    approver: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "approved_by" },
      nullable: true
    }
  },
  
  indices: [
    { name: "IDX_POLICY_TYPE_STATUS", columns: ["policyType", "policyStatus"] },
    { name: "IDX_POLICY_EFFECTIVE", columns: ["effectiveDate", "expirationDate"] },
    { name: "IDX_POLICY_JURISDICTION", columns: ["applicableJurisdictions"] },
    { name: "IDX_POLICY_AUTOMATED", columns: ["isAutomated"] },
    { name: "IDX_POLICY_REVIEW", columns: ["reviewDate"] }
  ]
});

// Export enums
module.exports.PolicyType = PolicyType;
module.exports.PolicyStatus = PolicyStatus;
module.exports.DataJurisdiction = DataJurisdiction;
