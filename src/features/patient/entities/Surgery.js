// Surgery Schema

const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Surgery",
  tableName: "surgeries",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    name: { type: "varchar", nullable: true },
    date: { type: "date", nullable: true },
    location: { type: "varchar", nullable: true },
    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    patientProfile: {
      type: "many-to-one",
      target: "PatientProfile",
      inverseSide: "surgeries",
      joinColumn: { name: "patientProfileId" },
      onDelete: "CASCADE",
    },
  },
});
