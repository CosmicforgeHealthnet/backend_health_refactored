// Allergy Schema
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Allergy",
  tableName: "allergies",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    type: { type: "varchar", nullable: true }, // e.g., 'Food', 'Drug'
    allergen: { type: "varchar", nullable: true },
    description: { type: "text", nullable: true },
    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    patientProfile: {
      type: "many-to-one",
      target: "PatientProfile",
      inverseSide: "allergies",
      joinColumn: { name: "patientProfileId" },
      onDelete: "CASCADE"
    },
  },
});
