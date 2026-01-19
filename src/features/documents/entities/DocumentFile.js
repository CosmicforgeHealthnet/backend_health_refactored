// src/entities/DocumentFile.js
const { EntitySchema } = require("typeorm");

const FileStatus = {
  UPLOADED: "uploaded",
  PROCESSING: "processing",
  READY: "ready",
  CORRUPTED: "corrupted",
  DELETED: "deleted",
};

const SecurityLevel = {
  PUBLIC: "public",
  PRIVATE: "private",
  CONFIDENTIAL: "confidential",
  RESTRICTED: "restricted",
};

// NEW: FHIR-specific enums
const FHIRResourceType = {
  PATIENT: "Patient",
  PRACTITIONER: "Practitioner",
  ORGANIZATION: "Organization",
  OBSERVATION: "Observation",
  DIAGNOSTIC_REPORT: "DiagnosticReport",
  CONDITION: "Condition",
  PROCEDURE: "Procedure",
  MEDICATION_REQUEST: "MedicationRequest",
  MEDICATION_STATEMENT: "MedicationStatement",
  ALLERGY_INTOLERANCE: "AllergyIntolerance",
  IMMUNIZATION: "Immunization",
  CARE_PLAN: "CarePlan",
  ENCOUNTER: "Encounter",
  DOCUMENT_REFERENCE: "DocumentReference",
  CONSENT: "Consent",
  OTHER: "Other"
};

const FHIRSensitivityLevel = {
  NORMAL: "normal",
  HIGH: "high",
  VERY_HIGH: "very_high"
};

module.exports = new EntitySchema({
  name: "DocumentFile",
  tableName: "document_files",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    originalFileName: { 
      type: "varchar", 
      nullable: false,
      name: "original_file_name"
    },
    storedFileName: { 
      type: "varchar", 
      nullable: false,
      name: "stored_file_name"
    },
    filePath: { 
      type: "varchar", 
      nullable: false,
      name: "file_path"
    },
    fileSize: { 
      type: "bigint", 
      nullable: false,
      name: "file_size"
    },
    mimeType: { 
      type: "varchar", 
      nullable: false,
      name: "mime_type"
    },
    fileHash: { 
      type: "varchar", 
      nullable: false,
      name: "file_hash"
    },
    encryptionKey: { 
      type: "varchar", 
      nullable: true,
      name: "encryption_key"
    },
    documentType: { 
      type: "varchar", 
      nullable: false,
      name: "document_type"
    },
    status: {
      type: "enum",
      enum: Object.values(FileStatus),
      default: FileStatus.UPLOADED
    },
    securityLevel: {
      type: "enum",
      enum: Object.values(SecurityLevel),
      default: SecurityLevel.PRIVATE,
      name: "security_level"
    },
    
    // ===== NEW FHIR FIELDS =====
    
    // FHIR Resource Information
    fhirResourceType: {
      type: "enum",
      enum: Object.values(FHIRResourceType),
      nullable: true,
      name: "fhir_resource_type",
      comment: "FHIR resource type if document contains FHIR data"
    },
    
    // Patient Linking
    patientIdentifier: {
      type: "varchar",
      nullable: true,
      name: "patient_identifier",
      comment: "Patient ID extracted from FHIR resource for linking related documents"
    },
    
    // FHIR Security Labels (JSON array)
    fhirSecurityLabels: {
      type: "jsonb",
      nullable: true,
      name: "fhir_security_labels",
      comment: "FHIR security labels from meta.security field"
    },
    
    // Consent Management
    consentDirectives: {
      type: "jsonb",
      nullable: true,
      name: "consent_directives",
      comment: "Patient consent directives and restrictions"
    },
    
    // FHIR Version
    fhirVersion: {
      type: "varchar",
      nullable: true,
      name: "fhir_version",
      comment: "FHIR specification version (e.g., 4.0.1)"
    },
    
    // FHIR Sensitivity Level (more granular than securityLevel)
    fhirSensitivityLevel: {
      type: "enum",
      enum: Object.values(FHIRSensitivityLevel),
      nullable: true,
      default: FHIRSensitivityLevel.NORMAL,
      name: "fhir_sensitivity_level",
      comment: "FHIR-specific sensitivity classification"
    },
    
    // FHIR Resource ID
    fhirResourceId: {
      type: "varchar",
      nullable: true,
      name: "fhir_resource_id",
      comment: "Original FHIR resource ID"
    },

    // pharmacyDocument: {
    //   type: "one-to-one",
    //   target: "PharmacyDocument", 
    //   inverseSide: "documentFile",
    // },
    
    // Purpose of Use
    purposeOfUse: {
      type: "jsonb",
      nullable: true,
      name: "purpose_of_use",
      comment: "Intended purpose of use for access control"
    },
    
    // ===== END FHIR FIELDS =====
    
    // Add the foreign key columns explicitly
    folder_id: {
      type: "uuid",
      nullable: false
    },
    uploader_id: {
      type: "uuid",
      nullable: false
    },
    downloadCount: { 
      type: "int", 
      default: 0,
      name: "download_count"
    },
    lastAccessedAt: { 
      type: "timestamp", 
      nullable: true,
      name: "last_accessed_at"
    },
    metadata: { 
      type: "jsonb", 
      nullable: true,
      comment: "Extended metadata including FHIR-specific information"
    },
    thumbnailPath: { 
      type: "varchar", 
      nullable: true,
      name: "thumbnail_path"
    },
    isEncrypted: { 
      type: "boolean", 
      default: false,
      name: "is_encrypted"
    },
    checksum: { type: "varchar", nullable: true },
    version: { type: "int", default: 1 },
    createdAt: { 
      type: "timestamp", 
      createDate: true,
      name: "created_at"
    },
    updatedAt: { 
      type: "timestamp", 
      updateDate: true,
      name: "updated_at"
    },
  },
  relations: {
    folder: {
      type: "many-to-one",
      target: "DocumentFolder",
      joinColumn: { name: "folder_id" },
      nullable: false,
    },
    uploader: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "uploader_id" },
      nullable: false,
      onDelete: "CASCADE"
    },
    accessLogs: {
      type: "one-to-many",
      target: "FileAccessLog",
      inverseSide: "file",
    },
  },
  indices: [
    { name: "IDX_FILE_FOLDER", columns: ["folder_id"] },
    { name: "IDX_FILE_UPLOADER", columns: ["uploader_id"] },
    { name: "IDX_FILE_HASH", columns: ["fileHash"] },
    { name: "IDX_FILE_TYPE_STATUS", columns: ["documentType", "status"] },
    { name: "IDX_FILE_CREATED", columns: ["createdAt"] },
    
    // NEW: FHIR-specific indices for performance
    { name: "IDX_FHIR_RESOURCE_TYPE", columns: ["fhirResourceType"] },
    { name: "IDX_PATIENT_IDENTIFIER", columns: ["patientIdentifier"] },
    { name: "IDX_FHIR_SENSITIVITY", columns: ["fhirSensitivityLevel"] },
    { name: "IDX_PATIENT_RESOURCE", columns: ["patientIdentifier", "fhirResourceType"] },
  ],
});

// Export enums
module.exports.FileStatus = FileStatus;
module.exports.SecurityLevel = SecurityLevel;
module.exports.FHIRResourceType = FHIRResourceType;
module.exports.FHIRSensitivityLevel = FHIRSensitivityLevel;