// src/features/patient/routes/index.js
// Patient feature routes
//
// NEW ROUTES: /api/patient/*
// LEGACY ROUTES: /user/patient-profile/* (backward compatible via app.js)

const router = require("express").Router();
const profileController = require("../controllers/profileController");

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
router.put("/auth-info", profileController.updateAuthInfo);

module.exports = router;
