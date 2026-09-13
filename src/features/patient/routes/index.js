// src/features/patient/routes/index.js
// Patient feature routes
//
// NEW ROUTES: /api/patient/*
// LEGACY ROUTES: /user/patient-profile/* (backward compatible via app.js)

const router = require("express").Router();
const profileController = require("../controllers/profileController");
const DocumentUploadMiddleware = require("../../documents/middlewares/documentUploadMiddleware");

/**
 * @swagger
 * tags:
 *   name: Patient
 *   description: |
 *     Patient profile and health records management.
 *     
 *     ## Route Migration Notice
 *     These routes are available at both:
 *     - **NEW**: `/api/patient/*` (recommended)
 *     - **LEGACY**: `/user/patient-profile/*` (deprecated, will be removed in v2.0)
 */

// ============================================
// PROFILE ROUTES
// ============================================

/**
 * @swagger
 * /api/patient/profile:
 *   post:
 *     summary: Create patient profile
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates a new patient profile for the authenticated user.
 *       
 *       **Legacy route**: `POST /user/patient-profile` (deprecated)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gender
 *               - dateOfBirth
 *               - nationality
 *               - language
 *               - mobileNumber
 *               - address
 *             properties:
 *               gender:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               nationality:
 *                 type: string
 *               language:
 *                 type: string
 *               mobileNumber:
 *                 type: string
 *               address:
 *                 type: string
 */
router.post("/profile", profileController.createProfile);

/**
 * @swagger
 * /api/patient/profile/{id}:
 *   get:
 *     summary: Get patient profile by ID
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieves a patient profile by its ID.
 *       
 *       **Legacy route**: `GET /user/patient-profile/:id` (deprecated)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 */
router.get("/profile/:id", profileController.getProfileById);

/**
 * @swagger
 * /api/patient/profile/user/{userId}:
 *   get:
 *     summary: Get patient profile by user ID
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieves a patient profile by the user's ID.
 *       
 *       **Legacy route**: `GET /user/patient-profile/user/:userId` (deprecated)
 */
router.get("/profile/user/:userId", profileController.getProfileByUserId);

/**
 * @swagger
 * /api/patient/profile/{id}:
 *   put:
 *     summary: Update patient profile
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Updates an existing patient profile.
 *       
 *       **Legacy route**: `PUT /user/patient-profile/:id` (deprecated)
 */
router.put("/profile/:id", profileController.updateProfile);

/**
 * @swagger
 * /api/patient/profile/{id}:
 *   delete:
 *     summary: Delete patient profile
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Deletes a patient profile.
 *       
 *       **Legacy route**: `DELETE /user/patient-profile/:id` (deprecated)
 */
router.delete("/profile/:id", profileController.deleteProfile);

// ============================================
// HEALTH RECORDS / PROFILE OPTIONS ROUTES
// ============================================

/**
 * @swagger
 * /api/patient/health-records:
 *   get:
 *     summary: Get health record options
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Gets available health record types and options.
 *       
 *       **Legacy route**: `GET /user/profile-options` (deprecated)
 */
router.get("/health-records", profileController.getProfileOptions);

/**
 * @swagger
 * /api/patient/health-records:
 *   post:
 *     summary: Manage health records
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Add, update, or delete health records (allergies, medications, etc.).
 *       
 *       **Legacy route**: `POST /user/profile-options` (deprecated)
 */
router.post("/health-records", profileController.manageProfileOptions);

// Legacy route aliases for backward compatibility
router.get("/profile-options", profileController.getProfileOptions);
router.post("/profile-options", profileController.manageProfileOptions);

// Prescription shortcut — patients can access their prescriptions at /api/patient/prescriptions
const prescriptionController = require("../../pharmacy/controllers/prescriptionController");
router.get("/prescriptions", prescriptionController.getPatientPrescriptions);

// ============================================
// ALERTS (drug-drug interaction safety banner)
// ============================================

/**
 * @swagger
 * /api/patient/alerts:
 *   get:
 *     summary: Get patient safety alerts (drug interaction banner)
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Checks the patient's current medications (across all non-cancelled
 *       prescriptions) for known drug-drug interactions, using live data from
 *       RxNav (U.S. National Library of Medicine). Returns an empty alerts
 *       array if fewer than two medications are on file, if no interactions
 *       are found, or if the interaction lookup is temporarily unavailable.
 */
const patientAlertController = require("../controllers/patientAlertController");
router.get("/alerts", patientAlertController.getAlerts);

// ============================================
// DASHBOARD (aggregation / read layer over existing domain APIs)
// ============================================

/**
 * @swagger
 * /api/patient/dashboard:
 *   get:
 *     summary: Get initial patient dashboard hydration data
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Lightweight aggregation of summary counts, next appointment, safety
 *       alerts, recommended doctors, recommended (joinable public)
 *       communities, and recent activity. Each section is fetched
 *       independently — one failing domain returns an empty/default value for
 *       that section rather than failing the whole response.
 *       nearby_vendors is always empty here; call
 *       GET /api/patient/nearby-vendors/ once the client has coordinates.
 */
const patientDashboardController = require("../controllers/patientDashboardController");
router.get("/dashboard", patientDashboardController.getDashboard);

/**
 * @swagger
 * /api/patient/dashboard/summary:
 *   get:
 *     summary: Get patient dashboard summary counts
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 */
router.get("/dashboard/summary", patientDashboardController.getSummary);

/**
 * @swagger
 * /api/patient/appointments/upcoming:
 *   get:
 *     summary: Get the patient's next upcoming appointment(s)
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 1
 */
router.get("/appointments/upcoming", patientDashboardController.getUpcomingAppointments);

/**
 * @swagger
 * /api/patient/appointments/calendar:
 *   get:
 *     summary: Get a lightweight month view of the patient's appointments
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           example: "2026-08"
 */
router.get("/appointments/calendar", patientDashboardController.getCalendar);

/**
 * @swagger
 * /api/patient/lab-results/summary:
 *   get:
 *     summary: Get a lightweight summary of the patient's lab results
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 */
router.get("/lab-results/summary", patientDashboardController.getLabResultsSummary);

/**
 * @swagger
 * /api/patient/health-records/summary:
 *   get:
 *     summary: Get a lightweight summary of the patient's uploaded medical records
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 */
router.get("/health-records/summary", patientDashboardController.getHealthRecordsSummary);

/**
 * @swagger
 * /api/patient/doctors/recommended:
 *   get:
 *     summary: Get recommended (verified, bookable) doctors
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 3
 */
router.get("/doctors/recommended", patientDashboardController.getRecommendedDoctors);

/**
 * @swagger
 * /api/patient/nearby-vendors:
 *   get:
 *     summary: Discover nearby pharmacies and stores
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 10
 *           description: Search radius in kilometers
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, pharmacy, store]
 *           default: all
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 */
router.get("/nearby-vendors", patientDashboardController.getNearbyVendors);

/**
 * @swagger
 * /api/patient/activity:
 *   get:
 *     summary: Get the patient's recent cross-domain activity timeline
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 */
router.get("/activity", patientDashboardController.getRecentActivity);

// ============================================
// AUTH INFO ROUTES
// ============================================

/**
 * @swagger
 * /api/patient/auth-info:
 *   put:
 *     summary: Update auth/profile info
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Updates patient's basic profile info (name, image, etc.).
 *       
 *       **Legacy route**: `PUT /user/update-auth` (deprecated)
 */
router.put("/auth-info", DocumentUploadMiddleware.uploadDocuments(), DocumentUploadMiddleware.handleUploadError, profileController.updateAuthInfo);

module.exports = router;
