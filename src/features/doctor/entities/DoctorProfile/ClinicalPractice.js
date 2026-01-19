const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ClinicalPractice',
  tableName: 'clinical_practices',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    clinicName: { type: 'varchar' },
    location: { type: 'varchar' },
    daysAvailableFrom: { type: 'varchar' },
    daysAvailableTo: { type: 'varchar' },
    timeAvailableFrom: { type: 'time' },
    timeAvailableTo: { type: 'time' },
    consultationFee: { type: 'float' },
    createdAt: { type: 'timestamp', createDate: true },
    updatedAt: { type: 'timestamp', updateDate: true },
  },
  relations: {
    doctorProfile: {
      type: 'one-to-one',
      target: 'DoctorProfile',
      inverseSide: 'clinicalPractice',
      joinColumn: { name: 'doctorProfileId' },
      onDelete: "CASCADE"
    },
  },
});