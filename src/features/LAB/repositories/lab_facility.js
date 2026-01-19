// src/repositories/labFacilityRepository.js
const AppDataSource = require("../../../config/database");
const LabFacility = require("../entities/lab_facility");

class LabFacilityRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(LabFacility);
  }

  // Basic CRUD operations
  create(data) {
    return this.repo.create(data);
  }

  save(facility) {
    return this.repo.save(facility);
  }

  findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: ["adminUser", "approvedBy", "personnel"],
    });
  }

  // Find facilities by admin email (before user account creation)
  findByAdminEmail(adminEmail) {
    return this.repo.findOne({ where: { adminEmail } });
  }

  // Find facilities by various unique fields
  findByEmail(email) {
    return this.repo.findOne({ where: { email } });
  }

  findByRegistrationNumber(registrationNumber) {
    return this.repo.findOne({ where: { registrationNumber } });
  }

  findByLicenseNumber(licenseNumber) {
    return this.repo.findOne({ where: { licenseNumber } });
  }

  // Find facilities by admin user (after user account is created)
  findByAdminUserId(adminUserId) {
    return this.repo.find({
      where: { adminUser: { id: adminUserId } },
      relations: ["adminUser", "personnel"],
    });
  }

  // Find facilities by status
  findByStatus(status) {
    return this.repo.find({
      where: { status },
      relations: ["adminUser"],
      order: { createdAt: "DESC" },
    });
  }

  // Find pending facilities for admin review
  findPendingApproval() {
    return this.repo.find({
      where: { status: "pending_approval" },
      relations: ["adminUser"],
      order: { createdAt: "ASC" },
    });
  }

  // Update facility status with additional fields
  async updateStatus(id, status, adminId, rejectionReason = null) {
    const updateData = { status };

    if (status === "approved") {
      updateData.approvedAt = new Date();
      updateData.approvedBy = { id: adminId };
    } else if (status === "rejected") {
      updateData.rejectedAt = new Date();
      updateData.rejectionReason = rejectionReason;
    }

    return this.repo.update({ id }, updateData);
  }

  // Update admin user association after user account creation
  async linkAdminUser(facilityId, adminUserId) {
    return this.repo.update(
      { id: facilityId },
      {
        adminUser: { id: adminUserId },
        adminUserCreated: true,
      }
    );
  }

  // Mark admin invitation as sent
  async markAdminInvitationSent(facilityId) {
    return this.repo.update({ id: facilityId }, { adminInvitationSent: true });
  }

  // Search facilities
  searchFacilities(query) {
    return this.repo
      .createQueryBuilder("facility")
      .leftJoinAndSelect("facility.adminUser", "adminUser")
      .where("facility.facilityName ILIKE :query", { query: `%${query}%` })
      .orWhere("facility.city ILIKE :query", { query: `%${query}%` })
      .orWhere("facility.email ILIKE :query", { query: `%${query}%` })
      .orWhere("facility.adminEmail ILIKE :query", { query: `%${query}%` })
      .orderBy("facility.createdAt", "DESC")
      .getMany();
  }

  // Find active facilities by location
  findByLocation(city, state) {
    return this.repo.find({
      where: { city, state, status: "active" },
      relations: ["adminUser"],
      order: { facilityName: "ASC" },
    });
  }

  // Find facilities that need user account creation
  findNeedingUserAccountCreation() {
    return this.repo.find({
      where: {
        status: "approved",
        adminUserCreated: false,
      },
      order: { approvedAt: "ASC" },
    });
  }

  // Statistics and reporting
  async getStatusCounts() {
    const result = await this.repo
      .createQueryBuilder("facility")
      .select("facility.status", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("facility.status")
      .getRawMany();

    return result.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});
  }

  // Get recent registrations
  findRecentRegistrations(limit = 10) {
    return this.repo.find({
      order: { createdAt: "DESC" },
      take: limit,
      relations: ["adminUser"],
    });
  }

  // Find draft facilities (for cleanup)
  findDraftFacilities(olderThanHours = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

    return this.repo.find({
      where: {
        status: "draft",
        createdAt: { $lt: cutoffDate },
      },
    });
  }
}

module.exports = new LabFacilityRepository();
