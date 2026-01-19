// Consent Schema
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Consent",
  tableName: "consents",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    telemedicine: { type: "boolean", default: false },
    dataCollection: { type: "boolean", default: false },
    recordSharing: { type: "boolean", default: false },
    emergencyContact: { type: "boolean", default: false },
    preferredCommunication: { type: "varchar" },
    languagePreference: { type: "varchar" },
    healthTips: { type: "boolean", default: false },
    familyAccess: { type: "boolean", default: false },
    notificationsAppointments: { type: "boolean", default: false },
    notificationsPrescriptions: { type: "boolean", default: false },
    notificationsTestResults: { type: "boolean", default: false },
    notificationsPromotions: { type: "boolean", default: false },
    signature: { type: "varchar", nullable: true },
    createdAt: { type: "timestamp", createDate: true },
  },
  relations: {
    patientProfile: {
      type: "one-to-one",
      target: "PatientProfile",
      inverseSide: "consent",
      joinColumn: { name: "patientProfileId" },
      onDelete: "CASCADE",
    },
  },
});
