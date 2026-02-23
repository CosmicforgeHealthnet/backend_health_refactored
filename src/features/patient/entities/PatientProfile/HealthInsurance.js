// HealthInsurance Schema
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "HealthInsurance",
  tableName: "health_insurances",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    providerName: { type: "varchar" },
    validityDate: { type: "date" },
    policyNo: { type: "varchar" },
    healthCardUrl: { type: "varchar", nullable: true },
    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    patientProfile: {
      type: "one-to-one",
      target: "PatientProfile",
      inverseSide: "healthInsurance",
      joinColumn: { name: "patientProfileId" },
      onDelete: "CASCADE",
    },
  },
});
