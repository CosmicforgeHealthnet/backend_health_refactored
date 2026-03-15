// src/routes/pharmacy/authRoutes.js
const router = require("express").Router();
const pharmacyAuthController     = require('../controllers/pharmacyAuthController');
const { authenticateJWT }        = require("../../auth/middlewares/authMiddleware");
const DocumentUploadMiddleware   = require("../../documents/middlewares/documentUploadMiddleware");
const DocumentFolderMiddleware   = require("../../documents/middlewares/documentFolderMiddleware");

// Public routes
router.post("/register", pharmacyAuthController.registerPharmacy);
router.post("/login", pharmacyAuthController.loginPharmacy);

// Protected routes
router.get("/profile", authenticateJWT, pharmacyAuthController.getPharmacyProfile);
router.put("/profile", authenticateJWT, pharmacyAuthController.updatePharmacyProfile);
router.get("/pricing", authenticateJWT, pharmacyAuthController.getPricing);
router.post("/pricing", authenticateJWT, pharmacyAuthController.setPricing);

/**
 * @route   POST /api/pharmacy/auth/profile/logo
 * @desc    Upload pharmacy profile logo
 * @access  Pharmacy staff
 */
router.post(
  "/profile/logo",
  authenticateJWT,
  DocumentUploadMiddleware.uploadDocuments(),
  DocumentUploadMiddleware.handleUploadError,
  DocumentUploadMiddleware.processUploadedFiles,
  DocumentFolderMiddleware.handleFolderCreation,
  DocumentFolderMiddleware.saveFilesToDatabase,
  pharmacyAuthController.uploadProfileLogo,
);

// Staff management
router.post("/staff", authenticateJWT, pharmacyAuthController.addStaff);
router.get("/staff", authenticateJWT, pharmacyAuthController.getStaff);
router.delete("/staff/:id", authenticateJWT, pharmacyAuthController.removeStaff);

module.exports = router;