// src/routes/dataGovernanceRoutes.js
const express = require('express');
const DataGovernanceController = require('../controllers/dataGovernanceController');
const authMiddleware = require('../../auth/middlewares/authMiddleware');

const router = express.Router();

// Apply authentication to all data governance routes
router.use(authMiddleware.authenticateJWT);

// ===== POLICY MANAGEMENT =====

/**
 * Get all governance policies
 * GET /api/governance/policies?page=1&limit=50&jurisdiction=us&framework=hipaa
 */
router.get('/policies', DataGovernanceController.getPolicies);

/**
 * Create new governance policy
 * POST /api/governance/policies
 * Body: {
 *   "policyName": "Patient Data Retention Policy",
 *   "policyType": "retention",
 *   "policyDescription": "Automatically delete patient data after 7 years",
 *   "policyRules": {
 *     "retentionDays": 2555,
 *     "retentionAction": "delete",
 *     "applicableDataTypes": ["Patient", "Observation"],
 *     "sensitivityLevels": ["high", "very_high"]
 *   },
 *   "applicableJurisdictions": ["us", "eu"],
 *   "complianceFrameworks": ["hipaa", "gdpr"],
 *   "isAutomated": true,
 *   "effectiveDate": "2024-01-01T00:00:00Z",
 *   "expirationDate": "2025-12-31T23:59:59Z"
 * }
 */
router.post('/policies', DataGovernanceController.createPolicy);

/**
 * Get specific policy details
 * GET /api/governance/policies/:policyId
 */
router.get('/policies/:policyId', DataGovernanceController.getPolicyDetails);

/**
 * Search governance policies
 * POST /api/governance/policies/search
 * Body: {
 *   "policyName": "retention",
 *   "policyType": ["retention", "anonymization"],
 *   "policyStatus": ["active", "pending"],
 *   "jurisdiction": "us",
 *   "complianceFramework": "hipaa",
 *   "dataType": "Patient",
 *   "isAutomated": true,
 *   "owner": "user-uuid",
 *   "effectiveDateRange": {
 *     "startDate": "2024-01-01",
 *     "endDate": "2024-12-31"
 *   },
 *   "searchText": "patient data",
 *   "page": 1,
 *   "limit": 50,
 *   "sortBy": "createdAt",
 *   "sortOrder": "DESC"
 * }
 */
router.post('/policies/search', DataGovernanceController.searchPolicies);

/**
 * Update policy status
 * PUT /api/governance/policies/:policyId/status
 * Body: {
 *   "status": "deprecated",
 *   "reason": "Replaced by new policy"
 * }
 * Valid statuses: active, inactive, pending, deprecated
 */
router.put('/policies/:policyId/status', DataGovernanceController.updatePolicyStatus);

/**
 * Get policies requiring review
 * GET /api/governance/policies-requiring-review?daysAhead=30
 */
router.get('/policies-requiring-review', DataGovernanceController.getPoliciesRequiringReview);

// ===== DATA RETENTION =====

/**
 * Apply data retention policy
 * POST /api/governance/policies/:policyId/apply-retention
 * Body: {
 *   "dryRun": true
 * }
 */
router.post('/policies/:policyId/apply-retention', DataGovernanceController.applyRetentionPolicy);

// ===== DATA ANONYMIZATION =====

/**
 * Anonymize data for research
 * POST /api/governance/anonymize
 * Body: {
 *   "datasetId": "folder-uuid",
 *   "anonymizationLevel": "k-anonymity",
 *   "k": 5,
 *   "researchPurpose": "Clinical trial analysis for diabetes treatment"
 * }
 * Anonymization levels: k-anonymity, l-diversity, differential-privacy, synthetic
 */
router.post('/anonymize', DataGovernanceController.anonymizeData);

/**
 * Get anonymization history
 * GET /api/governance/anonymization-history?page=1&limit=50&anonymizationLevel=k-anonymity&startDate=2024-01-01&endDate=2024-12-31
 */
router.get('/anonymization-history', DataGovernanceController.getAnonymizationHistory);

// ===== PRIVACY-PRESERVING ANALYTICS =====

/**
 * Generate privacy-preserving analytics
 * POST /api/governance/privacy-analytics
 * Body: {
 *   "resourceType": "Patient",
 *   "aggregationType": "count",
 *   "groupBy": "age_group",
 *   "dateRange": {
 *     "startDate": "2024-01-01",
 *     "endDate": "2024-12-31"
 *   },
 *   "filters": {
 *     "sensitivityLevel": "high"
 *   },
 *   "privacyLevel": "differential"
 * }
 * Privacy levels: differential, k-anonymity, synthetic
 */
router.post('/privacy-analytics', DataGovernanceController.generatePrivacyAnalytics);

// ===== DATA LINEAGE =====

/**
 * Get data lineage for a source
 * GET /api/governance/lineage/:sourceId/:sourceType?page=1&limit=50&includeDestinations=true&transformationType=anonymization
 * Source types: file, patient, dataset
 */
router.get('/lineage/:sourceId/:sourceType', DataGovernanceController.getDataLineage);

/**
 * Trace complete data lineage chain
 * GET /api/governance/lineage/:sourceId/:sourceType/trace?maxDepth=10
 */
router.get('/lineage/:sourceId/:sourceType/trace', DataGovernanceController.traceDataLineageChain);

// ===== CROSS-BORDER TRANSFER =====

/**
 * Get cross-border transfer policies
 * GET /api/governance/cross-border/:sourceJurisdiction/:destinationJurisdiction
 */
router.get('/cross-border/:sourceJurisdiction/:destinationJurisdiction', DataGovernanceController.getCrossBorderPolicies);

/**
 * Validate cross-border transfer
 * POST /api/governance/validate-cross-border
 * Body: {
 *   "sourceJurisdiction": "us",
 *   "destinationJurisdiction": "eu",
 *   "dataTypes": ["Patient", "Observation"],
 *   "transferPurpose": "research",
 *   "transferMechanism": "standard_contractual_clauses"
 * }
 */
router.post('/validate-cross-border', DataGovernanceController.validateCrossBorderTransfer);

// ===== DATA CLASSIFICATION =====

/**
 * Classify data automatically
 * POST /api/governance/classify-data
 * Body: {
 *   "fileId": "file-uuid"
 * }
 */
router.post('/classify-data', DataGovernanceController.classifyData);

// ===== STATISTICS & REPORTING =====

/**
 * Get policy statistics
 * GET /api/governance/statistics
 */
router.get('/statistics', DataGovernanceController.getPolicyStatistics);

/**
 * Get data transformation statistics
 * GET /api/governance/transformation-stats?timeRange=30
 */
router.get('/transformation-stats', DataGovernanceController.getDataTransformationStats);

/**
 * Get policy compliance report
 * GET /api/governance/compliance-report?timeRange=30&framework=hipaa&policyType=retention
 */
router.get('/compliance-report', DataGovernanceController.getPolicyComplianceReport);

/**
 * Get policy violations
 * GET /api/governance/violations?page=1&limit=50&timeRange=30&policyType=retention
 */
router.get('/violations', DataGovernanceController.getPolicyViolations);

// ===== MAINTENANCE & CLEANUP =====

/**
 * Cleanup old lineage records
 * DELETE /api/governance/cleanup-lineage?retentionDays=2555
 */
router.delete('/cleanup-lineage', DataGovernanceController.cleanupOldLineageRecords);

module.exports = router;