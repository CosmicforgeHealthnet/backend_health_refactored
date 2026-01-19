// src/entities/FAQ/FAQAnalytics.js
const { EntitySchema } = require("typeorm");

const EventType = {
  VIEW: "view",
  SEARCH: "search",
  VOTE: "vote",
  SHARE: "share",
};

module.exports = new EntitySchema({
  name: "FAQAnalytics",
  tableName: "faq_analytics",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    eventType: {
      type: "enum",
      enum: Object.values(EventType),
      nullable: false,
    },
    userRole: { type: "varchar", length: 50, nullable: true },
    searchQuery: { type: "varchar", length: 500, nullable: true },
    resultPosition: { type: "integer", nullable: true },
    sessionId: { type: "varchar", length: 100, nullable: true },
    ipAddress: { type: "varchar", length: 45, nullable: true },
    userAgent: { type: "text", nullable: true },
    referrer: { type: "varchar", length: 500, nullable: true },
    metadata: { type: "jsonb", nullable: true },
    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    faq: {
      type: "many-to-one",
      target: "FAQ",
      joinColumn: { name: "faqId" },
      inverseSide: "analytics",
      onDelete: "CASCADE",
      nullable: true,
    },
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "userId" },
      onDelete: "CASCADE",
      nullable: true,
    },
  },
  indices: [
    { columns: ["eventType"] },
    { columns: ["userRole"] },
    { columns: ["searchQuery"] },
    { columns: ["createdAt"] },
    { columns: ["sessionId"] },
  ],
});