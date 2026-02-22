const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'PatientProfile',
  tableName: 'patient_profiles_new',
  columns: {
    id: { primary: true, type: 'uuid', generated: 'uuid' },
    userId: { type: 'uuid', unique: true },
    profilePhoto: { type: 'varchar', nullable: true },
    gender: { type: 'varchar', nullable: true },
    dateOfBirth: { type: 'date', nullable: true },
    genotype: { type: 'varchar', nullable: true },
    bloodGroup: { type: 'varchar', nullable: true },
    nationality: { type: 'varchar', nullable: true },
    language: { type: 'varchar', nullable: true },
    mobileNumber: { type: 'varchar', nullable: true },
    address: { type: 'text', nullable: true },
    emergencyContactFullName: { type: 'varchar', nullable: true },
    emergencyContactMobile: { type: 'varchar', nullable: true },
    emergencyContactRelationship: { type: 'varchar', nullable: true },
    height: { type: 'float', nullable: true },
    weight: { type: 'float', nullable: true },
    bmi: { type: 'float', nullable: true },
    bloodPressure: { type: 'varchar', nullable: true },
    heartRate: { type: 'integer', nullable: true },
    respiratoryRate: { type: 'integer', nullable: true },
    temperature: { type: 'float', nullable: true },
    spO2: { type: 'integer', nullable: true },
    bloodGlucose: { type: 'float', nullable: true },
    smokes: { type: 'boolean', default: false },
    drinksAlcohol: { type: 'boolean', default: false },
    physicalActivityLevel: { type: 'varchar', nullable: true },
    dietType: { type: 'varchar', nullable: true },
    sleepDuration: { type: 'float', nullable: true },
    profileType: { type: 'varchar', default: 'individual' },
    createdAt: { type: 'timestamp', createDate: true },
    updatedAt: { type: 'timestamp', updateDate: true }
  },

  relations: {
    user: {
      type: 'one-to-one',
      target: 'User',
      inverseSide: 'patientProfile',
      joinColumn: { name: 'userId' },
      onDelete: 'CASCADE'
    },
    medicalConditions: {
      type: 'one-to-many',
      target: 'MedicalCondition',
      inverseSide: 'patientProfile',
      cascade: true
    },
    surgeries: {
      type: 'one-to-many',
      target: 'Surgery',
      inverseSide: 'patientProfile',
      cascade: true
    },
    allergies: {
      type: 'one-to-many',
      target: 'Allergy',
      inverseSide: 'patientProfile',
      cascade: true
    },
    familyHistories: {
      type: 'one-to-many',
      target: 'FamilyHistory',
      inverseSide: 'patientProfile',
      cascade: true
    },
    medications: {
      type: 'one-to-many',
      target: 'Medication',
      inverseSide: 'patientProfile',
      cascade: true
    },
    immunizations: {
      type: 'one-to-many',
      target: 'Immunization',
      inverseSide: 'patientProfile',
      cascade: true
    },
    healthInsurance: {
      type: 'one-to-one',
      target: 'HealthInsurance',
      inverseSide: 'patientProfile',
      cascade: true
    },
    disability: {
      type: 'one-to-one',
      target: 'Disability',
      inverseSide: 'patientProfile',
      cascade: true
    },
    consent: {
      type: 'one-to-one',
      target: 'Consent',
      inverseSide: 'patientProfile',
      cascade: true
    },
  }
});