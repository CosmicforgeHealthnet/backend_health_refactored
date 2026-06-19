const router                   = require("express").Router();
const productController        = require("../controllers/productController");
const { authenticateJWT, authorizeRoles } = require("../../auth/middlewares/authMiddleware");
const DocumentUploadMiddleware = require("../../documents/middlewares/documentUploadMiddleware");
const DocumentFolderMiddleware = require("../../documents/middlewares/documentFolderMiddleware");

// ─── Vendor/Pharmacy product management ──────────────────────────────────────
router.get("/",       authenticateJWT, authorizeRoles("vendor", "pharmacy"), productController.getMyProducts);
router.post("/",      authenticateJWT, authorizeRoles("vendor", "pharmacy"), productController.createProduct);
router.get("/:id",    authenticateJWT, authorizeRoles("vendor", "pharmacy"), productController.getMyProductById);
router.put("/:id",    authenticateJWT, authorizeRoles("vendor", "pharmacy"), productController.updateProduct);
router.delete("/:id", authenticateJWT, authorizeRoles("vendor", "pharmacy"), productController.deleteProduct);

router.post(
    "/media/upload",
    authenticateJWT,
    authorizeRoles("vendor", "pharmacy"),
    DocumentUploadMiddleware.uploadDocuments(),
    DocumentUploadMiddleware.handleUploadError,
    DocumentUploadMiddleware.processUploadedFiles,
    DocumentFolderMiddleware.handleFolderCreation,
    DocumentFolderMiddleware.saveFilesToDatabase,
    productController.uploadStandaloneMedia
);

router.post(
    "/:id/media",
    authenticateJWT,
    DocumentUploadMiddleware.uploadDocuments(),
    DocumentUploadMiddleware.handleUploadError,
    DocumentUploadMiddleware.processUploadedFiles,
    DocumentFolderMiddleware.handleFolderCreation,
    DocumentFolderMiddleware.saveFilesToDatabase,
    productController.uploadProductMedia
);

// ─── Admin product approval ───────────────────────────────────────────────────
router.get("/admin/all",         authenticateJWT, authorizeRoles("admin"), productController.adminGetAllProducts);
router.put("/admin/:id/approve", authenticateJWT, authorizeRoles("admin"), productController.adminApproveProduct);
router.put("/admin/:id/reject",  authenticateJWT, authorizeRoles("admin"), productController.adminRejectProduct);

module.exports = router;
