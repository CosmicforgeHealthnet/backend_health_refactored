// src/services/labPersonnelService.js
const labPersonnelRepository = require("../repositories/lab_personnel");
const labFacilityRepository = require("../repositories/lab_facility");
const userRepository = require("../../auth/repositories/userRepository");
const { USER_ROLES } = require("../../../shared/utils/constants");
const crypto = require("node:crypto");
const bcrypt = require('bcryptjs');
const { 
  sendLabPersonnelInvitationEmail,
  sendLabPersonnelWelcomeEmail,
  sendLabPersonnelStatusChangeEmail,
  sendLabPersonnelRoleChangeEmail
} = require("../../../shared/services/email/helper/lab");

class LabPersonnelService {
  
  /**
   * Invite personnel to join lab facility
   * This creates personnel record and sends registration invitation
   */
  async invitePersonnel(facilityId, personnelData, invitedByUserId) {
    // Validate facility exists and requesting user is authorized
    const facility = await labFacilityRepository.findById(facilityId);
    if (!facility) {
      throw new Error("Facility not found");
    }

    // Check authorization - only facility admin can invite personnel
    if (!facility.adminUser || facility.adminUser.id !== invitedByUserId) {
      throw new Error("Only facility admin can invite personnel");
    }

    // Validate personnel data
    this.validatePersonnelData(personnelData);

    // Check if email already exists in personnel or users table
    await this.checkForDuplicateEmail(personnelData.email);

    // Generate registration token and temporary password
    const registrationToken = crypto.randomBytes(32).toString('hex');
    const tempPassword = this.generateTempPassword();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // 7 days expiry

    // Create personnel record
    const personnel = labPersonnelRepository.create({
      ...personnelData,
      facility: { id: facilityId },
      invitedBy: { id: invitedByUserId },
      status: "pending_registration",
      userAccountCreated: false,
      firstLoginCompleted: false
    });

    const savedPersonnel = await labPersonnelRepository.save(personnel);

    // Update with registration details
    await labPersonnelRepository.markInvitationSent(
      savedPersonnel.id,
      registrationToken,
      tempPassword,
      tokenExpiresAt
    );

    // Send invitation email with registration details
    try {
      await this.sendPersonnelInvitationEmail(facility, savedPersonnel, tempPassword, registrationToken);
    } catch (emailError) {
      console.error("Failed to send personnel invitation email:", emailError);
      // Don't fail the invitation if email fails, but log it
    }

    return this.getPersonnelById(savedPersonnel.id);
  }

  /**
   * Complete personnel registration (called when they first log in)
   * This creates the user account and links it to personnel record
   */
  async completePersonnelRegistration(registrationToken, loginData) {
    // Find personnel by registration token
    const personnel = await labPersonnelRepository.findByRegistrationToken(registrationToken);
    if (!personnel) {
      throw new Error("Invalid registration token");
    }

    // Check if token is expired
    if (new Date() > personnel.tokenExpiresAt) {
      throw new Error("Registration token has expired");
    }

    // Validate login credentials match
    if (loginData.email !== personnel.email) {
      throw new Error("Email does not match registration");
    }

    // Check if user account already exists
    const existingUser = await userRepository.findByEmail(personnel.email);
    if (existingUser) {
      throw new Error("User account already exists. Please login instead.");
    }

    // Create user account
    const userRole = this.mapPersonnelRoleToUserRole(personnel.role);
    const passwordHash = await bcrypt.hash(loginData.password, 12);

    const userData = {
      email: personnel.email,
      fullName: personnel.fullName,
      passwordHash,
      role: userRole,
      status: 'active'
    };

    const user = userRepository.create(userData);
    const savedUser = await userRepository.save(user);

    // Complete personnel registration
    await labPersonnelRepository.completeRegistration(registrationToken, savedUser.id);

    // Send welcome email
    try {
      await this.sendPersonnelWelcomeEmail(personnel, savedUser);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    return {
      user: savedUser,
      personnel: await this.getPersonnelById(personnel.id)
    };
  }

  /**
   * Send personnel invitation email with registration instructions
   */
  async sendPersonnelInvitationEmail(facility, personnel, tempPassword, registrationToken) {
    const registrationUrl = `${process.env.APP_BASE_URL}/lab/personnel/register?token=${registrationToken}`;
    
    await sendLabPersonnelInvitationEmail({
      to: personnel.email,
      personnelName: personnel.fullName,
      facilityName: facility.facilityName,
      roleName: this.formatRoleName(personnel.role),
      invitedByName: facility.adminFullName,
      facilityAddress: `${facility.address}, ${facility.city}, ${facility.state}`,
      facilityPhone: facility.phone,
      
      // Registration details
      registrationUrl,
      loginEmail: personnel.email,
      tempPassword,
      tokenExpiresAt: personnel.tokenExpiresAt,
      
      // Platform URLs
      loginUrl: `${process.env.APP_BASE_URL}/login`,
      supportUrl: `${process.env.APP_BASE_URL}/support`
    });
  }

  /**
   * Send welcome email after successful registration
   */
  async sendPersonnelWelcomeEmail(personnel, user) {
    await sendLabPersonnelWelcomeEmail({
      to: user.email,
      personnelName: user.fullName,
      facilityName: personnel.facility.facilityName,
      roleName: this.formatRoleName(personnel.role),
      dashboardUrl: `${process.env.APP_BASE_URL}/lab/dashboard`,
      trainingUrl: `${process.env.APP_BASE_URL}/lab/training/${personnel.role}`,
      handbookUrl: `${process.env.APP_BASE_URL}/lab/handbook`,
      supportUrl: `${process.env.APP_BASE_URL}/support`
    });
  }

  // Read operations
  async getPersonnelById(id) {
    const personnel = await labPersonnelRepository.findById(id);
    if (!personnel) {
      throw new Error("Personnel not found");
    }
    return personnel;
  }

  async getFacilityPersonnel(facilityId, requestingUserId) {
    // Verify requesting user has access to this facility
    const facility = await labFacilityRepository.findById(facilityId);
    if (!facility) {
      throw new Error("Facility not found");
    }

    if (!facility.adminUser || facility.adminUser.id !== requestingUserId) {
      throw new Error("Access denied. Only facility admin can view personnel.");
    }

    return labPersonnelRepository.findByFacilityId(facilityId);
  }

  async getUserPersonnelRoles(userId) {
    return labPersonnelRepository.findByUserId(userId);
  }

  // Update operations
  async updatePersonnelStatus(personnelId, newStatus, requestingUserId) {
    const personnel = await labPersonnelRepository.findById(personnelId);
    if (!personnel) {
      throw new Error("Personnel not found");
    }

    // Check authorization
    if (!personnel.facility.adminUser || personnel.facility.adminUser.id !== requestingUserId) {
      throw new Error("Only facility admin can update personnel status");
    }

    const oldStatus = personnel.status;
    await labPersonnelRepository.updateStatus(personnelId, newStatus);
    
    const updatedPersonnel = await this.getPersonnelById(personnelId);
    
    // Send status change notification
    try {
      const updater = await userRepository.findById(requestingUserId);
      await this.sendStatusChangeNotification(personnel, oldStatus, newStatus, updater);
    } catch (emailError) {
      console.error("Failed to send status change email:", emailError);
    }
    
    return updatedPersonnel;
  }

  async updatePersonnelRole(personnelId, newRole, requestingUserId) {
    const personnel = await labPersonnelRepository.findById(personnelId);
    if (!personnel) {
      throw new Error("Personnel not found");
    }

    // Check authorization
    if (!personnel.facility.adminUser || personnel.facility.adminUser.id !== requestingUserId) {
      throw new Error("Only facility admin can update personnel roles");
    }

    // Validate new role
    const validRoles = ['lab_manager', 'sample_collector', 'lab_technician', 'radiologist', 'result_reviewer'];
    if (!validRoles.includes(newRole)) {
      throw new Error("Invalid personnel role");
    }

    const oldRole = personnel.role;
    await labPersonnelRepository.updateRole(personnelId, newRole);
    
    // Update user role if user account exists
    if (personnel.user) {
      const newUserRole = this.mapPersonnelRoleToUserRole(newRole);
      await userRepository.updateRole(personnel.user.id, newUserRole);
    }
    
    const updatedPersonnel = await this.getPersonnelById(personnelId);
    
    // Send role change notification
    try {
      const updater = await userRepository.findById(requestingUserId);
      await this.sendRoleChangeNotification(personnel, oldRole, newRole, updater);
    } catch (emailError) {
      console.error("Failed to send role change email:", emailError);
    }
    
    return updatedPersonnel;
  }

  async removePersonnel(personnelId, requestingUserId) {
    const personnel = await labPersonnelRepository.findById(personnelId);
    if (!personnel) {
      throw new Error("Personnel not found");
    }

    // Check authorization
    if (!personnel.facility.adminUser || personnel.facility.adminUser.id !== requestingUserId) {
      throw new Error("Only facility admin can remove personnel");
    }

    // Soft delete - change status to terminated
    await labPersonnelRepository.terminatePersonnel(personnelId);
    
    return { message: "Personnel removed successfully" };
  }

  // Utility methods
  validatePersonnelData(data) {
    const required = ['fullName', 'email', 'role'];

    for (const field of required) {
      if (!data[field] || data[field].toString().trim() === '') {
        throw new Error(`${field} is required`);
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('Invalid email format');
    }

    // Validate role
    const validRoles = ['lab_manager', 'sample_collector', 'lab_technician', 'radiologist', 'result_reviewer'];
    if (!validRoles.includes(data.role)) {
      throw new Error('Invalid personnel role');
    }
  }

  async checkForDuplicateEmail(email) {
    const [existingPersonnel, existingUser] = await Promise.all([
      labPersonnelRepository.findByEmail(email),
      userRepository.findByEmail(email)
    ]);

    if (existingPersonnel) {
      throw new Error("Personnel with this email already exists");
    }
    if (existingUser) {
      throw new Error("User with this email already exists");
    }
  }

  generateTempPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  mapPersonnelRoleToUserRole(personnelRole) {
    const roleMapping = {
      'lab_manager': USER_ROLES.LAB_MANAGER,
      'sample_collector': USER_ROLES.SAMPLE_COLLECTOR,
      'lab_technician': USER_ROLES.LAB_TECHNICIAN,
      'radiologist': USER_ROLES.RADIOLOGIST,
      'result_reviewer': USER_ROLES.RESULT_REVIEWER
    };
    return roleMapping[personnelRole] || USER_ROLES.LAB_TECHNICIAN;
  }

  formatRoleName(role) {
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  async sendStatusChangeNotification(personnel, oldStatus, newStatus, updater) {
    if (personnel.user) {
      await sendLabPersonnelStatusChangeEmail({
        to: personnel.email,
        personnelName: personnel.fullName,
        facilityName: personnel.facility.facilityName,
        oldStatus: this.formatRoleName(oldStatus),
        newStatus: this.formatRoleName(newStatus),
        updatedBy: updater.fullName,
        dashboardUrl: `${process.env.APP_BASE_URL}/lab/dashboard`,
        supportUrl: `${process.env.APP_BASE_URL}/support`
      });
    }
  }

  async sendRoleChangeNotification(personnel, oldRole, newRole, updater) {
    if (personnel.user) {
      await sendLabPersonnelRoleChangeEmail({
        to: personnel.email,
        personnelName: personnel.fullName,
        facilityName: personnel.facility.facilityName,
        oldRole: this.formatRoleName(oldRole),
        newRole: this.formatRoleName(newRole),
        updatedBy: updater.fullName,
        dashboardUrl: `${process.env.APP_BASE_URL}/lab/dashboard`,
        trainingUrl: `${process.env.APP_BASE_URL}/lab/training/${newRole}`,
        supportUrl: `${process.env.APP_BASE_URL}/support`
      });
    }
  }

  // Statistics
  async getPersonnelStats(facilityId) {
    return labPersonnelRepository.getPersonnelStatsByFacility(facilityId);
  }

  async findExpiredInvitations() {
    return labPersonnelRepository.findExpiredInvitations();
  }

  async findPendingInvitations(daysSince = 3) {
    return labPersonnelRepository.findPendingInvitations(daysSince);
  }
}

module.exports = new LabPersonnelService();