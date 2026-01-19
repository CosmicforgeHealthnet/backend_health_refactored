// =====================================================
// 1. ENTITIES
// =====================================================

// src/entities/FAQ/FAQ.js
const { EntitySchema } = require("typeorm");

const Status = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
};

const TargetRole = {
  PATIENT: "patient",
  DOCTOR: "doctor",
  GENERAL: "general",
  ALL: "all",
};

module.exports = new EntitySchema({
  name: "FAQ",
  tableName: "faqs",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    title: { type: "varchar", length: 500, nullable: false },
    content: { type: "text", nullable: false },
    slug: { type: "varchar", length: 600, unique: true, nullable: false },
    targetRole: {
      type: "enum",
      enum: Object.values(TargetRole),
      default: TargetRole.GENERAL,
    },
    status: {
      type: "enum",
      enum: Object.values(Status),
      default: Status.DRAFT,
    },
    isStatic: { type: "boolean", default: false },
    priority: { type: "integer", default: 0 },
    viewCount: { type: "integer", default: 0 },
    helpfulVotes: { type: "integer", default: 0 },
    notHelpfulVotes: { type: "integer", default: 0 },
    searchKeywords: { type: "text", nullable: true },
    relatedLinks: { type: "jsonb", nullable: true },
    metadata: { type: "jsonb", nullable: true },
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
    publishedAt: { type: "timestamp", nullable: true },
    createdBy: { type: "uuid", nullable: true },
    updatedBy: { type: "uuid", nullable: true },
  },
  relations: {
    category: {
      type: "many-to-one",
      target: "FAQCategory",
      joinColumn: { name: "categoryId" },
      inverseSide: "faqs",
    },
    votes: {
      type: "one-to-many",
      target: "FAQVote",
      inverseSide: "faq",
    },
    analytics: {
      type: "one-to-many",
      target: "FAQAnalytics",
      inverseSide: "faq",
    },
    creator: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",
      joinColumn: { name: "createdBy" },
    },
    updater: {
      type: "many-to-one",
      target: "User",
      onDelete: "CASCADE",
      joinColumn: { name: "updatedBy" },
    },
  },
  indices: [
    { columns: ["slug"] },
    { columns: ["targetRole"] },
    { columns: ["status"] },
    { columns: ["isStatic"] },
    { columns: ["priority"] },
    { columns: ["createdAt"] },
    { columns: ["publishedAt"] },
  ],
});