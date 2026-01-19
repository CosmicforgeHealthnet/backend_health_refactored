// src/routes/auditRoutes.js
const express = require('express');
const AuditController = require('../controllers/auditController');
const authMiddleware = require('../../../shared/middlewares/authMiddleware');

const router = express.Router();

// Apply authentication to all audit routes
router.use(authMiddleware.authenticateJWT);

// ===== AUDIT LOG SEARCH & RETRIEVAL =====

/**
 * Search audit logs with advanced filtering
 * POST /api/audit/search
 * Body: {
 *   "eventTypes": ["file_upload", "patient_data_access"],
 *   "patientIdentifier": "12345",
 *   "userId": "user-uuid",
 *   "severity": ["high", "critical"],
 *   "dateRange": {
 *     "startDate": "2024-01-01T00:00:00Z",
 *     "endDate": "2024-12-31T23:59:59Z"
 *   },
 *   "ipAddress": "192.168.1.1",
 *   "outcome": "SUCCESS",
 *   "emergencyAccess": true,
 *   "riskScoreMin": 80,
 *   "complianceFramework": "hipaa",
 *   "searchText": "patient access",
 *   "fhirResourceType": "Patient",
 *   "dataExported": true,
 *   "page": 1,
 *   "limit": 100,
 *   "sortBy": "eventTimestamp",
 *   "sortOrder": "DESC"
 * }
 */
router.post('/search', AuditController.searchLogs);

/**
 * Get audit statistics and trends
 * GET /api/audit/statistics?timeRange=30
 */
router.get('/statistics', AuditController.getStatistics);

/**
 * Get audit logs for specific patient
 * GET /api/audit/patient/:patientId?page=1&limit=50&eventTypes=file_upload,patient_data_access&startDate=2024-01-01&endDate=2024-12-31&sortBy=eventTimestamp&sortOrder=DESC
 */
router.get('/patient/:patientId', AuditController.getPatientAuditLogs);

/**
 * Get audit logs for specific user
 * GET /api/audit/user/:targetUserId?page=1&limit=50&eventTypes=login_success,file_download&startDate=2024-01-01&endDate=2024-12-31
 */
router.get('/user/:targetUserId', AuditController.getUserAuditLogs);

/**
 * Get compliance-specific audit logs
 * GET /api/audit/compliance/:framework?startDate=2024-01-01&endDate=2024-12-31&page=1&limit=100
 * Supported frameworks: hipaa, gdpr, fda_21cfr11, iso27001
 */
router.get('/compliance/:framework', AuditController.getComplianceAuditLogs);

// ===== SECURITY & ANOMALY DETECTION =====

/**
 * Detect audit anomalies and security incidents
 * GET /api/audit/anomalies?timeWindow=24
 */
router.get('/anomalies', AuditController.detectAnomalies);

/**
 * Generate security intelligence report
 * GET /api/audit/security-intelligence?timeWindow=24
 */
router.get('/security-intelligence', AuditController.generateSecurityIntelligence);

/**
 * Get high-risk events
 * GET /api/audit/high-risk?minRiskScore=80&timeRange=24&page=1&limit=50
 */
router.get('/high-risk', AuditController.getHighRiskEvents);

/**
 * Get emergency access events
 * GET /api/audit/emergency-access?startDate=2024-01-01&endDate=2024-12-31&page=1&limit=50
 */
router.get('/emergency-access', AuditController.getEmergencyAccessEvents);

/**
 * Get failed access attempts
 * GET /api/audit/failed-attempts?timeRange=24&page=1&limit=50
 */
router.get('/failed-attempts', AuditController.getFailedAccessAttempts);

/**
 * Get logs requiring attention (dashboard summary)
 * GET /api/audit/requiring-attention?timeRange=24
 */
router.get('/requiring-attention', AuditController.getLogsRequiringAttention);

// ===== USER BEHAVIOR MONITORING =====

/**
 * Monitor user behavior patterns
 * GET /api/audit/user-behavior/:targetUserId?timeWindow=168
 */
router.get('/user-behavior/:targetUserId', AuditController.monitorUserBehavior);

// ===== AUDIT INTEGRITY & VERIFICATION =====

/**
 * Verify audit log integrity
 * POST /api/audit/verify-integrity
 * Body: {
 *   "batchSize": 1000
 * }
 */
router.post('/verify-integrity', AuditController.verifyIntegrity);

module.exports = router;