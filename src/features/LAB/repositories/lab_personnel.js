// src/repositories/labPersonnelRepository.js
const AppDataSource = require("../../../config/database");
const LabPersonnel = require("../entities/lab_personnel");

class LabPersonnelRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(LabPersonnel);
  }

  // Basic CRUD operations
  create(data) {
    return this.repo.create(data);
  }

  save(personnel) {
    return this.repo.save(personnel);
  }

  findById(id) {
    return this.repo.findOne({ 
      where: { id },
      relations: ["facility", "user", "invitedBy"]
    });
  }

  // Find personnel by facility
  findByFacilityId(facilityId) {
    return this.repo.find({ 
      where: { facility: { id: facilityId } },
      relations: ["facility", "user", "invitedBy"],
      order: { createdAt: "DESC" }
    });
  }

  // Find personnel by email (before user account creation)
  findByEmail(email) {
    return this.repo.findOne({ 
      where: { email },
      relations: ["facility", "user"]
    });
  }

  // Find personnel by registration token
  findByRegistrationToken(token) {
    return this.repo.findOne({ 
      where: { registrationToken: token },
      relations: ["facility", "invitedBy"]
    });
  }

  // Find personnel by user (after account creation)
  findByUserId(userId) {
    return this.repo.find({ 
      where: { user: { id: userId } },
      relations: ["facility", "user"]
    });
  }

  // Find personnel by facility and role
  findByFacilityAndRole(facilityId, role) {
    return this.repo.find({ 
      where: { 
        facility: { id: facilityId },
        role: role
      },
      relations: ["user", "facility"]
    });
  }

  // Update personnel status
  async updateStatus(id, status) {
    const updateData = { status };
    
    if (status === "active") {
      updateData.registeredAt = new Date();
    }
    
    return this.repo.update({ id }, updateData);
  }

  // Link user account after registration
  async linkUserAccount(personnelId, userId) {
    return this.repo.update(
      { id: personnelId },
      { 
        user: { id: userId },
        userAccountCreated: true,
        registeredAt: new Date(),
        status: "registered"
      }
    );
  }

  // Complete registration process
  async completeRegistration(token, userId) {
    return this.repo.update(
      { registrationToken: token },
      { 
        user: { id: userId },
        userAccountCreated: true,
        firstLoginCompleted: true,
        registeredAt: new Date(),
        status: "active",
        registrationToken: null,
        tempPassword: null
      }
    );
  }

  // Mark invitation as sent
  async markInvitationSent(personnelId, registrationToken, tempPassword, tokenExpiresAt) {
    return this.repo.update(
      { id: personnelId },
      { 
        registrationToken,
        tempPassword,
        tokenExpiresAt,
        invitationSentAt: new Date(),
        status: "invitation_sent"
      }
    );
  }

  // Find personnel needing user account creation
  findNeedingUserAccountCreation() {
    return this.repo.find({
      where: { userAccountCreated: false },
      relations: ["facility"],
      order: { createdAt: "ASC" }
    });
  }

  // Find expired invitations
  findExpiredInvitations() {
    return this.repo
      .createQueryBuilder("personnel")
      .leftJoinAndSelect("personnel.facility", "facility")
      .where("personnel.tokenExpiresAt < :now", { now: new Date() })
      .andWhere("personnel.status = :status", { status: "invitation_sent" })
      .getMany();
  }

  // Get personnel statistics by facility
  async getPersonnelStatsByFacility(facilityId) {
    const result = await this.repo
      .createQueryBuilder("personnel")
      .select("personnel.role", "role")
      .addSelect("personnel.status", "status")
      .addSelect("COUNT(*)", "count")
      .where("personnel.facilityId = :facilityId", { facilityId })
      .groupBy("personnel.role, personnel.status")
      .getRawMany();

    return result.reduce((acc, row) => {
      if (!acc[row.role]) acc[row.role] = {};
      acc[row.role][row.status] = parseInt(row.count);
      return acc;
    }, {});
  }

  // Find personnel by multiple emails (for bulk operations)
  findByEmails(emails) {
    return this.repo
      .createQueryBuilder("personnel")
      .leftJoinAndSelect("personnel.facility", "facility")
      .where("personnel.email IN (:...emails)", { emails })
      .getMany();
  }

  // Update personnel role
  async updateRole(personnelId, newRole) {
    return this.repo.update(
      { id: personnelId },
      { role: newRole }
    );
  }

  // Soft delete personnel (change status to terminated)
  async terminatePersonnel(personnelId) {
    return this.repo.update(
      { id: personnelId },
      { 
        status: "terminated",
        terminatedAt: new Date()
      }
    );
  }

  // Hard delete personnel
  delete(id) {
    return this.repo.delete(id);
  }

  // Find personnel with pending invitations (for reminders)
  findPendingInvitations(daysSinceInvitation = 3) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceInvitation);
    
    return this.repo
      .createQueryBuilder("personnel")
      .leftJoinAndSelect("personnel.facility", "facility")
      .leftJoinAndSelect("personnel.invitedBy", "invitedBy")
      .where("personnel.status = :status", { status: "invitation_sent" })
      .andWhere("personnel.invitationSentAt <= :cutoffDate", { cutoffDate })
      .andWhere("personnel.tokenExpiresAt > :now", { now: new Date() })
      .getMany();
  }
}

module.exports = new LabPersonnelRepository();