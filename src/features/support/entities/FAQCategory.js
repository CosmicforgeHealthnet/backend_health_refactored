// src/entities/FAQ/FAQCategory.js
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "FAQCategory",
  tableName: "faq_categories",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    name: { type: "varchar", length: 200, nullable: false },
    slug: { type: "varchar", length: 250, unique: true, nullable: false },
    description: { type: "text", nullable: true },
    icon: { type: "varchar", length: 100, nullable: true },
    color: { type: "varchar", length: 50, nullable: true },
    targetRole: {
      type: "enum",
      enum: ["patient", "doctor", "general", "all"],
      default: "general",
    },
    isActive: { type: "boolean", default: true },
    sortOrder: { type: "integer", default: 0 },
    metadata: { type: "jsonb", nullable: true },
    createdAt: { type: "timestamp", createDate: true },
    updatedAt: { type: "timestamp", updateDate: true },
  },
  relations: {
    faqs: {
      type: "one-to-many",
      target: "FAQ",
      inverseSide: "category",
    },
  },
  indices: [
    { columns: ["slug"] },
    { columns: ["targetRole"] },
    { columns: ["isActive"] },
    { columns: ["sortOrder"] },
  ],
});