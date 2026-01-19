// src/features/patient/entities/index.js
// Export all patient-related entities

const PatientProfile = require('./PatientProfile');
const Allergy = require('./Allergy');
const Consent = require('./Consent');
const Disability = require('./Disability');
const FamilyHistory = require('./FamilyHistory');
const HealthInsurance = require('./HealthInsurance');
const Immunization = require('./Immunization');
const MedicalCondition = require('./MedicalCondition');
const Medication = require('./Medication');
const Surgery = require('./Surgery');

module.exports = {
    PatientProfile,
    Allergy,
    Consent,
    Disability,
    FamilyHistory,
    HealthInsurance,
    Immunization,
    MedicalCondition,
    Medication,
    Surgery
};
