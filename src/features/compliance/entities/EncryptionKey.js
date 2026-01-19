// ===== 1. ENCRYPTION KEY MANAGEMENT ENTITY =====
// src/entities/EncryptionKey.js
const { EntitySchema } = require("typeorm");

const KeyType = {
  MASTER: "master",
  PATIENT: "patient", 
  RESOURCE: "resource",
  SENSITIVITY: "sensitivity",
  PURPOSE: "purpose"
};

const KeyStatus = {
  ACTIVE: "active",
  ROTATED: "rotated",
  REVOKED: "revoked",
  EXPIRED: "expired"
};

const EncryptionAlgorithm = {
  AES_256_GCM: "aes-256-gcm",
  AES_256_CBC: "aes-256-cbc",
  CHACHA20_POLY1305: "chacha20-poly1305"
};

module.exports = new EntitySchema({
  name: "EncryptionKey",
  tableName: "encryption_keys",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // Key Identification
    keyIdentifier: {
      type: "varchar",
      unique: true,
      nullable: false,
      name: "key_identifier",
      comment: "Unique identifier for the key"
    },
    
    keyType: {
      type: "enum",
      enum: Object.values(KeyType),
      nullable: false,
      name: "key_type"
    },
    
    keyStatus: {
      type: "enum", 
      enum: Object.values(KeyStatus),
      default: KeyStatus.ACTIVE,
      name: "key_status"
    },
    
    // Key Context
    patientIdentifier: {
      type: "varchar",
      nullable: true,
      name: "patient_identifier",
      comment: "Patient ID for patient-specific keys"
    },
    
    fhirResourceType: {
      type: "varchar",
      nullable: true,
      name: "fhir_resource_type",
      comment: "FHIR resource type for resource-specific keys"
    },
    
    sensitivityLevel: {
      type: "varchar",
      nullable: true,
      name: "sensitivity_level",
      comment: "Sensitivity level for sensitivity-based keys"
    },
    
    purposeOfUse: {
      type: "varchar",
      nullable: true,
      name: "purpose_of_use",
      comment: "Purpose of use for purpose-based keys"
    },
    
    // Encryption Details
    algorithm: {
      type: "enum",
      enum: Object.values(EncryptionAlgorithm),
      default: EncryptionAlgorithm.AES_256_GCM,
      nullable: false
    },
    
    keySize: {
      type: "int",
      default: 256,
      name: "key_size",
      comment: "Key size in bits"
    },
    
    // Key Storage (encrypted)
    encryptedKey: {
      type: "text",
      nullable: false,
      name: "encrypted_key",
      comment: "The actual encryption key, encrypted with master key"
    },
    
    keyDerivationSalt: {
      type: "varchar",
      nullable: true,
      name: "key_derivation_salt",
      comment: "Salt used for key derivation"
    },
    
    initializationVector: {
      type: "varchar",
      nullable: true,
      name: "initialization_vector",
      comment: "IV used for key encryption"
    },
    
    // Key Rotation
    version: { 
      type: "int", 
      default: 1,
      comment: "Key version for rotation tracking"
    },
    
    parentKeyId: {
      type: "uuid",
      nullable: true,
      name: "parent_key_id",
      comment: "Parent key for hierarchical key management"
    },
    
    rotatedFromKeyId: {
      type: "uuid",
      nullable: true,
      name: "rotated_from_key_id",
      comment: "Previous key that this rotated from"
    },
    
    // Lifecycle Management
    createdBy: {
      type: "uuid",
      nullable: false,
      name: "created_by"
    },
    
    effectiveDate: {
      type: "timestamp",
      nullable: false,
      name: "effective_date",
      comment: "When key becomes effective"
    },
    
    expirationDate: {
      type: "timestamp",
      nullable: true,
      name: "expiration_date",
      comment: "When key expires"
    },
    
    rotationSchedule: {
      type: "jsonb",
      nullable: true,
      name: "rotation_schedule",
      comment: "Automatic rotation schedule"
    },
    
    // Usage Tracking
    usageCount: {
      type: "bigint",
      default: 0,
      name: "usage_count",
      comment: "Number of times key has been used"
    },
    
    lastUsedAt: {
      type: "timestamp",
      nullable: true,
      name: "last_used_at"
    },
    
    maxUsageCount: {
      type: "bigint",
      nullable: true,
      name: "max_usage_count",
      comment: "Maximum allowed usage before rotation"
    },
    
    // Security Metadata
    keyStrength: {
      type: "int",
      nullable: true,
      name: "key_strength",
      comment: "Calculated key strength score"
    },
    
    complianceFlags: {
      type: "jsonb",
      nullable: true,
      name: "compliance_flags",
      comment: "Compliance-related flags and metadata"
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
    createdByUser: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "created_by" },
      nullable: false
    },
    parentKey: {
      type: "many-to-one",
      target: "EncryptionKey",
      joinColumn: { name: "parent_key_id" },
      nullable: true
    },
    childKeys: {
      type: "one-to-many",
      target: "EncryptionKey",
      inverseSide: "parentKey"
    },
    rotatedFromKey: {
      type: "many-to-one",
      target: "EncryptionKey",
      joinColumn: { name: "rotated_from_key_id" },
      nullable: true
    }
  },
  
  indices: [
    { name: "IDX_KEY_IDENTIFIER", columns: ["keyIdentifier"], unique: true },
    { name: "IDX_KEY_TYPE_STATUS", columns: ["keyType", "keyStatus"] },
    { name: "IDX_PATIENT_KEY", columns: ["patientIdentifier", "keyStatus"] },
    { name: "IDX_RESOURCE_KEY", columns: ["fhirResourceType", "keyStatus"] },
    { name: "IDX_KEY_EXPIRATION", columns: ["expirationDate"] },
    { name: "IDX_KEY_USAGE", columns: ["usageCount", "maxUsageCount"] }
  ]
});

// Export enums
module.exports.KeyType = KeyType;
module.exports.KeyStatus = KeyStatus;
module.exports.EncryptionAlgorithm = EncryptionAlgorithm;