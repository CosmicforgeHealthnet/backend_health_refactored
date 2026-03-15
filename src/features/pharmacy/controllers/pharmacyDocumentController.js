// src/controllers/pharmacy/pharmacyDocumentController.js
const pharmacyRegistrationService = require("../services/pharmacyRegistrationService");
const pharmacyDocumentRepo = require("../repositories/pharmacyDocumentRepository");
// const DocumentFolderMiddleware = require("../../documents/middlewares/documentFolderMiddleware");

class PharmacyDocumentController {
  async uploadDocuments(req, res, next) {
    try {
      const userId = req.user.sub;
      const pharmacy = await pharmacyRegistrationService.getPharmacyProfile(userId);

      if (!pharmacy) {
        return res.status(404).json({ error: "Pharmacy profile not found" });
      }

      // Documents are already processed by middleware
      if (!req.savedFiles || req.savedFiles.length === 0) {
        return res.status(400).json({ error: "No documents uploaded" });
      }

      // Map saved files to pharmacy documents
      const documentsData = req.savedFiles.map((file, index) => ({
        fileId: file.id,
        documentType: req.body[`documentType_${index}`] || "other",
        documentName: req.body[`documentName_${index}`] || file.originalFileName
      }));

      const savedDocuments = await pharmacyRegistrationService.uploadPharmacyDocuments(
        pharmacy.id,
        documentsData
      );

      return res.json({
        message: "Documents uploaded successfully",
        documents: savedDocuments.map(doc => ({
          id: doc.id,
          documentType: doc.documentType,
          documentName: doc.documentName,
          submissionStatus: doc.submissionStatus
        })),
        pharmacy: {
          verificationStatus: "documents_required"
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getDocuments(req, res, next) {
    try {
      const userId = req.user.sub;
      const pharmacy = await pharmacyRegistrationService.getPharmacyProfile(userId);

      if (!pharmacy) {
        return res.status(404).json({ error: "Pharmacy profile not found" });
      }

      return res.json({
        documents: pharmacy.documents || []
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteDocument(req, res, next) {
    try {
      const userId = req.user.sub;
      const { id } = req.params;

      const pharmacy = await pharmacyRegistrationService.getPharmacyProfile(userId);
      if (!pharmacy) {
        return res.status(404).json({ error: "Pharmacy profile not found" });
      }

      const doc = await pharmacyDocumentRepo.findById(id);
      if (!doc || doc.pharmacyId !== pharmacy.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      await pharmacyDocumentRepo.deleteById(id);
      return res.status(200).json({ message: "Document deleted" });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PharmacyDocumentController();
