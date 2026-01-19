// src/entities/FAQ/FAQVote.js
const { EntitySchema } = require("typeorm");

const VoteType = {
  HELPFUL: "helpful",
  NOT_HELPFUL: "not_helpful",
};

module.exports = new EntitySchema({
  name: "FAQVote",
  tableName: "faq_votes",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    faqId: { type: "uuid", nullable: false },
    userId: { type: "uuid", nullable: true },
    voteType: {
      type: "enum",
      enum: Object.values(VoteType),
      nullable: false,
    },
    userRole: { type: "varchar", length: 50, nullable: true },
    ipAddress: { type: "varchar", length: 45, nullable: true },
    userAgent: { type: "text", nullable: true },
    feedback: { type: "text", nullable: true },
    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    faq: {
      type: "many-to-one",
      target: "FAQ",
      joinColumn: { name: "faqId" },
      inverseSide: "votes",
      onDelete: "CASCADE",
    },
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "userId" },
      nullable: true,
    },
  },
  indices: [
    { columns: ["faqId", "userId"], unique: true },
    { columns: ["voteType"] },
    { columns: ["userRole"] },
    { columns: ["createdAt"] },
  ],
});