const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ProfessionalCertificate',
  tableName: 'professional_certificates',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    institution: { type: 'varchar', nullable: true },
    degree: { type: 'varchar', nullable: true },
    fieldOfStudy: { type: 'varchar', nullable: true },
    startYear: { type: 'integer', nullable: true },
    endYear: { type: 'integer', nullable: true },
    certificateName: { type: 'varchar', nullable: true },
    issuingBody: { type: 'varchar', nullable: true },
    issueDate: { type: 'date', nullable: true },
    expiryDate: { type: 'date', nullable: true },
    certificateDocument: { type: 'varchar', nullable: true },
    verificationLink: { type: 'varchar', nullable: true },
    createdAt: { type: 'timestamp', createDate: true },
    updatedAt: { type: 'timestamp', updateDate: true },
  },
  relations: {
    doctorProfile: {
      type: 'one-to-one',
      target: 'DoctorProfile',
      inverseSide: 'professionalCertificate',
      joinColumn: { name: 'doctorProfileId' },
      onDelete: "CASCADE"

    },
  },
});