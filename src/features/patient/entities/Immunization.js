// Immunization Schema
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Immunization",
  tableName: "immunizations",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    vaccine: { type: "varchar", nullable: true },
    certificateUrl: { type: "varchar", nullable: true },
    date: { type: "date", nullable: true },
    dose: { type: "varchar", nullable: true },
    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    patientProfile: {
      type: "many-to-one",
      target: "PatientProfile",
      inverseSide: "immunizations",
      joinColumn: { name: "patientProfileId" },
      onDelete: "CASCADE",
    },
  },
});
