const { EntitySchema } = require("typeorm");

const AccessType = {
  VIEW: "view",
  DOWNLOAD: "download",
  SEARCH: "search",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  VIEW_PATIENT_SUMMARY: "view_patient_summary",  // Add this
  VIEW_PATIENT_FILES: "view_patient_files",      // Add this
  EMERGENCY_ACCESS: "emergency_access"           // Add this for future use
};

module.exports = new EntitySchema({
  name: "PatientAccessLog",
  tableName: "patient_access_logs",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    patientIdentifier: {
      type: "varchar",
      nullable: false,
      name: "patient_identifier"
    },
    user_id: {
      type: "uuid",
      nullable: false
    },
    accessType: {
      type: "enum",
      enum: Object.values(AccessType),
      nullable: false,
      name: "access_type"
    },
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
    accessedAt: {
      type: "timestamp",
      createDate: true,
      name: "accessed_at"
    },
    metadata: { type: "jsonb", nullable: true }
  },
  relations: {
    user: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",
      joinColumn: { name: "user_id" },
      nullable: false
    }
  },
  indices: [
    { name: "IDX_PATIENT_ACCESS_PATIENT", columns: ["patientIdentifier"] },
    { name: "IDX_PATIENT_ACCESS_USER", columns: ["user_id"] },
    { name: "IDX_PATIENT_ACCESS_TIME", columns: ["accessedAt"] }
  ]
});

module.exports.AccessType = AccessType;