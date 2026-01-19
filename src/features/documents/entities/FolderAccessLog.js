// src/entities/FolderAccessLog.js
const { EntitySchema } = require("typeorm");

const AccessType = {
  VIEW: "view",
  DOWNLOAD: "download",
  UPLOAD: "upload",
  DELETE: "delete",
  SHARE: "share",
  MODIFY: "modify",
};

module.exports = new EntitySchema({
  name: "FolderAccessLog",
  tableName: "folder_access_logs",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    accessType: { 
      type: "enum", 
      enum: Object.values(AccessType), 
      nullable: false,
      name: "access_type"  // Explicit column name mapping
    },
    folder_id: { 
      type: "uuid", 
      nullable: false 
    },
    user_id: { 
      type: "uuid", 
      nullable: false 
    },
    ipAddress: { 
      type: "varchar", 
      nullable: true,
      name: "ip_address"  // Explicit column name mapping
    },
    userAgent: { 
      type: "text", 
      nullable: true,
      name: "user_agent"  // Explicit column name mapping
    },
    accessedAt: { 
      type: "timestamp", 
      createDate: true,
      name: "accessed_at"  // Explicit column name mapping
    },
    metadata: { type: "jsonb", nullable: true },
  },
  relations: {
    folder: {
      type: "many-to-one",
      target: "DocumentFolder",
      joinColumn: { name: "folder_id" },
      nullable: false,
    },
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "user_id" },
      onDelete: "CASCADE",
      nullable: false
    },
  },
  indices: [
    { name: "IDX_FOLDER_ACCESS_FOLDER", columns: ["folder_id"] },
    { name: "IDX_FOLDER_ACCESS_USER", columns: ["user_id"] },
    { name: "IDX_FOLDER_ACCESS_TIME", columns: ["accessedAt"] },  // Use property name
  ],
});

// Export the AccessType enum too
module.exports.AccessType = AccessType;