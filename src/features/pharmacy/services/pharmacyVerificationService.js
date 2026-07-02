// src/services/pharmacy/pharmacyVerificationService.js
const pharmacyProfileRepo = require("../repositories/pharmacyProfileRepository");
const pharmacyDocumentRepo = require("../repositories/pharmacyDocumentRepository");
const pharmacyVerificationRepo = require("../repositories/pharmacyVerificationRepository");
const AppDataSource = require("../../../config/database");

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

    // Auto-create vendor profile so pharmacy can list products in the shop directly
    await this._ensureVendorProfile(pharmacyId);

    return { success: true, message: "Pharmacy approved successfully" };
  }

  async _ensureVendorProfile(pharmacyId) {
    try {
      const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);
      if (!pharmacy) return;

      const vendorRepo  = AppDataSource.getRepository("VendorProfile");
      const walletRepo  = AppDataSource.getRepository("VendorWallet");

      const existing = await vendorRepo.findOne({ where: { userId: pharmacy.userId } });
      if (existing) return; // already has one

      const vendor = vendorRepo.create({
        userId:              pharmacy.userId,
        businessName:        pharmacy.pharmacyName,
        businessCategory:    "health_wellness",
        businessEmail:       pharmacy.email        || null,
        businessPhone:       pharmacy.phone        || null,
        country:             "Nigeria",
        state:               pharmacy.state        || "",
        city:                pharmacy.city         || "",
        fullAddress:         pharmacy.address      || "",
        businessDescription: `${pharmacy.pharmacyName} — Licensed Pharmacy`,
        verificationStatus:  "approved",
        isActive:            true,
        documentsSubmitted:  true,
        isHybridPharmacy:    true,
        pharmacyProfileId:   pharmacy.id,
      });
      const saved = await vendorRepo.save(vendor);

      await walletRepo.save(walletRepo.create({
        vendorId:            saved.id,
        availableBalanceNgn: 0,
        pendingClearanceNgn: 0,
        totalEarningsNgn:    0,
        isActive:            true,
        isFrozen:            false,
      }));
    } catch (err) {
      // Non-critical — log but don't block approval
      console.error("[PharmacyVerification] Auto vendor profile creation failed:", err.message);
    }
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