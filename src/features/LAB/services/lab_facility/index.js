// src/services/labFacilityService.js
const labFacilityRepository = require("../../repositories/lab_facility");
const userRepository = require("../../../auth/repositories/userRepository");
const { USER_ROLES } = require("../../../../shared/utils/constants");
const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const {
  sendLabFacilityRegistrationEmail,
  sendLabFacilityApprovalEmail,
  sendLabFacilityRejectionEmail,
  sendAdminLabFacilityNotificationEmail,
  sendLabAdminRegistrationEmail,
} = require("../../../../shared/services/email/helper/lab");

class LabFacilityService {
  /**
   * Register a new lab facility (with admin user creation)
   * This creates the facility record and prepares for admin user creation
   */
  async registerFacility(facilityData) {
    // Validate required fields
    this.validateFacilityData(facilityData);

    // Check for existing facilities with same email, registration, or license
    await this.checkForDuplicates(facilityData);

    // Create facility record (admin user will be created after approval)
    const facility = labFacilityRepository.create({
      ...facilityData,
      status: "pending_approval",
      adminUserCreated: false,
      adminInvitationSent: false,
    });

    const savedFacility = await labFacilityRepository.save(facility);

    // Send registration confirmation email to facility admin
    try {
      await sendLabFacilityRegistrationEmail(savedFacility);
    } catch (emailError) {
      console.error("Failed to send registration email:", emailError);
    }

    // Notify system admin about new facility registration
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await sendAdminLabFacilityNotificationEmail(adminEmail, savedFacility);
      }
    } catch (emailError) {
      console.error("Failed to send admin notification:", emailError);
    }

    return savedFacility;
  }

  /**
   * Approve facility and create admin user account
   * This is where the lab admin user gets created and invited
   */
  async approveFacility(facilityId, platformAdminId) {
    const facility = await labFacilityRepository.findById(facilityId);
    if (!facility) {
      throw new Error("Facility not found");
    }

    if (facility.status !== "pending_approval") {
      throw new Error("Facility is not pending approval");
    }

    // Check if admin email already exists in users table
    const existingUser = await userRepository.findByEmail(facility.adminEmail);
    if (existingUser) {
      throw new Error(
        `User with email ${facility.adminEmail} already exists. Please use a different email for the lab admin.`
      );
    }

    // Step 1: Update facility status to approved
    await labFacilityRepository.updateStatus(
      facilityId,
      "approved",
      platformAdminId
    );

    // Step 2: Create lab admin user account
    const adminUser = await this.createLabAdminUser(facility);

    // Step 3: Link the admin user to the facility
    await labFacilityRepository.linkAdminUser(facilityId, adminUser.id);

    // Step 4: Send welcome email with login credentials
    try {
      await sendLabFacilityApprovalEmail(facility, adminUser);
      await labFacilityRepository.markAdminInvitationSent(facilityId);
    } catch (emailError) {
      console.error("Failed to send admin welcome email:", emailError);
    }

    return this.getFacilityById(facilityId);
  }

  /**
   * Create lab admin user account after facility approval
   */
  async createLabAdminUser(facility) {
    // Generate temporary password
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Create user account
    const userData = {
      email: facility.adminEmail,
      fullName: facility.adminFullName,
      passwordHash,
      role: USER_ROLES.LAB_ADMIN,
      status: "active", // Lab admins are active immediately after facility approval
    };

    console.log("password :", tempPassword);
    console.log("email :", facility.adminEmail);

    const user = userRepository.create(userData);
    const savedUser = await userRepository.save(user);

    // Store temporary password for email (in a real app, you'd want to encrypt this)
    savedUser.tempPassword = tempPassword;

    return savedUser;
  }

  /**
   * Reject facility registration
   */
  async rejectFacility(facilityId, platformAdminId, reason) {
    const facility = await labFacilityRepository.findById(facilityId);
    if (!facility) {
      throw new Error("Facility not found");
    }

    if (facility.status !== "pending_approval") {
      throw new Error("Facility is not pending approval");
    }

    await labFacilityRepository.updateStatus(
      facilityId,
      "rejected",
      platformAdminId,
      reason
    );

    const rejectedFacility = await this.getFacilityById(facilityId);

    // Send rejection email
    try {
      await sendLabFacilityRejectionEmail(rejectedFacility, reason);
    } catch (emailError) {
      console.error("Failed to send rejection email:", emailError);
    }

    return rejectedFacility;
  }

  // Utility methods
  validateFacilityData(data) {
    const required = [
      "facilityName",
      "facilityType",
      "registrationNumber",
      "licenseNumber",
      "email",
      "phone",
      "address",
      "city",
      "state",
      "country",
      "postalCode",
      "adminFullName",
      "adminEmail",
    ];

    for (const field of required) {
      if (!data[field] || data[field].toString().trim() === "") {
        throw new Error(`${field} is required`);
      }
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error("Invalid facility email format");
    }
    if (!emailRegex.test(data.adminEmail)) {
      throw new Error("Invalid admin email format");
    }

    // Facility email and admin email should be different
    if (data.email === data.adminEmail) {
      throw new Error("Facility email and admin email must be different");
    }
  }

  async checkForDuplicates(data) {
    const [
      existingEmail,
      existingRegistration,
      existingLicense,
      existingAdminEmail,
    ] = await Promise.all([
      labFacilityRepository.findByEmail(data.email),
      labFacilityRepository.findByRegistrationNumber(data.registrationNumber),
      labFacilityRepository.findByLicenseNumber(data.licenseNumber),
      labFacilityRepository.findByAdminEmail(data.adminEmail),
    ]);

    if (existingEmail) {
      throw new Error("Facility email already registered");
    }
    if (existingRegistration) {
      throw new Error("Registration number already in use");
    }
    if (existingLicense) {
      throw new Error("License number already in use");
    }
    if (existingAdminEmail) {
      throw new Error("Admin email already registered with another facility");
    }
  }

  generateTempPassword() {
    // Generate a secure but user-friendly temporary password
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Read operations
  async getFacilityById(id) {
    const facility = await labFacilityRepository.findById(id);
    if (!facility) {
      throw new Error("Facility not found");
    }
    return facility;
  }

  async getFacilitiesByAdmin(adminUserId) {
    return labFacilityRepository.findByAdminUserId(adminUserId);
  }

  async getPendingFacilities() {
    return labFacilityRepository.findPendingApproval();
  }

  async searchFacilities(query) {
    if (!query || query.length < 2) {
      throw new Error("Search query must be at least 2 characters");
    }
    return labFacilityRepository.searchFacilities(query);
  }

  async getFacilitiesByLocation(city, state) {
    return labFacilityRepository.findByLocation(city, state);
  }

  // Update operations (for lab admins)
  async updateFacility(facilityId, updateData, requestingUserId) {
    const facility = await labFacilityRepository.findById(facilityId);
    if (!facility) {
      throw new Error("Facility not found");
    }

    // Only facility admin can update
    if (!facility.adminUser || facility.adminUser.id !== requestingUserId) {
      throw new Error("Only facility admin can update facility information");
    }

    // Prevent updating critical fields after approval
    if (facility.status === "approved" || facility.status === "active") {
      const restrictedFields = [
        "registrationNumber",
        "licenseNumber",
        "facilityType",
      ];
      const hasRestrictedUpdate = restrictedFields.some((field) =>
        updateData.hasOwnProperty.call(field)
      );

      if (hasRestrictedUpdate) {
        throw new Error(
          "Cannot update registration number, license number, or facility type after approval. Contact support for assistance."
        );
      }
    }

    // Update facility
    const updatedFacility = Object.assign(facility, updateData);
    return labFacilityRepository.save(updatedFacility);
  }

  // Statistics and reporting
  async getFacilityStats() {
    return labFacilityRepository.getStatusCounts();
  }

  async getRecentRegistrations(limit = 10) {
    return labFacilityRepository.findRecentRegistrations(limit);
  }

}

module.exports = new LabFacilityService();
