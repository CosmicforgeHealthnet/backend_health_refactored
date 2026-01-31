// Medication Schema
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Medication",
  tableName: "medications",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    name: { type: "varchar" },
    dose: { type: "varchar", nullable: true }, // e.g., '500mg'
    frequency: { type: "varchar", nullable: true }, // e.g., 'Twice daily'
    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    patientProfile: {
      type: "many-to-one",
      target: "PatientProfile",
      inverseSide: "medications",
      joinColumn: { name: "patientProfileId" },
      onDelete: "CASCADE",
    },
  },
});
