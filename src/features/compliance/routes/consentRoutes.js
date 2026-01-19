// src/routes/consentRoutes.js
const express = require('express');
const ConsentController = require('../controllers/consentController');
const authMiddleware = require('../../../shared/middlewares/authMiddleware');

const router = express.Router();

// Apply authentication to all consent routes
router.use(authMiddleware.authenticateJWT);

// ===== CONSENT LIFECYCLE MANAGEMENT =====

/**
 * Create new patient consent
 * POST /api/consent/create
 * Body: {
 *   "patientIdentifier": "12345",
 *   "consentScope": "limited_access",
 *   "allowedPurposes": ["treatment", "healthcare_operations"],
 *   "allowedUsers": ["user-uuid-1", "user-uuid-2"],
 *   "allowedResourceTypes": ["Patient", "Observation"],
 *   "restrictedResourceTypes": ["DiagnosticReport"],
 *   "effectiveDate": "2024-01-01T00:00:00Z",
 *   "expirationDate": "2025-12-31T23:59:59Z",
 *   "allowEmergencyAccess": true,
 *   "consentMethod": "electronic",
 *   "consentLanguage": "en",
 *   "witness": "witness-user-uuid"
 * }
 * Consent scopes: full_access, limited_access, treatment_only, emergency_only, no_access
 * Purposes: treatment, payment, healthcare_operations, research, public_health, quality_assurance, emergency
 */
router.post('/create', ConsentController.createConsent);

/**
 * Get consent status for patient
 * GET /api/consent/:patientId/status
 */
router.get('/:patientId/status', ConsentController.getConsentStatus);

/**
 * Update patient consent
 * PUT /api/consent/:patientId/update
 * Body: {
 *   "consentScope": "full_access",
 *   "allowedPurposes": ["treatment", "payment", "healthcare_operations"],
 *   "allowedUsers": ["user-uuid-1", "user-uuid-2", "user-uuid-3"],
 *   "allowedResourceTypes": ["Patient", "Observation", "DiagnosticReport"],
 *   "restrictedResourceTypes": [],
 *   "expirationDate": "2026-12-31T23:59:59Z",
 *   "allowEmergencyAccess": true
 * }
 */
router.put('/:patientId/update', ConsentController.updateConsent);

/**
 * Withdraw patient consent
 * PUT /api/consent/:patientId/withdraw
 * Body: {
 *   "reason": "Patient requested data deletion"
 * }
 */
router.put('/:patientId/withdraw', ConsentController.withdrawConsent);

// ===== PERMISSION CHECKING =====

/**
 * Check permission for specific access
 * POST /api/consent/check-permission
 * Body: {
 *   "patientIdentifier": "12345",
 *   "purposeOfUse": "treatment",
 *   "resourceType": "Patient",
 *   "isEmergency": false,
 *   "emergencyJustification": "Life-threatening emergency requiring immediate access"
 * }
 */
router.post('/check-permission', ConsentController.checkPermission);

// ===== CONSENT HISTORY & AUDIT =====

/**
 * Get consent history for patient
 * GET /api/consent/:patientId/history?page=1&limit=20
 */
router.get('/:patientId/history', ConsentController.getConsentHistory);

/**
 * Get consent access logs for patient
 * GET /api/consent/:patientId/access-logs?page=1&limit=50&accessType=view&startDate=2024-01-01&endDate=2024-12-31
 * Access types: view, download, modify, export, emergency
 */
router.get('/:patientId/access-logs', ConsentController.getConsentAccessLogs);

/**
 * Get emergency access events
 * GET /api/consent/emergency-access?startDate=2024-01-01&endDate=2024-12-31&page=1&limit=50&patientIdentifier=12345
 */
router.get('/emergency-access', ConsentController.getEmergencyAccessEvents);

// ===== BULK OPERATIONS =====

/**
 * Bulk update consent for multiple patients
 * PUT /api/consent/bulk-update
 * Body: {
 *   "patientIdentifiers": ["12345", "67890", "11111"],
 *   "updateData": {
 *     "allowEmergencyAccess": true,
 *     "expirationDate": "2025-12-31T23:59:59Z"
 *   }
 * }
 */
router.put('/bulk-update', ConsentController.bulkUpdateConsents);

/**
 * Get patients requiring consent renewal
 * GET /api/consent/requiring-renewal?daysAhead=30
 */
router.get('/requiring-renewal', ConsentController.getPatientsRequiringRenewal);

// ===== COMPLIANCE & REPORTING =====

/**
 * Get consent compliance report
 * GET /api/consent/compliance-report
 */
router.get('/compliance-report', ConsentController.getComplianceReport);

/**
 * Get consent statistics
 * GET /api/consent/statistics?timeRange=30
 */
router.get('/statistics', ConsentController.getConsentStatistics);

// ===== VALIDATION & TEMPLATES =====

/**
 * Validate consent data
 * POST /api/consent/validate
 * Body: {
 *   "patientIdentifier": "12345",
 *   "consentScope": "limited_access",
 *   "allowedPurposes": ["treatment"],
 *   "expirationDate": "2025-12-31T23:59:59Z"
 * }
 */
router.post('/validate', ConsentController.validateConsentData);

/**
 * Get consent templates
 * GET /api/consent/templates?type=general
 * Template types: general, research, full_access, minimal
 */
router.get('/templates', ConsentController.getConsentTemplates);

module.exports = router;