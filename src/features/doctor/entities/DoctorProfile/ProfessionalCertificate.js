const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ProfessionalCertificate',
  tableName: 'professional_certificates',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    institution: { type: 'varchar' },
    degree: { type: 'varchar' },
    fieldOfStudy: { type: 'varchar' },
    startYear: { type: 'integer' },
    endYear: { type: 'integer' },
    certificateName: { type: 'varchar' },
    issuingBody: { type: 'varchar' },
    issueDate: { type: 'date' },
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