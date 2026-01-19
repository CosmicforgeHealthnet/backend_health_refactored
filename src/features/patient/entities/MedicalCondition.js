const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'MedicalCondition',
  tableName: 'medical_conditions',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    name: { type: 'varchar' },
    year: { type: 'integer' },
    status: { type: 'varchar' }, // e.g., 'Active', 'Resolved'
    createdAt: { type: 'timestamp', createDate: true },
  },
  relations: {
    patientProfile: {
      type: 'one-to-one',
      target: 'PatientProfile',
      inverseSide: 'medicalConditions',
      joinColumn: { name: 'patientProfileId' },
      onDelete: 'CASCADE'
    },
  },
});