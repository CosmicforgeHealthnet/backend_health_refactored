// src/features/doctor/entities/index.js
// Export all doctor-related entities

const DoctorProfile = require('./DoctorProfile');
const DoctorWallet = require('./DoctorWallet');
const ClinicalPractice = require('./ClinicalPractice');
const DigitalHealthTools = require('./DigitalHealthTools');
const ProfessionalCertificate = require('./ProfessionalCertificate');
const ProfessionalLicense = require('./ProfessionalLicense');

// Verification entities
const CountryVerificationConfig = require('./CountryVerificationConfig');
const VerificationApiLog = require('./VerificationApiLog');
const VerificationDocument = require('./VerificationDocument');
const VerificationRequest = require('./VerificationRequest');
const VerificationReviewQueue = require('./VerificationReviewQueue');
const VerificationStatusHistory = require('./VerificationStatusHistory');

// Scheduling and pricing entities
const DoctorPricing = require('./DoctorPricing');
const DoctorAvailability = require('./DoctorAvailability');
const DoctorUnavailability = require('./DoctorUnavailability');

module.exports = {
    // Profile entities
    DoctorProfile,
    DoctorWallet,
    ClinicalPractice,
    DigitalHealthTools,
    ProfessionalCertificate,
    ProfessionalLicense,

    // Verification entities
    CountryVerificationConfig,
    VerificationApiLog,
    VerificationDocument,
    VerificationRequest,
    VerificationReviewQueue,
    VerificationStatusHistory,
    UserRating: require('./UserRatings'),

    // Scheduling and pricing entities
    DoctorPricing,
    DoctorAvailability,
    DoctorUnavailability
};
