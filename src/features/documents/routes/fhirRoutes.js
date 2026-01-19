// ===== 4. FHIR ROUTES =====
// src/routes/fhirRoutes.js

const express = require('express');
const FHIRController = require('../controllers/fhirController');
const authMiddleware = require('../../../shared/middlewares/authMiddleware'); // Your existing auth middleware

const router = express.Router();

// Apply authentication to all FHIR routes
router.use(authMiddleware.authenticateJWT);

// ===== PATIENT ROUTES =====

/**
 * Get all patients for the current user
 * GET /api/fhir/patients?page=1&limit=20
 */
router.get('/patients', FHIRController.getPatients);

/**
 * Get patient summary (overview of all resource types)
 * GET /api/fhir/patients/:patientId/summary
 */
router.get('/patients/:patientId/summary', FHIRController.getPatientSummary);

/**
 * Get all files for a specific patient
 * GET /api/fhir/patients/:patientId/files?page=1&limit=50&fhirResourceType=Observation
 */
router.get('/patients/:patientId/files', FHIRController.getPatientFiles);

// ===== RESOURCE TYPE ROUTES =====

/**
 * Get files by FHIR resource type
 * GET /api/fhir/resources/:resourceType?page=1&limit=50&patientIdentifier=12345
 */
router.get('/resources/:resourceType', FHIRController.getFilesByResourceType);

/**
 * Get available FHIR resource types for user
 * GET /api/fhir/resource-types
 */
router.get('/resource-types', FHIRController.getResourceTypes);

// ===== SEARCH ROUTES =====

/**
 * Advanced FHIR search
 * POST /api/fhir/search
 * Body: {
 *   "patientIdentifier": "12345",
 *   "fhirResourceType": ["Observation", "DiagnosticReport"],
 *   "fhirSensitivityLevel": "high",
 *   "dateFrom": "2024-01-01",
 *   "dateTo": "2024-12-31",
 *   "searchTerm": "blood test",
 *   "page": 1,
 *   "limit": 50
 * }
 */
router.post('/search', FHIRController.searchFHIR);

// ===== FILE MANAGEMENT ROUTES =====

/**
 * Get related files for a patient (based on file's patient identifier)
 * GET /api/fhir/files/:fileId/related
 */
router.get('/files/:fileId/related', FHIRController.getRelatedFiles);

/**
 * Update FHIR metadata (consent, security labels, etc.)
 * PUT /api/fhir/files/:fileId/metadata
 * Body: {
 *   "fhirSensitivityLevel": "very_high",
 *   "fhirSecurityLabels": [{"code": "R", "system": "..."}],
 *   "consentDirectives": {"canShare": false},
 *   "purposeOfUse": ["treatment"]
 * }
 */
router.put('/files/:fileId/metadata', FHIRController.updateFHIRMetadata);

/**
 * Bulk update FHIR files
 * PUT /api/fhir/files/bulk
 * Body: {
 *   "fileIds": ["uuid1", "uuid2", "uuid3"],
 *   "updateData": {
 *     "fhirSensitivityLevel": "high",
 *     "consentDirectives": {"canShare": true, "restrictions": ["research"]}
 *   }
 * }
 */
router.put('/files/bulk', FHIRController.bulkUpdateFHIR);

// ===== DASHBOARD & ANALYTICS ROUTES =====

/**
 * Get FHIR dashboard data
 * GET /api/fhir/dashboard
 */
router.get('/dashboard', FHIRController.getDashboard);

/**
 * Get FHIR statistics
 * GET /api/fhir/stats?detailed=true
 */
router.get('/stats', FHIRController.getStats);

/**
 * Get FHIR compliance report
 * GET /api/fhir/compliance
 */
router.get('/compliance', FHIRController.getComplianceReport);

module.exports = router;