// src/repositories/pharmacy/pharmacyProfileRepository.js
const AppDataSource = require("../../../config/database");

class PharmacyProfileRepository {
  get repo() {
    return AppDataSource.getRepository("PharmacyProfile");
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
    try {
      return await this.repo.findOne({
        where: { userId },
        relations: ["user", "documents", "branches"]
      });
    } catch (e) {
      console.error('💥 PROFILE_REPO_ERROR:', e);
      if (e.stack) console.error('PROFILE_REPO_STACK:', e.stack);
      throw e;
    }
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

  async findAll(options = {}) {
    const { limit = 50, offset = 0, verificationStatus } = options;
    const where = verificationStatus ? { verificationStatus } : {};
    return this.repo.find({
      where,
      relations: ["user"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset
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
      isActive: status === "approved",
      updatedAt: new Date()
    });
  }
}

module.exports = new PharmacyProfileRepository();
