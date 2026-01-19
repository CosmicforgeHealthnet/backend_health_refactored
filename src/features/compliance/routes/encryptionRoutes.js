// // src/routes/encryptionRoutes.js
// const express = require('express');
// const EncryptionController = require('../controllers/encryptionController');
// const authMiddleware = require('../../auth/middlewares/authMiddleware');

// const router = express.Router();

// // Apply authentication to all encryption routes
// router.use(authMiddleware.authenticate);

// // ===== KEY GENERATION & MANAGEMENT =====

// /**
//  * Generate new FHIR encryption key
//  * POST /api/encryption/generate-key
//  * Body: {
//  *   "patientIdentifier": "12345",
//  *   "fhirResourceType": "Patient",
//  *   "sensitivityLevel": "very_high",
//  *   "purposeOfUse": "treatment",
//  *   "keyType": "resource"
//  * }
//  */
// router.post('/generate-key', EncryptionController.generateKey);

// /**
//  * Generate analytics encryption key for research
//  * POST /api/encryption/generate-analytics-key
//  * Body: {
//  *   "analysisType": "demographic_analysis",
//  *   "researchPurpose": "Clinical trial data analysis",
//  *   "privacyLevel": "differential_privacy"
//  * }
//  */
// router.post('/generate-analytics-key', EncryptionController.generateAnalyticsKey);

// // ===== KEY RETRIEVAL & SEARCH =====

// /**
//  * Get encryption key details
//  * GET /api/encryption/keys/:keyId
//  */
// router.get('/keys/:keyId', EncryptionController.getKeyDetails);

// /**
//  * Search encryption keys
//  * POST /api/encryption/keys/search
//  * Body: {
//  *   "keyIdentifier": "partial-key-id",
//  *   "keyType": ["resource", "patient"],
//  *   "keyStatus": ["active", "rotated"],
//  *   "patientIdentifier": "12345",
//  *   "fhirResourceType": "Patient",
//  *   "sensitivityLevel": "high",
//  *   "algorithm": "aes-256-gcm",
//  *   "createdBy": "user-uuid",
//  *   "dateRange": {
//  *     "startDate": "2024-01-01",
//  *     "endDate": "2024-12-31"
//  *   },
//  *   "expiringWithin": 30,
//  *   "minUsageCount": 10,
//  *   "maxUsageCount": 1000,
//  *   "page": 1,
//  *   "limit": 50,
//  *   "sortBy": "createdAt",
//  *   "sortOrder": "DESC"
//  * }
//  */
// router.post('/keys/search', EncryptionController.searchKeys);

// /**
//  * Get keys by type
//  * GET /api/encryption/keys/type/:keyType?page=1&limit=50&status=active&includeExpired=false
//  * Key types: master, patient, resource, sensitivity, purpose
//  */
// router.get('/keys/type/:keyType', EncryptionController.getKeysByType);

// /**
//  * Get patient encryption keys
//  * GET /api/encryption/patient/:patientId/keys?includeInactive=false&keyType=resource
//  */
// router.get('/patient/:patientId/keys', EncryptionController.getPatientKeys);

// /**
//  * Get keys by compliance framework
//  * GET /api/encryption/compliance/:framework/keys?page=1&limit=50
//  * Frameworks: hipaa, gdpr, fda_21cfr11
//  */
// router.get('/compliance/:framework/keys', EncryptionController.getKeysByComplianceFramework);

// // ===== KEY ROTATION & LIFECYCLE =====

// /**
//  * Rotate encryption key
//  * PUT /api/encryption/keys/:keyId/rotate
//  * Body: {
//  *   "reason": "Scheduled rotation for compliance"
//  * }
//  */
// router.put('/keys/:keyId/rotate', EncryptionController.rotateKey);

// /**
//  * Get keys requiring rotation
//  * GET /api/encryption/keys-requiring-rotation
//  */
// router.get('/keys-requiring-rotation', EncryptionController.getKeysRequiringRotation);

// /**
//  * Get key rotation history
//  * GET /api/encryption/keys/:keyId/rotation-history?includeRotatedFrom=true
//  */
// router.get('/keys/:keyId/rotation-history', EncryptionController.getKeyRotationHistory);

// // ===== KEY STATUS MANAGEMENT =====

// /**
//  * Update key status
//  * PUT /api/encryption/keys/:keyId/status
//  * Body: {
//  *   "status": "revoked",
//  *   "reason": "Security incident"
//  * }
//  * Valid statuses: active, rotated, revoked, expired
//  */
// router.put('/keys/:keyId/status', EncryptionController.updateKeyStatus);

// /**
//  * Bulk update key status
//  * PUT /api/encryption/keys/bulk-status
//  * Body: {
//  *   "keyIds": ["key-uuid-1", "key-uuid-2"],
//  *   "status": "expired",
//  *   "reason": "Bulk expiration for compliance"
//  * }
//  */
// router.put('/keys/bulk-status', EncryptionController.bulkUpdateKeyStatus);

// // ===== COMPLIANCE & MONITORING =====

// /**
//  * Get key compliance status
//  * GET /api/encryption/keys/:keyId/compliance
//  */
// router.get('/keys/:keyId/compliance', EncryptionController.getKeyComplianceStatus);

// /**
//  * Get encryption key statistics
//  * GET /api/encryption/statistics
//  */
// router.get('/statistics', EncryptionController.getKeyStatistics);

// // ===== MAINTENANCE & CLEANUP =====

// /**
//  * Cleanup expired keys
//  * DELETE /api/encryption/cleanup-expired?retentionDays=2555
//  */
// router.delete('/cleanup-expired', EncryptionController.cleanupExpiredKeys);

// module.exports = router;