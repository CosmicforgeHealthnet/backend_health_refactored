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
      updatedAt: new Date()
    });
  }
}

module.exports = new PharmacyDocumentRepository();
