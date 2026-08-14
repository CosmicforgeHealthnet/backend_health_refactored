// src/features/doctor/routes/index.js
// Doctor feature routes
//
// NEW ROUTES: /api/doctor/*
// LEGACY ROUTES: /user/doctor-profile/*, /doctor/verification/* (backward compatible via app.js)

const router = require("express").Router();
const { authenticateJWT, authorizeRoles } = require("../../auth/middlewares/authMiddleware");
const profileController = require("../controllers/profileController");
const prescriptionController = require("../../pharmacy/controllers/prescriptionController");

// Import verification controller from existing location
const doctorVerificationController = require("../controllers/doctorVerificationController");
const DocumentUploadMiddleware = require("../../documents/middlewares/documentUploadMiddleware");

// Subscription middlewares
const requireSubscription = require("../../subscriptions/middlewares/requireSubscription");
const { getLocationFromIPCached } = require("../../../shared/middlewares/locationMiddleware");

// Import pricing and availability controllers
const DoctorPricingController = require("../controllers/doctorPricingController");
const DoctorAvailabilityController = require("../controllers/doctorAvailabilityController");

// Instantiate controllers
const pricingController = new DoctorPricingController();
const availabilityController = new DoctorAvailabilityController();

/**
 * @swagger
 * tags:
 *   name: Doctor
 *   description: |
 *     Doctor profile, verification, and status management.
 *     
 *     ## Route Migration Notice
 *     These routes are available at both:
 *     - **NEW**: `/api/doctor/*` (recommended)
 *     - **LEGACY**: `/user/doctor-profile/*`, `/doctor/verification/*` (deprecated, will be removed in v2.0)
 */

// ============================================
// PUBLIC DOCTOR ROUTES (no auth required)
// ============================================

/**
 * @swagger
 * /api/doctor/list:
 *   get:
 *     summary: Get all doctors
 *     tags: [Doctor]
 *     description: |
 *       Lists all registered doctors.
 *       
 *       **Legacy route**: `GET /user/doctors` (deprecated)
 */
router.get("/list", profileController.getAllDoctors);

/**
 * @swagger
 * /api/doctor/list/complete:
 *   get:
 *     summary: Get doctors with complete profiles
 *     tags: [Doctor]
 *     description: |
 *       Lists doctors who have completed their profile.
 *       
 *       **Legacy route**: `GET /user/doctors/complete` (deprecated)
 */
router.get("/list/complete", profileController.getAllDoctorsWithCompleteProfile);

/**
 * @swagger
 * /api/doctor/list/verified:
 *   get:
 *     summary: Get verified doctors
 *     tags: [Doctor]
 *     description: |
 *       Lists doctors who have completed verification.
 *       
 *       **Legacy route**: `GET /user/doctors/verified` (deprecated)
 */
router.get("/list/verified", profileController.getAllVerifiedDoctors);

/**
 * @swagger
 * /api/doctor/list/online:
 *   get:
 *     summary: Get doctors by online status
 *     tags: [Doctor]
 *     description: |
 *       Lists doctors filtered by online status.
 *       
 *       **Legacy route**: `GET /user/doctors/online` (deprecated)
 *     parameters:
 *       - in: query
 *         name: isOnline
 *         required: true
 *         schema:
 *           type: boolean
 */
router.get("/list/online", profileController.getDoctorsByOnlineStatus);

/**
 * @swagger
 * /api/doctor/search:
 *   get:
 *     summary: Search doctors
 *     tags: [Doctor]
 *     description: |
 *       Search doctors by name, email, or specialty.
 *       
 *       **Legacy route**: `GET /user/doctors/search` (deprecated)
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 3
 */
// ============================================
// VERIFICATION ROUTES
// ============================================

/**
 * @swagger
 * /api/doctor/verification/submit:
 *   post:
 *     summary: Submit verification documents
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Submit documents for doctor verification.
 *       
 *       **Legacy route**: `POST /doctor/verification/submit` (deprecated)
 */
router.post("/verification/submit", authenticateJWT, doctorVerificationController.submitVerification);

/**
 * @swagger
 * /api/doctor/verification/{id}/documents:
 *   post:
 *     summary: Upload verification documents
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Verification request ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     description: |
 *       Upload documents for an existing verification request.
 *       Supports multiple files (PDF, JPG, PNG, DOC, DOCX).
 */
router.post(
    "/verification/:id/documents",
    authenticateJWT,
    DocumentUploadMiddleware.uploadDocuments(),
    DocumentUploadMiddleware.processUploadedFiles,
    doctorVerificationController.uploadDocuments
);

/**
 * @swagger
 * /api/doctor/verification/resubmit:
 *   post:
 *     summary: Resubmit verification
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Resubmit a rejected or expired verification request.
 */
router.post("/verification/resubmit", authenticateJWT, doctorVerificationController.resubmitVerification.bind(doctorVerificationController));

/**
 * @swagger
 * /api/doctor/verification/{id}/update:
 *   put:
 *     summary: Update verification info
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Update information for a pending verification request.
 */
router.put("/verification/:id/update", authenticateJWT, doctorVerificationController.updateVerificationInfo.bind(doctorVerificationController));

/**
 * @swagger
 * /api/doctor/verification/{id}/edit:
 *   get:
 *     summary: Get editable verification info
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Get information that can be edited for a verification request.
 */
router.get("/verification/:id/edit", authenticateJWT, doctorVerificationController.getEditableVerificationInfo.bind(doctorVerificationController));

/**
 * @swagger
 * /api/doctor/verification/{id}/documents:
 *   post:
 *     summary: Upload verification documents
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     description: Upload documents for a verification request.
 */
router.post("/verification/:id/documents", authenticateJWT, DocumentUploadMiddleware.processUploadedFiles, doctorVerificationController.uploadDocuments.bind(doctorVerificationController));

/**
 * @swagger
 * /api/doctor/verification/{id}/nin:
 *   post:
 *     summary: Submit NIN for identity verification
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Verification request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nin]
 *             properties:
 *               nin:
 *                 type: string
 *                 example: "12345678901"
 *     description: |
 *       Nigeria-specific identity check. Confirms the doctor's registered name
 *       matches the government record for the NIN they submit.
 */
router.post("/verification/:id/nin", authenticateJWT, doctorVerificationController.submitNin.bind(doctorVerificationController));

/**
 * @swagger
 * /api/doctor/verification/status:
 *   get:
 *     summary: Get verification status
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Get the current verification status.
 *       
 *       **Legacy route**: `GET /doctor/verification/status` (deprecated)
 */
router.get("/verification/status", authenticateJWT, doctorVerificationController.getVerificationStatus);

/**
 * @swagger
 * /api/doctor/verification/countries:
 *   get:
 *     summary: Get supported countries
 *     tags: [Doctor]
 *     description: Get list of countries supported for verification.
 */
router.get("/verification/countries", doctorVerificationController.getSupportedCountries.bind(doctorVerificationController));

/**
 * @swagger
 * /api/doctor/verification/countries/{countryCode}/requirements:
 *   get:
 *     summary: Get country requirements
 *     tags: [Doctor]
 *     description: Get verification requirements for a specific country.
 */
router.get("/verification/countries/:countryCode/requirements", doctorVerificationController.getCountryRequirements.bind(doctorVerificationController));

/**
 * @swagger
 * /api/doctor/verification/history:
 *   get:
 *     summary: Get verification history
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Get the verification history for the doctor.
 *       
 *       **Legacy route**: `GET /doctor/verification/history` (deprecated)
 */
router.get("/verification/history", authenticateJWT, doctorVerificationController.getVerificationHistory);

/**
 * @swagger
 * /api/doctor/search:
 *   get:
 *     summary: Search doctors
 *     tags: [Doctor]
 *     description: |
 *       Search doctors by name, email, or specialty.
 *       
 *       **Legacy route**: `GET /user/doctors/search` (deprecated)
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 3
 */
router.get("/search", profileController.searchDoctors);

// ============================================
// PHARMACY & PRESCRIPTIONS (Doctor Context)
// ============================================

/**
 * @swagger
 * /api/doctor/prescriptions:
 *   post:
 *     summary: Create a prescription
 *     tags: [Doctor, Pharmacy]
 *     security:
 *       - bearerAuth: []
 *     description: Doctor creates a new prescription
 */
router.post("/prescriptions", authenticateJWT, authorizeRoles('doctor'), prescriptionController.createPrescription);

/**
 * @swagger
 * /api/doctor/prescriptions:
 *   get:
 *     summary: Get doctor's prescriptions
 *     tags: [Doctor, Pharmacy]
 *     security:
 *       - bearerAuth: []
 *     description: Get all prescriptions created by the authenticated doctor
 */
router.get("/prescriptions", authenticateJWT, authorizeRoles('doctor'), prescriptionController.getDoctorPrescriptions);

/**
 * @swagger
 * /api/doctor/prescriptions/{prescriptionId}:
 *   get:
 *     summary: Get a specific prescription
 *     tags: [Doctor, Pharmacy]
 *     security:
 *       - bearerAuth: []
 *     description: Get a single prescription by ID
 */
router.get("/prescriptions/:prescriptionId", authenticateJWT, authorizeRoles('doctor'), prescriptionController.getPrescriptionById);

/**
 * @swagger
 * /api/doctor/{userId}:
 *   get:
 *     summary: Get a specific doctor
 *     tags: [Doctor]
 *     description: |
 *       Get doctor details by user ID.
 *       
 *       **Legacy route**: `GET /user/doctor/:userId` (deprecated)
 */
router.get("/:userId", profileController.getDoctor);

/**
 * @swagger
 * /api/doctor/{userId}/status:
 *   get:
 *     summary: Get doctor online status
 *     tags: [Doctor]
 *     description: |
 *       Get a doctor's current online status.
 *       
 *       **Legacy route**: `GET /user/doctor/:userId/online-status` (deprecated)
 */
router.get("/:userId/status", profileController.getOnlineStatus);

/**
 * @swagger
 * /api/doctor/{userId}/ratings:
 *   get:
 *     summary: Get doctor ratings
 *     tags: [Doctor]
 *     description: |
 *       Get all ratings for a doctor.
 *       
 *       **Legacy route**: `GET /user/:userId/ratings` (deprecated)
 */
router.get("/:userId/ratings", profileController.getRatings);

// ============================================
// ADMIN SUPPORT ROUTES
// ============================================

/**
 * @swagger
 * /api/doctor/admin/{doctorId}/onboarding-status:
 *   get:
 *     summary: Get doctor onboarding status
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Get comprehensive onboarding status for a doctor (Admin only).
 */
router.get("/admin/:doctorId/onboarding-status", authenticateJWT, doctorVerificationController.getDoctorOnboardingStatus.bind(doctorVerificationController));

// ============================================
// PROTECTED DOCTOR ROUTES (auth required)
// ============================================

/**
 * @swagger
 * /api/doctor/profile:
 *   post:
 *     summary: Create doctor profile
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates a new doctor profile for the authenticated user.
 *       
 *       **Legacy route**: `POST /user/doctor-profile` (deprecated)
 */
router.post("/profile", authenticateJWT, profileController.createProfile);

/**
 * @swagger
 * /api/doctor/profile/{id}:
 *   get:
 *     summary: Get doctor profile by ID
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieves a doctor profile by its ID.
 *       
 *       **Legacy route**: `GET /user/doctor-profile/:id` (deprecated)
 */
router.get("/profile/:id", authenticateJWT, profileController.getProfileById);

/**
 * @swagger
 * /api/doctor/profile/user/{userId}:
 *   get:
 *     summary: Get doctor profile by user ID
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieves a doctor profile by the user's ID.
 *       
 *       **Legacy route**: `GET /user/doctor-profile/user/:userId` (deprecated)
 */
router.get("/profile/user/:userId", authenticateJWT, profileController.getProfileByUserId);

/**
 * @swagger
 * /api/doctor/profile/{id}:
 *   put:
 *     summary: Update doctor profile
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Updates an existing doctor profile.
 *       
 *       **Legacy route**: `PUT /user/doctor-profile/:id` (deprecated)
 */
router.put("/profile/:id", authenticateJWT, profileController.updateProfile);

/**
 * @swagger
 * /api/doctor/profile/{id}:
 *   delete:
 *     summary: Delete doctor profile
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Deletes a doctor profile.
 *       
 *       **Legacy route**: `DELETE /user/doctor-profile/:id` (deprecated)
 */
router.delete("/profile/:id", authenticateJWT, profileController.deleteProfile);

/**
 * @swagger
 * /api/doctor/status:
 *   put:
 *     summary: Update online status
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Updates the doctor's online availability status.
 *       
 *       **Legacy route**: `PUT /user/doctor/online-status` (deprecated)
 */
router.put("/status", authenticateJWT, profileController.updateOnlineStatus);

/**
 * @swagger
 * /api/doctor/auth-info:
 *   put:
 *     summary: Update auth/profile info
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Updates doctor's basic profile info (name, image, etc.).
 *       
 *       **Legacy route**: `PUT /user/update-auth` (deprecated)
 */
router.put("/auth-info", authenticateJWT, DocumentUploadMiddleware.uploadDocuments(), DocumentUploadMiddleware.handleUploadError, profileController.updateAuthInfo);

/**
 * @swagger
 * /api/doctor/rating:
 *   post:
 *     summary: Add rating
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Add a rating for a doctor.
 *       
 *       **Legacy route**: `POST /user/rating` (deprecated)
 */
router.post("/rating", authenticateJWT, profileController.addRating);

// ============================================
// VERIFICATION ROUTES
// ============================================



// ============================================
// PRICING ROUTES
// Requires doctor subscription to manage pricing
// ============================================

/**
 * @swagger
 * /api/doctor/{doctorId}/pricing:
 *   post:
 *     summary: Set doctor pricing
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Set pricing for a specific consultation type (requires subscription)
 */
router.post("/:doctorId/pricing", authenticateJWT, requireSubscription, pricingController.setPricing.bind(pricingController));

/**
 * @swagger
 * /api/doctor/{doctorId}/pricing:
 *   get:
 *     summary: Get doctor pricing
 *     tags: [Doctor]
 *     description: Get all pricing for a doctor
 */
router.get("/:doctorId/pricing", getLocationFromIPCached, pricingController.getDoctorPricing.bind(pricingController));

/**
 * @swagger
 * /api/doctor/{doctorId}/pricing/{pricingId}:
 *   put:
 *     summary: Update doctor pricing
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Update a specific pricing record (requires subscription)
 */
router.put("/:doctorId/pricing/:pricingId", authenticateJWT, requireSubscription, pricingController.updatePricing.bind(pricingController));

/**
 * @swagger
 * /api/doctor/{doctorId}/pricing/{pricingId}:
 *   delete:
 *     summary: Delete doctor pricing
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Delete a specific pricing record (requires subscription)
 */
router.delete("/:doctorId/pricing/:pricingId", authenticateJWT, requireSubscription, pricingController.deletePricing.bind(pricingController));

// ============================================
// AVAILABILITY ROUTES
// Requires doctor subscription to manage availability
// ============================================

/**
 * @swagger
 * /api/doctor/{doctorId}/availability:
 *   post:
 *     summary: Set weekly availability
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Set weekly availability schedule for a doctor (requires subscription)
 */
router.post("/:doctorId/availability", authenticateJWT, requireSubscription, availabilityController.setAvailability.bind(availabilityController));

/**
 * @swagger
 * /api/doctor/{doctorId}/availability:
 *   put:
 *     summary: Replace weekly availability
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Replace existing weekly availability schedule (requires subscription)
 */
router.put("/:doctorId/availability", authenticateJWT, requireSubscription, availabilityController.replaceAvailability.bind(availabilityController));

/**
 * @swagger
 * /api/doctor/{doctorId}/availability:
 *   get:
 *     summary: Get doctor availability
 *     tags: [Doctor]
 *     description: Get weekly availability for a doctor
 */
router.get("/:doctorId/availability", availabilityController.getDoctorAvailability.bind(availabilityController));

/**
 * @swagger
 * /api/doctor/{doctorId}/availability/slots:
 *   get:
 *     summary: Get available slots
 *     tags: [Doctor]
 *     description: Get available time slots for a specific date
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 */
router.get("/:doctorId/availability/slots", availabilityController.getAvailableSlots.bind(availabilityController));

/**
 * @swagger
 * /api/doctor/{doctorId}/availability/summary:
 *   get:
 *     summary: Get availability summary
 *     tags: [Doctor]
 *     description: Get availability summary for a date range
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 */
router.get("/:doctorId/availability/summary", availabilityController.getAvailabilitySummary.bind(availabilityController));

/**
 * @swagger
 * /api/doctor/{doctorId}/availability/{availabilityId}:
 *   put:
 *     summary: Update availability
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Update a specific availability record (requires subscription)
 */
router.put("/:doctorId/availability/:availabilityId", authenticateJWT, requireSubscription, availabilityController.updateAvailability.bind(availabilityController));

/**
 * @swagger
 * /api/doctor/{doctorId}/availability/{availabilityId}:
 *   delete:
 *     summary: Delete availability
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Delete a specific availability record (requires subscription)
 */
router.delete("/:doctorId/availability/:availabilityId", authenticateJWT, requireSubscription, availabilityController.deleteAvailability.bind(availabilityController));

// ============================================
// UNAVAILABILITY ROUTES
// Requires doctor subscription to manage unavailability
// ============================================

/**
 * @swagger
 * /api/doctor/{doctorId}/unavailability:
 *   post:
 *     summary: Set unavailability period
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Set a period of unavailability (vacation, sick, etc.) (requires subscription)
 */
router.post("/:doctorId/unavailability", authenticateJWT, requireSubscription, availabilityController.setUnavailability.bind(availabilityController));

/**
 * @swagger
 * /api/doctor/{doctorId}/unavailability:
 *   get:
 *     summary: Get unavailability periods
 *     tags: [Doctor]
 *     description: Get unavailability periods for a date range
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 */
router.get("/:doctorId/unavailability", availabilityController.getUnavailability.bind(availabilityController));

/**
 * @swagger
 * /api/doctor/{doctorId}/unavailability/{unavailabilityId}:
 *   put:
 *     summary: Update unavailability
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Update a specific unavailability record (requires subscription)
 */
router.put("/:doctorId/unavailability/:unavailabilityId", authenticateJWT, requireSubscription, availabilityController.updateUnavailability.bind(availabilityController));

/**
 * @swagger
 * /api/doctor/{doctorId}/unavailability/{unavailabilityId}:
 *   delete:
 *     summary: Delete unavailability
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     description: Delete a specific unavailability record (requires subscription)
 */
router.delete("/:doctorId/unavailability/:unavailabilityId", authenticateJWT, requireSubscription, availabilityController.deleteUnavailability.bind(availabilityController));

module.exports = router;