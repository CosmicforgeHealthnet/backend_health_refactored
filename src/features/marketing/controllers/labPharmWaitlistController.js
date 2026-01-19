// src/controllers/labWaitlistController.js
const labWaitlistService = require('../services/labPharmWaitlistService');
const { USER_ROLES } = require("../../../shared/utils/constants");

class LabWaitlistController {
  /**
   * Join the lab registration waitlist (public endpoint - no auth required)
   * POST /api/lab/waitlist/join
   */
  async joinWaitlist(req, res, next) {
    try {
      const waitlistData = req.body;

      const waitlistEntry = await labWaitlistService.joinWaitlist(waitlistData);

      return res.status(201).json({
        success: true,
        message: "Successfully joined the lab registration waitlist. You'll be notified when registration opens!",
        data: {
          id: waitlistEntry.id,
          fullName: waitlistEntry.fullName,
          email: waitlistEntry.email,
          facilityName: waitlistEntry.facilityName,
          status: waitlistEntry.status,
          role: waitlistEntry.role,
          joinedAt: waitlistEntry.createdAt
        },
      });
    } catch (error) {
      if (
        error.message.includes("already") ||
        error.message.includes("required") ||
        error.message.includes("Invalid") ||
        error.message.includes("must be")
      ) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * Check if email exists in waitlist (public endpoint)
   * GET /api/lab/waitlist/check?email=example@email.com
   */
  async checkEmailExists(req, res, next) {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: "Email parameter is required",
        });
      }

      const exists = await labWaitlistService.checkEmailExists(email);

      return res.json({
        success: true,
        data: {
          exists,
          email,
        },
        message: exists
          ? "Email is already in the waitlist"
          : "Email is not in the waitlist",
      });
    } catch (error) {
      next(error);
    }
  }

  // ============== ADMIN ENDPOINTS ==============

  /**
   * Get all waitlist entries (admin only)
   * GET /api/lab/admin/waitlist?status=pending&limit=50&offset=0
   */
  async getAllWaitlistEntries(req, res, next) {
    try {
      const { role } = req.user;

      // Only platform admins can view waitlist
      if (role !== USER_ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Access denied. Platform administrator privileges required.",
        });
      }

      const { status, limit, offset } = req.query;
      const options = {};

      if (status) options.status = status;
      if (limit) options.limit = parseInt(limit);
      if (offset) options.offset = parseInt(offset);

      const entries = await labWaitlistService.getAllWaitlistEntries(options);

      return res.json({
        success: true,
        data: entries,
        count: entries.length,
        message: "Waitlist entries retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search waitlist entries (admin only)
   * GET /api/lab/admin/waitlist/search?q=searchterm
   */
  async searchWaitlist(req, res, next) {
    try {
      const { role } = req.user;

      if (role !== USER_ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Access denied. Platform administrator privileges required.",
        });
      }

      const { q } = req.query;
      if (!q) {
        return res.status(400).json({
          success: false,
          error: "Search query parameter 'q' is required",
        });
      }

      const entries = await labWaitlistService.searchWaitlist(q);

      return res.json({
        success: true,
        data: entries,
        count: entries.length,
        message: "Search results retrieved successfully",
      });
    } catch (error) {
      if (error.message.includes("characters")) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * Get waitlist entry by ID (admin only)
   * GET /api/lab/admin/waitlist/:id
   */
  async getWaitlistEntryById(req, res, next) {
    try {
      const { role } = req.user;

      if (role !== USER_ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Access denied. Platform administrator privileges required.",
        });
      }

      const { id } = req.params;
      const entry = await labWaitlistService.getWaitlistEntryById(id);

      return res.json({
        success: true,
        data: entry,
        message: "Waitlist entry retrieved successfully",
      });
    } catch (error) {
      if (error.message === "Waitlist entry not found") {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * Update waitlist entry status (admin only)
   * PUT /api/lab/admin/waitlist/:id/status
   */
  async updateWaitlistStatus(req, res, next) {
    try {
      const { role } = req.user;

      if (role !== USER_ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Access denied. Platform administrator privileges required.",
        });
      }

      const { id } = req.params;
      const { status, adminNotes } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: "Status is required",
        });
      }

      const updatedEntry = await labWaitlistService.updateWaitlistStatus(
        id,
        status,
        adminNotes
      );

      return res.json({
        success: true,
        data: updatedEntry,
        message: "Waitlist entry status updated successfully",
      });
    } catch (error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("Invalid status")
      ) {
        const statusCode = error.message === "Waitlist entry not found" ? 404 : 400;
        return res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * Send launch notification to all pending entries (admin only)
   * POST /api/lab/admin/waitlist/send-launch-notifications
   */
  async sendLaunchNotifications(req, res, next) {
    try {
      const { role } = req.user;

      if (role !== USER_ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Access denied. Platform administrator privileges required.",
        });
      }

      const results = await labWaitlistService.sendLaunchNotifications();

      return res.json({
        success: true,
        data: results,
        message: `Launch notifications sent. ${results.successful} successful, ${results.failed} failed.`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send launch notification to specific entry (admin only)
   * POST /api/lab/admin/waitlist/:id/send-launch-notification
   */
  async sendLaunchNotificationToEntry(req, res, next) {
    try {
      const { role } = req.user;

      if (role !== USER_ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Access denied. Platform administrator privileges required.",
        });
      }

      const { id } = req.params;
      const updatedEntry = await labWaitlistService.sendLaunchNotificationToEntry(id);

      return res.json({
        success: true,
        data: updatedEntry,
        message: "Launch notification sent successfully",
      });
    } catch (error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("already sent")
      ) {
        const statusCode = error.message === "Waitlist entry not found" ? 404 : 400;
        return res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * Get waitlist statistics (admin only)
   * GET /api/lab/admin/waitlist/stats
   */
  async getWaitlistStats(req, res, next) {
    try {
      const { role } = req.user;

      if (role !== USER_ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Access denied. Platform administrator privileges required.",
        });
      }

      const stats = await labWaitlistService.getWaitlistStats();

      return res.json({
        success: true,
        data: stats,
        message: "Waitlist statistics retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get waitlist entries by location (admin only)
   * GET /api/lab/admin/waitlist/location?city=CityName&state=StateName
   */
  async getWaitlistByLocation(req, res, next) {
    try {
      const { role } = req.user;

      if (role !== USER_ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Access denied. Platform administrator privileges required.",
        });
      }

      const { city, state } = req.query;

      const entries = await labWaitlistService.getWaitlistByLocation(city, state);

      return res.json({
        success: true,
        data: entries,
        count: entries.length,
        message: "Waitlist entries by location retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent waitlist registrations (admin only)
   * GET /api/lab/admin/waitlist/recent?limit=10
   */
  async getRecentRegistrations(req, res, next) {
    try {
      const { role } = req.user;

      if (role !== USER_ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Access denied. Platform administrator privileges required.",
        });
      }

      const limit = parseInt(req.query.limit) || 10;
      if (limit > 50) {
        return res.status(400).json({
          success: false,
          error: "Limit cannot exceed 50",
        });
      }

      const entries = await labWaitlistService.getRecentRegistrations(limit);

      return res.json({
        success: true,
        data: entries,
        count: entries.length,
        message: "Recent waitlist registrations retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cleanup old waitlist entries (admin only)
   * DELETE /api/lab/admin/waitlist/cleanup?olderThanDays=365
   */
  async cleanupOldEntries(req, res, next) {
    try {
      const { role } = req.user;

      if (role !== USER_ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          error: "Access denied. Platform administrator privileges required.",
        });
      }

      const olderThanDays = parseInt(req.query.olderThanDays) || 365;
      const result = await labWaitlistService.cleanupOldEntries(olderThanDays);

      return res.json({
        success: true,
        data: {
          deletedCount: result.affected || 0,
          olderThanDays,
        },
        message: `Cleanup completed. ${result.affected || 0} old entries removed.`,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LabWaitlistController();