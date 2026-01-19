// src/routes/complianceRoutes.js
const express = require('express');
const ComplianceController = require('../controllers/complianceController');
const authMiddleware = require('../../../shared/middlewares/authMiddleware');

const router = express.Router();

// Apply authentication to all compliance routes
router.use(authMiddleware.authenticateJWT);

// ===== FRAMEWORK-SPECIFIC REPORTS =====

/**
 * Generate HIPAA compliance report
 * POST /api/compliance/hipaa-report
 * Body: {
 *   "dateRange": {
 *     "startDate": "2024-01-01T00:00:00Z",
 *     "endDate": "2024-12-31T23:59:59Z"
 *   },
 *   "filters": {
 *     "patientIdentifier": "12345",
 *     "userId": "user-uuid",
 *     "eventTypes": ["patient_data_access", "consent_checked"],
 *     "severity": "high"
 *   }
 * }
 */
router.post('/hipaa-report', ComplianceController.generateHIPAAReport);

/**
 * Generate GDPR compliance report
 * POST /api/compliance/gdpr-report
 * Body: {
 *   "dateRange": {
 *     "startDate": "2024-01-01T00:00:00Z",
 *     "endDate": "2024-12-31T23:59:59Z"
 *   },
 *   "filters": {
 *     "patientIdentifier": "12345",
 *     "eventTypes": ["data_export", "consent_withdrawn"]
 *   }
 * }
 */
router.post('/gdpr-report', ComplianceController.generateGDPRReport);

/**
 * Generate FDA 21 CFR Part 11 compliance report
 * POST /api/compliance/fda-report
 * Body: {
 *   "dateRange": {
 *     "startDate": "2024-01-01T00:00:00Z",
 *     "endDate": "2024-12-31T23:59:59Z"
 *   },
 *   "filters": {
 *     "eventTypes": ["encryption_event", "key_rotation"],
 *     "encryptionUsed": true
 *   }
 * }
 */
router.post('/fda-report', ComplianceController.generateFDAReport);

/**
 * Generate generic compliance report
 * POST /api/compliance/generic-report
 * Body: {
 *   "dateRange": {
 *     "startDate": "2024-01-01T00:00:00Z",
 *     "endDate": "2024-12-31T23:59:59Z"
 *   },
 *   "filters": {
 *     "eventTypes": ["file_upload", "file_download"],
 *     "outcome": "SUCCESS"
 *   }
 * }
 */
router.post('/generic-report', ComplianceController.generateGenericReport);

// ===== AUTOMATED MONITORING =====

/**
 * Run automated compliance monitoring
 * GET /api/compliance/monitoring
 */
router.get('/monitoring', ComplianceController.runAutomatedMonitoring);

// ===== DATA EXPORT =====

/**
 * Export audit logs for compliance
 * POST /api/compliance/export-logs
 * Body: {
 *   "criteria": {
 *     "eventTypes": ["patient_data_access", "file_download"],
 *     "dateRange": {
 *       "startDate": "2024-01-01T00:00:00Z",
 *       "endDate": "2024-12-31T23:59:59Z"
 *     },
 *     "patientIdentifier": "12345",
 *     "complianceFramework": "hipaa"
 *   },
 *   "format": "csv"
 * }
 * Supported formats: json, csv, xml
 */
router.post('/export-logs', ComplianceController.exportAuditLogs);

// ===== EXECUTIVE REPORTING =====

/**
 * Generate executive summary report
 * GET /api/compliance/executive-summary?timeRange=30
 */
router.get('/executive-summary', ComplianceController.generateExecutiveSummary);

/**
 * Get compliance dashboard summary
 * GET /api/compliance/dashboard?frameworks=hipaa,gdpr,fda_21cfr11&timeRange=30
 */
router.get('/dashboard', ComplianceController.getComplianceDashboard);

// ===== COMPARATIVE ANALYSIS =====

/**
 * Get compliance framework comparison
 * POST /api/compliance/framework-comparison
 * Body: {
 *   "frameworks": ["hipaa", "gdpr", "fda_21cfr11"],
 *   "dateRange": {
 *     "startDate": "2024-01-01T00:00:00Z",
 *     "endDate": "2024-12-31T23:59:59Z"
 *   }
 * }
 */
router.post('/framework-comparison', ComplianceController.getFrameworkComparison);

/**
 * Get compliance trends over time
 * POST /api/compliance/trends
 * Body: {
 *   "framework": "hipaa",
 *   "startDate": "2024-01-01T00:00:00Z",
 *   "endDate": "2024-12-31T23:59:59Z",
 *   "intervalType": "monthly"
 * }
 * Interval types: daily, weekly, monthly
 */
router.post('/trends', ComplianceController.getComplianceTrends);

// ===== METRICS & ANALYTICS =====

/**
 * Get compliance metrics over time
 * GET /api/compliance/metrics?framework=hipaa&days=90
 */
router.get('/metrics', ComplianceController.getComplianceMetrics);

// ===== CONFIGURATION & VALIDATION =====

/**
 * Validate compliance configuration
 * POST /api/compliance/validate-config
 * Body: {
 *   "framework": "hipaa",
 *   "configuration": {
 *     "consentVerification": true,
 *     "minimumNecessary": true,
 *     "auditLogging": true,
 *     "dataEncryption": true,
 *     "dataRetentionDays": 2555
 *   }
 * }
 */
router.post('/validate-config', ComplianceController.validateComplianceConfig);

module.exports = router;