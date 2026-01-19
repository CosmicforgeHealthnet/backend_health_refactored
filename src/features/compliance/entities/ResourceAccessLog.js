const { EntitySchema } = require("typeorm");

const AccessType = {
  VIEW: "view",
  SEARCH: "search",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  DOWNLOAD: "download"  // Add this line
};

module.exports = new EntitySchema({
  name: "ResourceAccessLog",
  tableName: "resource_access_logs",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    resourceType: {
      type: "varchar",
      nullable: false,
      name: "resource_type"
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
    { name: "IDX_RESOURCE_ACCESS_TYPE", columns: ["resourceType"] },
    { name: "IDX_RESOURCE_ACCESS_USER", columns: ["user_id"] },
    { name: "IDX_RESOURCE_ACCESS_TIME", columns: ["accessedAt"] }
  ]
});

module.exports.AccessType = AccessType;