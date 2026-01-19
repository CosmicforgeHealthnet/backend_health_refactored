// src/routes/pharmacy/documentRoutes.js
const router = require("express").Router();
const pharmacyDocumentController = require("../controllers/pharmacyDocumentController");
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");
const DocumentUploadMiddleware = require("../../documents/middlewares/documentUploadMiddleware");
const DocumentFolderMiddleware = require("../../documents/middlewares/documentFolderMiddleware");

// Document upload pipeline
router.post("/upload",
  authenticateJWT,
  DocumentUploadMiddleware.uploadDocuments(),
  DocumentUploadMiddleware.handleUploadError,
  DocumentUploadMiddleware.processUploadedFiles,
  DocumentFolderMiddleware.handleFolderCreation,
  DocumentFolderMiddleware.saveFilesToDatabase,
  pharmacyDocumentController.uploadDocuments
);

router.get("/", authenticateJWT, pharmacyDocumentController.getDocuments);

module.exports = router;