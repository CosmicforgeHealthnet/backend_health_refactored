const router                   = require("express").Router();
const vendorAuthController     = require("../controllers/vendorAuthController");
const { authenticateJWT, authorizeRoles } = require("../../auth/middlewares/authMiddleware");
const DocumentUploadMiddleware = require("../../documents/middlewares/documentUploadMiddleware");
const DocumentFolderMiddleware = require("../../documents/middlewares/documentFolderMiddleware");

// Public
router.post("/register",            vendorAuthController.registerVendor);
router.post("/login",               vendorAuthController.loginVendor);
router.post("/forgot-password",     vendorAuthController.forgotPassword);
router.post("/reset-password",      vendorAuthController.resetPassword);
router.get("/verify-email",         vendorAuthController.verifyEmail);
router.post("/resend-verification", vendorAuthController.resendVerification);
router.post("/refresh",             vendorAuthController.refresh);

// Protected
router.get("/profile",  authenticateJWT, vendorAuthController.getVendorProfile);
router.put("/profile",  authenticateJWT, vendorAuthController.updateVendorProfile);
router.put("/account",  authenticateJWT, vendorAuthController.updateAccountSettings);
router.post("/change-password", authenticateJWT, vendorAuthController.changePassword);

router.post(
    "/profile/logo",
    authenticateJWT,
    DocumentUploadMiddleware.uploadDocuments(),
    DocumentUploadMiddleware.handleUploadError,
    DocumentUploadMiddleware.processUploadedFiles,
    DocumentFolderMiddleware.handleFolderCreation,
    DocumentFolderMiddleware.saveFilesToDatabase,
    vendorAuthController.uploadVendorLogo
);

router.post(
    "/documents",
    authenticateJWT,
    DocumentUploadMiddleware.uploadDocuments(),
    DocumentUploadMiddleware.handleUploadError,
    DocumentUploadMiddleware.processUploadedFiles,
    DocumentFolderMiddleware.handleFolderCreation,
    DocumentFolderMiddleware.saveFilesToDatabase,
    vendorAuthController.uploadDocument
);

// Admin only
router.get("/all", authenticateJWT, authorizeRoles("admin"), vendorAuthController.getAllVendors);

module.exports = router;
