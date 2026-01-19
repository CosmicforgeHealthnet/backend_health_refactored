// src/features/compliance/entities/index.js
const ComprehensiveAuditLog = require('./ComprehensiveAuditLog');
const PatientConsent = require('./PatientConsent');
const DataGovernancePolicy = require('./DataGovernancePolicy');
const ConsentAccessLog = require('./ConsentAccessLog');
const DataLineage = require('./DataLineage');
const EncryptionKey = require('./EncryptionKey');
const ResourceAccessLog = require('./ResourceAccessLog');
const FHIRSearchLog = require('./FHIRSearchLog');
const PatientAccessLog = require('./PatientAccessLog');

module.exports = {
    ComprehensiveAuditLog,
    PatientConsent,
    DataGovernancePolicy,
    ConsentAccessLog,
    DataLineage,
    EncryptionKey,
    ResourceAccessLog,
    FHIRSearchLog,
    PatientAccessLog
};
