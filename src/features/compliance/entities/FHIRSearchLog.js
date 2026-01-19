const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "FHIRSearchLog",
  tableName: "fhir_search_logs",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    user_id: {
      type: "uuid",
      nullable: false
    },
    searchCriteria: {
      type: "jsonb",
      nullable: false,
      name: "search_criteria"
    },
    resultCount: {
      type: "int",
      nullable: false,
      name: "result_count"
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
    searchedAt: {
      type: "timestamp",
      createDate: true,
      name: "searched_at"
    },
    metadata: { type: "jsonb", nullable: true }
  },
  relations: {
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "user_id" },
      onDelete: "CASCADE",
      nullable: false
    }
  },
  indices: [
    { name: "IDX_FHIR_SEARCH_USER", columns: ["user_id"] },
    { name: "IDX_FHIR_SEARCH_TIME", columns: ["searchedAt"] },
    { name: "IDX_FHIR_SEARCH_RESULTS", columns: ["resultCount"] }
  ]
});