// src/routes/pharmacy/adminRoutes.js
const router = require("express").Router();
const adminVerificationController = require("../controllers/adminVerificationController");
const { authenticateJWT, authorizeRoles } = require("../../auth/middlewares/authMiddleware");

// Admin only routes
router.use(authenticateJWT);
router.use(authorizeRoles("admin", "super_admin"));

// Verification management
router.get("/verifications/pending", adminVerificationController.getPendingVerifications);
router.post("/verifications/:verificationId/assign", adminVerificationController.assignVerification);
router.get("/pharmacy/:pharmacyId/review", adminVerificationController.reviewPharmacy);

// Document verification
router.post("/documents/:documentId/verify", adminVerificationController.verifyDocument);

// Pharmacy approval/rejection
router.post("/pharmacy/:pharmacyId/approve", adminVerificationController.approvePharmacy);
router.post("/pharmacy/:pharmacyId/reject", adminVerificationController.rejectPharmacy);
router.post("/pharmacy/:pharmacyId/request-documents", adminVerificationController.requestMoreDocuments);

module.exports = router;