// Disability Schema
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Disability",
  tableName: "disabilities",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    hasDisability: { type: "boolean", default: false },
    type: { type: "varchar", nullable: true },
    dateDiagnosed: { type: "date", nullable: true },
    assistiveDevice: { type: "varchar", nullable: true },
    description: { type: "text", nullable: true },
    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    patientProfile: {
      type: "one-to-one",
      target: "PatientProfile",
      inverseSide: "disability",
      joinColumn: { name: "patientProfileId" },
      onDelete: "CASCADE",
    },
  },
});
