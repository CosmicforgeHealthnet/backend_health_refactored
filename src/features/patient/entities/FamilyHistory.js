// FamilyHistory Schema
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "FamilyHistory",
  tableName: "family_histories",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    medicalCondition: { type: "varchar", nullable: true },
    affectedRelative: { type: "varchar", nullable: true }, // e.g., 'Mother', 'Father'
    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    patientProfile: {
      type: "many-to-one",
      target: "PatientProfile",
      inverseSide: "familyHistories",
      joinColumn: { name: "patientProfileId" },
      onDelete: "CASCADE",
    },
  },
});
