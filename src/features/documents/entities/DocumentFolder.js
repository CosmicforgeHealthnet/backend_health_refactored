// src/entities/DocumentFolder.js
const { EntitySchema } = require("typeorm");

const FolderStatus = {
  ACTIVE: "active",
  ARCHIVED: "archived",
  DELETED: "deleted",
};

const FolderType = {
  VERIFICATION: "verification",
  MEDICAL_RECORDS: "medical_records",
  PRESCRIPTION: "prescription",
  LAB_RESULTS: "lab_results",
  PROFILE: "profile",
  IMAGES: "images",
  PHARMACY: "pharmacy",           // ADD THIS
  PHARMACY_VERIFICATION: "pharmacy_verification",
  OTHER: "other",
};

module.exports = new EntitySchema({
  name: "DocumentFolder",
  tableName: "document_folders",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    name: { type: "varchar", nullable: false },
    description: { type: "text", nullable: true },
    folderType: { 
      type: "enum", 
      enum: Object.values(FolderType), 
      default: FolderType.OTHER,
      name: "folder_type"  // Explicit column name mapping
    },
    status: { 
      type: "enum", 
      enum: Object.values(FolderStatus), 
      default: FolderStatus.ACTIVE 
    },
    // Add the owner_id column explicitly
    owner_id: { 
      type: "uuid", 
      nullable: false 
    },
    encryptionKey: { 
      type: "varchar", 
      nullable: true,
      name: "encryption_key"  // Explicit column name mapping
    },
    folderHash: { 
      type: "varchar", 
      nullable: true,
      name: "folder_hash"  // Explicit column name mapping
    },
    metadata: { type: "jsonb", nullable: true },
    tags: { type: "simple-array", nullable: true },
    isPublic: { 
      type: "boolean", 
      default: false,
      name: "is_public"  // Explicit column name mapping
    },
    expiresAt: { 
      type: "timestamp", 
      nullable: true,
      name: "expires_at"  // Explicit column name mapping
    },
    createdAt: { 
      type: "timestamp", 
      createDate: true,
      name: "created_at"  // Explicit column name mapping
    },
    updatedAt: { 
      type: "timestamp", 
      updateDate: true,
      name: "updated_at"  // Explicit column name mapping
    },
  },
  relations: {
    owner: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "owner_id" },
      nullable: false,
      onDelete: "CASCADE"
    },
    files: {
      type: "one-to-many",
      target: "DocumentFile",
      inverseSide: "folder",
      cascade: true,
    },
    accessLogs: {
      type: "one-to-many",
      target: "FolderAccessLog",
      inverseSide: "folder",
    },
  },
  indices: [
    { name: "IDX_FOLDER_OWNER", columns: ["owner_id"] },
    { name: "IDX_FOLDER_TYPE_STATUS", columns: ["folderType", "status"] },  // Use property names
    { name: "IDX_FOLDER_CREATED", columns: ["createdAt"] },  // Use property names
  ],
});

// Export enums for use in other files
module.exports.FolderStatus = FolderStatus;
module.exports.FolderType = FolderType;