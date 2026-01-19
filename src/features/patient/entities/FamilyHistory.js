// FamilyHistory Schema
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "FamilyHistory",
  tableName: "family_histories",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    medicalCondition: { type: "varchar" },
    affectedRelative: { type: "varchar" }, // e.g., 'Mother', 'Father'
    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    patientProfile: {
      type: "one-to-one",
      target: "PatientProfile",
      inverseSide: "familyHistories",
      joinColumn: { name: "patientProfileId" },
      onDelete: "CASCADE",
    },
  },
});
