const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'DoctorProfile',
  tableName: 'doctor_profiles',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    userId: { type: 'uuid', unique: true }, 
    profilePhoto: { type: 'varchar', nullable: true },
    gender: { type: 'varchar', nullable: true },
    dateOfBirth: { type: 'date', nullable: true },
    nationality: { type: 'varchar', nullable: true },
    contactNumber: { type: 'varchar', nullable: true },
    residentialAddress: { type: 'text', nullable: true },
    createdAt: { type: 'timestamp', createDate: true },
    updatedAt: { type: 'timestamp', updateDate: true },
  },
  relations: {
    user: {
      type: 'one-to-one',
      target: 'User',
      inverseSide: 'doctorProfile',
      joinColumn: { name: 'userId' },
      onDelete: 'CASCADE',
    },
    professionalLicense: {
      type: 'one-to-one',
      target: 'ProfessionalLicense',
      inverseSide: 'doctorProfile', 
      cascade: true
    },
    professionalCertificate: {
      type: 'one-to-one',
      target: 'ProfessionalCertificate',
      inverseSide: 'doctorProfile',
      cascade: true
    },
    clinicalPractice: {
      type: 'one-to-one',
      target: 'ClinicalPractice',
      inverseSide: 'doctorProfile',
      cascade: true
    },
    digitalHealthTools: {
      type: 'one-to-one',
      target: 'DigitalHealthTools',
      inverseSide: 'doctorProfile',
      cascade: true
    },
    wallet: {
      type: 'one-to-one',
      target: 'Wallet', 
      inverseSide: 'doctorProfile',
      cascade: true
    },
  },
});