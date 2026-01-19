// src/services/pharmacy/pharmacyVerificationService.js
const pharmacyProfileRepo = require("../repositories/pharmacyProfileRepository");
const pharmacyDocumentRepo = require("../repositories/pharmacyDocumentRepository");
const pharmacyVerificationRepo = require("../repositories/pharmacyVerificationRepository");

class PharmacyVerificationService {
  async getPendingVerifications() {
    return await pharmacyVerificationRepo.findPendingRequests();
  }

  async assignVerificationToAdmin(verificationId, adminId) {
    const verification = await pharmacyVerificationRepo.findById(verificationId);
    if (!verification) {
      throw new Error("Verification request not found");
    }

    if (verification.status !== "pending") {
      throw new Error("Verification request is not pending");
    }

    return await pharmacyVerificationRepo.assignToAdmin(verificationId, adminId);
  }

  async reviewPharmacyDocuments(pharmacyId) {
    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);
    if (!pharmacy) {
      throw new Error("Pharmacy not found");
    }

    const documents = await pharmacyDocumentRepo.findByPharmacyId(pharmacyId);
    return {
      pharmacy,
      documents
    };
  }

  async verifyDocument(documentId, adminId, isVerified, notes) {
    const document = await pharmacyDocumentRepo.findById(documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    return await pharmacyDocumentRepo.updateVerification(
      documentId,
      isVerified,
      adminId,
      notes
    );
  }

  async approvePharmacy(pharmacyId, adminId, reviewNotes) {
    // Check if all documents are verified
    const documents = await pharmacyDocumentRepo.findByPharmacyId(pharmacyId);
    const unverifiedDocs = documents.filter(doc => !doc.isVerified);

    if (unverifiedDocs.length > 0) {
      throw new Error("All documents must be verified before approval");
    }

    // Update pharmacy status
    await pharmacyProfileRepo.updateVerificationStatus(pharmacyId, "approved");

    // Update verification request
    const verificationRequests = await pharmacyVerificationRepo.findByPharmacyId(pharmacyId);
    const activeRequest = verificationRequests.find(req => req.status === "in_progress");

    if (activeRequest) {
      await pharmacyVerificationRepo.updateStatus(
        activeRequest.id,
        "approved",
        adminId,
        reviewNotes
      );
    }

    return { success: true, message: "Pharmacy approved successfully" };
  }

  async rejectPharmacy(pharmacyId, adminId, rejectionReason) {
    // Update pharmacy status
    await pharmacyProfileRepo.updateVerificationStatus(pharmacyId, "rejected");

    // Update verification request
    const verificationRequests = await pharmacyVerificationRepo.findByPharmacyId(pharmacyId);
    const activeRequest = verificationRequests.find(req => req.status === "in_progress");

    if (activeRequest) {
      await pharmacyVerificationRepo.updateStatus(
        activeRequest.id,
        "rejected",
        adminId,
        rejectionReason
      );
    }

    return { success: true, message: "Pharmacy rejected" };
  }

  async requestMoreDocuments(pharmacyId, adminId, requiredDocuments) {
    // Update pharmacy status
    await pharmacyProfileRepo.updateVerificationStatus(pharmacyId, "requires_changes");

    // Update verification request
    const verificationRequests = await pharmacyVerificationRepo.findByPharmacyId(pharmacyId);
    const activeRequest = verificationRequests.find(req => req.status === "in_progress");

    if (activeRequest) {
      await pharmacyVerificationRepo.updateStatus(
        activeRequest.id,
        "requires_changes",
        adminId,
        `Additional documents required: ${requiredDocuments.join(", ")}`
      );
    }

    return { success: true, message: "Additional documents requested" };
  }
}

module.exports = new PharmacyVerificationService();