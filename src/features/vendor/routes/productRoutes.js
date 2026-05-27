const router                   = require("express").Router();
const productController        = require("../controllers/productController");
const { authenticateJWT }      = require("../../auth/middlewares/authMiddleware");
const DocumentUploadMiddleware = require("../../documents/middlewares/documentUploadMiddleware");
const DocumentFolderMiddleware = require("../../documents/middlewares/documentFolderMiddleware");

// ─── Vendor product management (all protected) ────────────────────────────────
router.get("/",    authenticateJWT, productController.getMyProducts);
router.post("/",   authenticateJWT, productController.createProduct);
router.get("/:id", authenticateJWT, productController.getMyProductById);
router.put("/:id", authenticateJWT, productController.updateProduct);
router.delete("/:id", authenticateJWT, productController.deleteProduct);

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
router.get("/admin/all",             authenticateJWT, productController.adminGetAllProducts);
router.put("/admin/:id/approve",     authenticateJWT, productController.adminApproveProduct);
router.put("/admin/:id/reject",      authenticateJWT, productController.adminRejectProduct);

module.exports = router;
