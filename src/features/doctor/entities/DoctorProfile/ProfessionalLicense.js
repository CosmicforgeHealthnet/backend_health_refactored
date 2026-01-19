const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ProfessionalLicense',
  tableName: 'professional_licenses',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    medicalLicenseNumber: { type: 'varchar' , nullable: true  },
    countryOfLicense: { type: 'varchar' , nullable: true  },
    licenseAuthority: { type: 'varchar', nullable: true  },
    licenseExpiryDate: { type: 'date' , nullable: true },
    licenseDocument: { type: 'varchar', nullable: true },
    yearsOfExperience: { type: 'integer', nullable: true },
    areasOfSpecialization: { type: 'varchar', array: true, nullable: true },
    subspecialty: { type: 'varchar', nullable: true },
    medicalInstitution: { type: 'varchar', nullable: true },
    createdAt: { type: 'timestamp', createDate: true },
    updatedAt: { type: 'timestamp', updateDate: true },
  },
  relations: {
    doctorProfile: {
      type: 'one-to-one',
      target: 'DoctorProfile',
      inverseSide: 'professionalLicense',
      joinColumn: { name: 'doctorProfileId' },
      onDelete: "CASCADE"
    },
  },
});