// src/repositories/pharmacy/pharmacyProfileRepository.js
const AppDataSource = require("../../../config/database");

class PharmacyProfileRepository {
  constructor() {
    this.repo = AppDataSource.getRepository("PharmacyProfile");
  }

  async create(data) {
    return this.repo.create(data);
  }

  async save(pharmacyProfile) {
    return this.repo.save(pharmacyProfile);
  }

  async findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: ["user", "documents", "branches"]
    });
  }

  async findByUserId(userId) {
    return this.repo.findOne({
      where: { userId },
      relations: ["user", "documents", "branches"]
    });
  }

  async findByUsername(username) {
    return this.repo.findOne({
      where: { preferredUsername: username }
    });
  }

  async findByRegistrationNumber(registrationNumber) {
    return this.repo.findOne({
      where: { registrationNumber }
    });
  }

  async updateDocumentSubmissionStatus(id, documentsSubmitted) {
    return this.repo.update(id, {
      documentsSubmitted,
      updatedAt: new Date()
    });
  }

  async findPendingVerifications() {
    return this.repo.find({
      where: { verificationStatus: "pending" },
      relations: ["user", "documents"]
    });
  }

  async updateVerificationStatus(id, status) {
    return this.repo.update(id, {
      verificationStatus: status,
      updatedAt: new Date()
    });
  }
}

module.exports = new PharmacyProfileRepository();
