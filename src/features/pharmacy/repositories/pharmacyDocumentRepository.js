// src/repositories/pharmacy/pharmacyDocumentRepository.js
const AppDataSource = require("../../../config/database");

class PharmacyDocumentRepository {
  get repo() {
    return AppDataSource.getRepository("PharmacyDocument");
  }

  async create(data) {
    return this.repo.create(data);
  }

  async save(document) {
    return this.repo.save(document);
  }

  async findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: ["pharmacy", "documentFile", "verifier"]
    });
  }

  async findByPharmacyId(pharmacyId) {
    return this.repo.find({
      where: { pharmacyId },
      relations: ["documentFile", "verifier"]
    });
  }

  async findPendingDocuments() {
    return this.repo.find({
      where: { isVerified: false },
      relations: ["pharmacy", "documentFile"]
    });
  }

  async updateVerification(id, isVerified, verifiedBy, notes) {
    return this.repo.update(id, {
      isVerified,
      verifiedBy,
      verificationNotes: notes,
      verifiedAt: new Date(),
      // Keep submissionStatus in sync — it previously stayed frozen at its
      // "pending" default forever, even after a document was verified/rejected,
      // since only isVerified was ever written.
      submissionStatus: isVerified ? "approved" : "rejected",
      updatedAt: new Date()
    });
  }

  async deleteById(id) {
    return this.repo.delete(id);
  }
}

module.exports = new PharmacyDocumentRepository();
