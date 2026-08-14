// src/controllers/pharmacy/adminVerificationController.js
const pharmacyVerificationService = require("../services/pharmacyVerificationService");

class AdminVerificationController {
  async getPendingVerifications(req, res, next) {
    try {
      const verifications = await pharmacyVerificationService.getPendingVerifications();

      return res.json({
        verifications: verifications.map(v => ({
          id: v.id,
          pharmacyId: v.pharmacyId,
          pharmacyName: v.pharmacy?.pharmacyName,
          registrationNumber: v.pharmacy?.registrationNumber,
          requestType: v.requestType,
          status: v.status,
          priority: v.priority,
          submittedAt: v.submittedAt,
          assignedTo: v.assignedTo
        }))
      });
    } catch (error) {
      next(error);
    }
  }

  async assignVerification(req, res, next) {
    try {
      const { verificationId } = req.params;
      const { adminId } = req.body;
      const currentAdminId = req.user.sub;

      // Use current admin if no specific admin provided
      const assigneeId = adminId || currentAdminId;

      await pharmacyVerificationService.assignVerificationToAdmin(verificationId, assigneeId);

      return res.json({
        message: "Verification assigned successfully"
      });
    } catch (error) {
      if (error.message.includes("not found") || error.message.includes("not pending")) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  async reviewPharmacy(req, res, next) {
    try {
      const { pharmacyId } = req.params;
      const adminId = req.user.sub;

      const reviewData = await pharmacyVerificationService.reviewPharmacyDocuments(pharmacyId, adminId);

      return res.json({
        pharmacy: reviewData.pharmacy,
        documents: reviewData.documents.map(doc => ({
          id: doc.id,
          documentType: doc.documentType,
          documentName: doc.documentName,
          isVerified: doc.isVerified,
          verificationNotes: doc.verificationNotes,
          submissionStatus: doc.submissionStatus,
          documentFile: doc.documentFile
        }))
      });
    } catch (error) {
      if (error.message.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }

  async verifyDocument(req, res, next) {
    try {
      const { documentId } = req.params;
      const { isVerified, notes } = req.body;
      const adminId = req.user.sub;

      await pharmacyVerificationService.verifyDocument(documentId, adminId, isVerified, notes);

      return res.json({
        message: "Document verification updated successfully"
      });
    } catch (error) {
      if (error.message.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }

  async approvePharmacy(req, res, next) {
    try {
      const { pharmacyId } = req.params;
      const { reviewNotes } = req.body;
      const adminId = req.user.sub;

      const result = await pharmacyVerificationService.approvePharmacy(pharmacyId, adminId, reviewNotes);

      return res.json(result);
    } catch (error) {
      if (error.message.includes("not found") || error.message.includes("must be verified") || error.message.includes("no documents")) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  async rejectPharmacy(req, res, next) {
    try {
      const { pharmacyId } = req.params;
      const { rejectionReason } = req.body;
      const adminId = req.user.sub;

      if (!rejectionReason) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }

      const result = await pharmacyVerificationService.rejectPharmacy(pharmacyId, adminId, rejectionReason);

      return res.json(result);
    } catch (error) {
      if (error.message.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }

  async requestMoreDocuments(req, res, next) {
    try {
      const { pharmacyId } = req.params;
      const { requiredDocuments } = req.body;
      const adminId = req.user.sub;

      if (!requiredDocuments || !Array.isArray(requiredDocuments)) {
        return res.status(400).json({ error: "Required documents list is needed" });
      }

      const result = await pharmacyVerificationService.requestMoreDocuments(pharmacyId, adminId, requiredDocuments);

      return res.json(result);
    } catch (error) {
      if (error.message.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }
}

module.exports = new AdminVerificationController();