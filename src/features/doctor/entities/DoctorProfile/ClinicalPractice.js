const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ClinicalPractice',
  tableName: 'clinical_practices',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    clinicName: { type: 'varchar', nullable: true },
    location: { type: 'varchar', nullable: true },
    daysAvailableFrom: { type: 'varchar', nullable: true },
    daysAvailableTo: { type: 'varchar', nullable: true },
    timeAvailableFrom: { type: 'time', nullable: true },
    timeAvailableTo: { type: 'time', nullable: true },
    consultationFee: { type: 'float', nullable: true },
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