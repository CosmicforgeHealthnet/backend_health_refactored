// src/controllers/labPersonnelController.js
const labPersonnelService = require("../services/lab_personnel");
const { USER_ROLES } = require("../../../shared/utils/constants");

class LabPersonnelController {
  
  /**
   * Invite personnel to facility (lab admin only)
   * POST /api/lab/facilities/:facilityId/personnel/invite
   */
  async invitePersonnel(req, res, next) {
    try {
      const { facilityId } = req.params;
      const { sub: userId, role } = req.user;
      const personnelData = req.body;
      
      // Only lab admins can invite personnel
      // if (role !== USER_ROLES.LAB_ADMIN) {
      //   return res.status(403).json({
      //     success: false,
      //     error: "Access denied. Only lab administrators can invite personnel."
      //   });
      // }
      
      const personnel = await labPersonnelService.invitePersonnel(facilityId, personnelData, userId);
      
      return res.status(201).json({
        success: true,
        message: "Personnel invitation sent successfully. Registration instructions have been emailed.",
        data: {
          id: personnel.id,
          fullName: personnel.fullName,
          email: personnel.email, 
          role: personnel.role,
          status: personnel.status,
          invitationSentAt: personnel.invitationSentAt
        }
      });
    } catch (error) {
      if (error.message.includes("already exists") || error.message.includes("Unauthorized") || error.message.includes("not found") || error.message.includes("Invalid") || error.message.includes("required")) {
        const statusCode = error.message.includes("not found") ? 404 : 400;
        return res.status(statusCode).json({ 
          success: false, 
          error: error.message 
        });
      }
      next(error);
    }
  }

  /**
   * Complete personnel registration (public endpoint with token)
   * POST /api/lab/personnel/register
   */
  async completeRegistration(req, res, next) {
    try {
      const { registrationToken, email, password, confirmPassword } = req.body;
      
      // Validate required fields
      if (!registrationToken || !email || !password || !confirmPassword) {
        return res.status(400).json({
          success: false,
          error: "Registration token, email, password, and confirm password are required"
        });
      }

      // Validate password confirmation
      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: "Password and confirm password do not match"
        });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 8 characters long"
        });
      }
      
      const result = await labPersonnelService.completePersonnelRegistration(registrationToken, {
        email,
        password
      });
      
      return res.status(201).json({
        success: true,
        message: "Registration completed successfully. You can now login with your credentials.",
        data: {
          user: {
            id: result.user.id,
            fullName: result.user.fullName,
            email: result.user.email,
            role: result.user.role
          },
          personnel: {
            id: result.personnel.id,
            role: result.personnel.role,
            facilityName: result.personnel.facility.facilityName
          }
        }
      });
    } catch (error) {
      if (error.message.includes("Invalid") || error.message.includes("expired") || error.message.includes("already exists") || error.message.includes("does not match")) {
        return res.status(400).json({ 
          success: false, 
          error: error.message 
        });
      }
      next(error);
    }
  }

  /**
   * Get facility personnel (lab admin only)
   * GET /api/lab/facilities/:facilityId/personnel
   */
  async getFacilityPersonnel(req, res, next) {
    try {
      const { facilityId } = req.params;
      const { sub: userId, role } = req.user;
      
      // Only lab admins can view facility personnel
      // if (role !== USER_ROLES.LAB_ADMIN) {
      //   return res.status(403).json({
      //     success: false,
      //     error: "Access denied. Only lab administrators can view personnel."
      //   });
      // }
      
      const personnel = await labPersonnelService.getFacilityPersonnel(facilityId, userId);
      
      return res.json({
        success: true,
        data: personnel,
        count: personnel.length,
        message: "Facility personnel retrieved successfully"
      });
    } catch (error) {
      if (error.message.includes("not found") || error.message.includes("Access denied")) {
        const statusCode = error.message.includes("not found") ? 404 : 403;
        return res.status(statusCode).json({ 
          success: false, 
          error: error.message 
        });
      }
      next(error);
    }
  }

  /**
   * Get current user's personnel roles across all facilities
   * GET /api/lab/personnel/my/roles
   */
  async getMyPersonnelRoles(req, res, next) {
    try {
      const { sub: userId } = req.user;
      const roles = await labPersonnelService.getUserPersonnelRoles(userId);
      
      return res.json({
        success: true,
        data: roles,
        count: roles.length,
        message: "Your personnel roles retrieved successfully"
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific personnel details
   * GET /api/lab/personnel/:id
   */
  async getPersonnelById(req, res, next) {
    try {
      const { id } = req.params;
      const { role } = req.user;
      
      // Only lab admins can view personnel details
      // if (role !== USER_ROLES.LAB_ADMIN) {
      //   return res.status(403).json({
      //     success: false,
      //     error: "Access denied. Only lab administrators can view personnel details."
      //   });
      // }
      
      const personnel = await labPersonnelService.getPersonnelById(id);
      
      return res.json({
        success: true,
        data: personnel,
        message: "Personnel details retrieved successfully"
      });
    } catch (error) {
      if (error.message === "Personnel not found") {
        return res.status(404).json({ 
          success: false, 
          error: error.message 
        });
      }
      next(error);
    }
  }

  /**
   * Update personnel status (lab admin only)
   * PUT /api/lab/personnel/:id/status
   */
  async updatePersonnelStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const { sub: userId, role } = req.user;
      
      // Only lab admins can update personnel status
      if (role !== USER_ROLES.LAB_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Access denied. Only lab administrators can update personnel status."
        });
      }
      
      if (!status) {
        return res.status(400).json({ 
          success: false, 
          error: "Status is required" 
        });
      }

      // Validate status values
      const validStatuses = ['pending_registration', 'invitation_sent', 'registered', 'active', 'suspended', 'terminated'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Invalid status. Must be one of: " + validStatuses.join(', ')
        });
      }
      
      const personnel = await labPersonnelService.updatePersonnelStatus(id, status, userId);
      
      return res.json({
        success: true,
        data: personnel,
        message: "Personnel status updated successfully"
      });
    } catch (error) {
      if (error.message.includes("not found") || error.message.includes("Only facility admin")) {
        const statusCode = error.message.includes("not found") ? 404 : 403;
        return res.status(statusCode).json({ 
          success: false, 
          error: error.message 
        });
      }
      next(error);
    }
  }

  /**
   * Update personnel role (lab admin only)
   * PUT /api/lab/personnel/:id/role
   */
  async updatePersonnelRole(req, res, next) {
    try {
      const { id } = req.params;
      const { role: newRole } = req.body;
      const { sub: userId, role } = req.user;
      
      // Only lab admins can update personnel roles
      // if (role !== USER_ROLES.LAB_ADMIN) {
      //   return res.status(403).json({
      //     success: false,
      //     error: "Access denied. Only lab administrators can update personnel roles."
      //   });
      // }
      
      if (!newRole) {
        return res.status(400).json({ 
          success: false, 
          error: "Role is required" 
        });
      }

      // Validate role values
      const validRoles = ['lab_manager', 'sample_collector', 'lab_technician', 'radiologist', 'result_reviewer'];
      if (!validRoles.includes(newRole)) {
        return res.status(400).json({
          success: false,
          error: "Invalid role. Must be one of: " + validRoles.join(', ')
        });
      }
      
      const personnel = await labPersonnelService.updatePersonnelRole(id, newRole, userId);
      
      return res.json({
        success: true,
        data: personnel,
        message: "Personnel role updated successfully"
      });
    } catch (error) {
      if (error.message.includes("not found") || error.message.includes("Only facility admin")) {
        const statusCode = error.message.includes("not found") ? 404 : 403;
        return res.status(statusCode).json({ 
          success: false, 
          error: error.message 
        });
      }
      next(error);
    }
  }

  /**
   * Remove personnel from facility (lab admin only)
   * DELETE /api/lab/personnel/:id
   */
  async removePersonnel(req, res, next) {
    try {
      const { id } = req.params;
      const { sub: userId, role } = req.user;
      
      // Only lab admins can remove personnel
      // if (role !== USER_ROLES.LAB_ADMIN) {
      //   return res.status(403).json({
      //     success: false,
      //     error: "Access denied. Only lab administrators can remove personnel."
      //   });
      // }
      
      const result = await labPersonnelService.removePersonnel(id, userId);
      
      return res.json({
        success: true,
        data: result,
        message: "Personnel removed successfully"
      });
    } catch (error) {
      if (error.message.includes("not found") || error.message.includes("Only facility admin")) {
        const statusCode = error.message.includes("not found") ? 404 : 403;
        return res.status(statusCode).json({ 
          success: false, 
          error: error.message 
        });
      }
      next(error);
    }
  }

  /**
   * Get personnel statistics for facility (lab admin only)
   * GET /api/lab/facilities/:facilityId/personnel/stats
   */
  async getPersonnelStats(req, res, next) {
    try {
      const { facilityId } = req.params;
      const { role } = req.user;
      
      // Only lab admins can view personnel statistics
      // if (role !== USER_ROLES.LAB_ADMIN) {
      //   return res.status(403).json({
      //     success: false,
      //     error: "Access denied. Only lab administrators can view personnel statistics."
      //   });
      // }
      
      const stats = await labPersonnelService.getPersonnelStats(facilityId);
      
      return res.json({
        success: true,
        data: stats,
        message: "Personnel statistics retrieved successfully"
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get registration token info (for frontend registration form)
   * GET /api/lab/personnel/registration/:token
   */
  async getRegistrationTokenInfo(req, res, next) {
    try {
      const { token } = req.params;
      
      // This is a limited endpoint that only returns basic info for the registration form
      const personnel = await labPersonnelService.getPersonnelByToken(token);
      
      return res.json({
        success: true,
        data: {
          fullName: personnel.fullName,
          email: personnel.email,
          role: personnel.role,
          facilityName: personnel.facility.facilityName,
          isExpired: new Date() > personnel.tokenExpiresAt
        },
        message: "Registration token info retrieved successfully"
      });
    } catch (error) {
      if (error.message.includes("Invalid") || error.message.includes("not found")) {
        return res.status(404).json({ 
          success: false, 
          error: "Invalid or expired registration token" 
        });
      }
      next(error);
    }
  }
}

module.exports = new LabPersonnelController();