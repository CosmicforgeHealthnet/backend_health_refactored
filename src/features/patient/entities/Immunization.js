// Immunization Schema
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Immunization",
  tableName: "immunizations",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    vaccine: { type: "varchar" },
    certificateUrl: { type: "varchar", nullable: true },
    date: { type: "date" },
    dose: { type: "varchar" },
    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    patientProfile: {
      type: "one-to-one",
      target: "PatientProfile",
      inverseSide: "immunizations",
      joinColumn: { name: "patientProfileId" },
      onDelete: "CASCADE",
    },
  },
});
