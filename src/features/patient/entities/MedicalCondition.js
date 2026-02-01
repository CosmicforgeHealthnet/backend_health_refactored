const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'MedicalCondition',
  tableName: 'medical_conditions',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    name: { type: 'varchar', nullable: true },
    year: { type: 'integer', nullable: true },
    status: { type: 'varchar', nullable: true }, // e.g., 'Active', 'Resolved'
    createdAt: { type: 'timestamp', createDate: true },
  },
  relations: {
    patientProfile: {
      type: 'many-to-one',
      target: 'PatientProfile',
      inverseSide: 'medicalConditions',
      joinColumn: { name: 'patientProfileId' },
      onDelete: 'CASCADE'
    },
  },
});