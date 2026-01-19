// Allergy Schema
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Allergy",
  tableName: "allergies",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    type: { type: "varchar" }, // e.g., 'Food', 'Drug'
    allergen: { type: "varchar" },
    description: { type: "text" },
    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    patientProfile: {
      type: "one-to-one",
      target: "PatientProfile",
      inverseSide: "allergies",
      joinColumn: { name: "patientProfileId" },
      onDelete: "CASCADE"
    },
  },
});
