// src/routes/adminVerificationRoutes.js
const router = require("express").Router();
const { authenticateJWT, authorizeRoles } = require("../../auth/middlewares/authMiddleware");

const {
  getVerificationQueue,
  assignVerification,
  approveVerification,
  rejectVerification,
  getVerificationDetails,
  getVerificationStatistics,
  getStuckDoctors,             // NEW
  getDoctorsPendingBookingSetup, // NEW
  getVerificationDocuments,    // NEW
  viewDocument,                // NEW
  downloadDocument,            // NEW
  getDocumentThumbnail         // NEW
} = require("../controllers/adminVerificationController");

// Apply authentication and admin authorization
router.use(authenticateJWT);
router.use(authorizeRoles('admin', 'super_admin'));

// Admin verification management routes
router.get("/queue", getVerificationQueue);
router.get("/stuck-doctors", getStuckDoctors);
router.get("/pending-booking-setup", getDoctorsPendingBookingSetup);
router.get("/statistics", getVerificationStatistics);
router.get("/:id", getVerificationDetails);
router.post("/:id/assign", assignVerification);
router.post("/:id/approve", approveVerification);
router.post("/:id/reject", rejectVerification);

router.get("/:id/documents", getVerificationDocuments);
router.get("/documents/:documentId/view", viewDocument);
router.get("/documents/:documentId/download", downloadDocument);
router.get("/documents/:documentId/thumbnail", getDocumentThumbnail);

// router.get("/:id/documents", getVerificationDocuments);
// router.get("/documents/:documentId/view", viewDocument);
// router.get("/documents/:documentId/download", downloadDocument);
// router.get("/documents/:documentId/thumbnail", getDocumentThumbnail);

module.exports = router;