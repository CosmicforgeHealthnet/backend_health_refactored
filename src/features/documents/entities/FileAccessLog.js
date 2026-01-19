// src/entities/FileAccessLog.js
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
  name: "FileAccessLog",
  tableName: "file_access_logs",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    accessType: { 
      type: "enum", 
      enum: Object.values(AccessType), 
      nullable: false,
      name: "access_type"  // Explicit column name mapping
    },
    file_id: { 
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
    downloadDuration: { 
      type: "int", 
      nullable: true,
      name: "download_duration"  // Explicit column name mapping
    },
    accessedAt: { 
      type: "timestamp", 
      createDate: true,
      name: "accessed_at"  // Explicit column name mapping
    },
    metadata: { type: "jsonb", nullable: true },
  },
  relations: {
    file: {
      type: "many-to-one",
      target: "DocumentFile",
      joinColumn: { name: "file_id" },
      nullable: false,
    },
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "user_id" },
      onDelete: "CASCADE",
      nullable: false,
    },
  },
  indices: [
    { name: "IDX_FILE_ACCESS_FILE", columns: ["file_id"] },
    { name: "IDX_FILE_ACCESS_USER", columns: ["user_id"] },
    { name: "IDX_FILE_ACCESS_TIME", columns: ["accessedAt"] },  // Use property name
  ],
});

module.exports.AccessType = AccessType;