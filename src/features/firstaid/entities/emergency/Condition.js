// Condition.js
const { EntitySchema } = require("typeorm");

const ContentTypeEnum = {
  EMERGENCY: "emergency",
  NON_EMERGENCY: "non_emergency",
};

module.exports = new EntitySchema({
  name: "Condition",
  tableName: "conditions",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    name: { type: "varchar", nullable: false },
    description: { type: "text", nullable: true },
    contentType: {
      type: "enum",
      enum: Object.values(ContentTypeEnum),
      nullable: false,
      name: "content_type",
    },
    // One-to-one relationship with DocumentFile for condition image
    image_file_id: {
      type: "uuid",
      nullable: true,
      comment: "Primary condition image - one image per condition",
    },
    severity: {
      type: "enum",
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    isActive: {
      type: "boolean",
      default: true,
      name: "is_active",
    },
    sortOrder: {
      type: "int",
      default: 0,
      name: "sort_order",
    },
    metadata: {
      type: "jsonb",
      nullable: true,
      comment: "Additional condition metadata",
    },
    createdAt: {
      type: "timestamp",
      createDate: true,
      name: "created_at",
    },
    updatedAt: {
      type: "timestamp",
      updateDate: true,
      name: "updated_at",
    },
  },
  relations: {
    imageFile: {
      type: "one-to-one",
      target: "DocumentFile",
      joinColumn: { name: "image_file_id" },
      nullable: true,
      onDelete: "SET NULL", // Set to NULL when DocumentFile is deleted
    },
    emergencySteps: {
      type: "one-to-many",
      target: "EmergencyStep",
      inverseSide: "condition",
      cascade: true, // Cascade operations (save, update, remove) to EmergencySteps
    },
  },
  indices: [
    { name: "IDX_CONDITION_CONTENT_TYPE", columns: ["contentType"] },
    { name: "IDX_CONDITION_IMAGE", columns: ["image_file_id"] },
    { name: "IDX_CONDITION_SEVERITY", columns: ["severity"] },
    { name: "IDX_CONDITION_ACTIVE", columns: ["isActive"] },
  ],
});
