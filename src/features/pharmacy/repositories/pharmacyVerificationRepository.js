// src/repositories/pharmacy/pharmacyVerificationRepository.js
const AppDataSource = require("../../../config/database");

class PharmacyVerificationRepository {
  constructor() {
    this.repo = AppDataSource.getRepository("PharmacyVerificationRequest");
  }

  async create(data) {
    return this.repo.create(data);
  }

  async save(request) {
    return this.repo.save(request);
  }

  async findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: ["pharmacy", "assignedAdmin", "reviewer"]
    });
  }

  async findPendingRequests() {
    return this.repo.find({
      where: { status: "pending" },
      relations: ["pharmacy", "assignedAdmin"],
      order: { submittedAt: "ASC" }
    });
  }

  async findByPharmacyId(pharmacyId) {
    return this.repo.find({
      where: { pharmacyId },
      relations: ["assignedAdmin", "reviewer"],
      order: { submittedAt: "DESC" }
    });
  }

  async assignToAdmin(id, adminId) {
    return this.repo.update(id, {
      assignedTo: adminId,
      assignedAt: new Date(),
      status: "in_progress",
      updatedAt: new Date()
    });
  }

  async updateStatus(id, status, reviewerId, reviewNotes) {
    return this.repo.update(id, {
      status,
      reviewedBy: reviewerId,
      reviewNotes,
      reviewedAt: new Date(),
      completedAt: status === "approved" || status === "rejected" ? new Date() : null,
      updatedAt: new Date()
    });
  }
}

module.exports = new PharmacyVerificationRepository();