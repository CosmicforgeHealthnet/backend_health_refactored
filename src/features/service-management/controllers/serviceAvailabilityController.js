const serviceAvailabilityService = require("../services/serviceAvailabilityService");
const { ServiceStatus } = require("../entities/ServiceAvailability");

/**
 * Service Availability Controller
 * Handles HTTP requests for service availability management
 */
class ServiceAvailabilityController {
  // ==================== PUBLIC ENDPOINTS ====================

  /**
   * Get all services (public)
   * GET /api/services
   */
  async getAllServices(req, res, next) {
    try {
      const services = await serviceAvailabilityService.getAllServices(false);

      return res.status(200).json({
        success: true,
        message: "Services retrieved successfully",
        data: services.map((service) => ({
          id: service.id,
          serviceKey: service.serviceKey,
          name: service.name,
          description: service.description,
          status: service.status,
          isAvailable: service.status === ServiceStatus.ACTIVE && service.isEnabled,
          countdownEnd: service.showCountdown ? service.countdownEnd : null,
          downtimeMessage: service.status === ServiceStatus.DOWN ? service.downtimeMessage : null,
          category: service.category,
          iconUrl: service.iconUrl,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single service status (public)
   * GET /api/services/:serviceKey/status
   */
  async getServiceStatus(req, res, next) {
    try {
      const { serviceKey } = req.params;
      const status = await serviceAvailabilityService.getPublicServiceStatus(serviceKey);

      return res.status(200).json({
        success: true,
        message: "Service status retrieved successfully",
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check multiple service statuses (public)
   * POST /api/services/status/bulk
   */
  async getBulkServiceStatus(req, res, next) {
    try {
      const { serviceKeys } = req.body;

      if (!Array.isArray(serviceKeys) || serviceKeys.length === 0) {
        return res.status(400).json({
          success: false,
          message: "serviceKeys must be a non-empty array",
        });
      }

      const statuses = await serviceAvailabilityService.getMultipleServiceStatuses(serviceKeys);

      return res.status(200).json({
        success: true,
        message: "Service statuses retrieved successfully",
        data: statuses,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check if a service is available (public)
   * GET /api/services/:serviceKey/available
   */
  async checkServiceAvailability(req, res, next) {
    try {
      const { serviceKey } = req.params;
      const isAvailable = await serviceAvailabilityService.isServiceAvailable(serviceKey);

      return res.status(200).json({
        success: true,
        data: {
          serviceKey,
          isAvailable,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Get all services (admin - includes disabled)
   * GET /api/admin/services
   */
  async adminGetAllServices(req, res, next) {
    try {
      const includeDisabled = req.query.includeDisabled === "true";
      const services = await serviceAvailabilityService.getAllServices(includeDisabled);

      return res.status(200).json({
        success: true,
        message: "Services retrieved successfully",
        data: services,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single service by ID (admin)
   * GET /api/admin/services/:id
   */
  async adminGetService(req, res, next) {
    try {
      const { id } = req.params;
      const service = await serviceAvailabilityService.getServiceById(id);

      return res.status(200).json({
        success: true,
        message: "Service retrieved successfully",
        data: service,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new service (admin)
   * POST /api/admin/services
   */
  async createService(req, res, next) {
    try {
      const {
        serviceKey,
        name,
        description,
        category,
        iconUrl,
        displayOrder,
        isEnabled,
      } = req.body;

      // Validation
      if (!serviceKey || !name) {
        return res.status(400).json({
          success: false,
          message: "serviceKey and name are required",
        });
      }

      const adminId = req.user?.id;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.get("User-Agent");

      const service = await serviceAvailabilityService.createService(
        {
          serviceKey: serviceKey.toLowerCase().replace(/\s+/g, "_"),
          name,
          description,
          category,
          iconUrl,
          displayOrder: displayOrder || 0,
          isEnabled: isEnabled !== false,
        },
        adminId,
        ipAddress,
        userAgent
      );

      return res.status(201).json({
        success: true,
        message: "Service created successfully",
        data: service,
      });
    } catch (error) {
      if (error.message.includes("already exists")) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * Update service details (admin)
   * PUT /api/admin/services/:id
   */
  async updateService(req, res, next) {
    try {
      const { id } = req.params;
      const {
        serviceKey,
        name,
        description,
        category,
        iconUrl,
        displayOrder,
        isEnabled,
      } = req.body;

      const adminId = req.user?.id;

      const service = await serviceAvailabilityService.updateService(
        id,
        {
          serviceKey: serviceKey?.toLowerCase().replace(/\s+/g, "_"),
          name,
          description,
          category,
          iconUrl,
          displayOrder,
          isEnabled,
        },
        adminId
      );

      return res.status(200).json({
        success: true,
        message: "Service updated successfully",
        data: service,
      });
    } catch (error) {
      if (error.message.includes("already exists")) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * Set service to DOWN (admin)
   * POST /api/admin/services/:id/down
   */
  async setServiceDown(req, res, next) {
    try {
      const { id } = req.params;
      const {
        countdownEnd,
        reason,
        downtimeMessage,
        showCountdown,
        sendNotifications,
      } = req.body;

      const adminId = req.user?.id;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.get("User-Agent");

      // Validate countdownEnd if provided
      if (countdownEnd && new Date(countdownEnd) <= new Date()) {
        return res.status(400).json({
          success: false,
          message: "countdownEnd must be in the future",
        });
      }

      const service = await serviceAvailabilityService.setServiceDown(
        id,
        countdownEnd || null,
        reason,
        downtimeMessage,
        showCountdown !== false,
        adminId,
        ipAddress,
        userAgent,
        sendNotifications !== false
      );

      return res.status(200).json({
        success: true,
        message: "Service set to down successfully",
        data: service,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Set service to ACTIVE (admin override)
   * POST /api/admin/services/:id/active
   */
  async setServiceActive(req, res, next) {
    try {
      const { id } = req.params;
      const { sendNotifications } = req.body;

      const adminId = req.user?.id;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.get("User-Agent");

      const service = await serviceAvailabilityService.setServiceActive(
        id,
        adminId,
        ipAddress,
        userAgent,
        sendNotifications !== false
      );

      return res.status(200).json({
        success: true,
        message: "Service set to active successfully",
        data: service,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Extend countdown (admin)
   * POST /api/admin/services/:id/extend-countdown
   */
  async extendCountdown(req, res, next) {
    try {
      const { id } = req.params;
      const { newCountdownEnd, reason, sendNotifications } = req.body;

      if (!newCountdownEnd) {
        return res.status(400).json({
          success: false,
          message: "newCountdownEnd is required",
        });
      }

      if (new Date(newCountdownEnd) <= new Date()) {
        return res.status(400).json({
          success: false,
          message: "newCountdownEnd must be in the future",
        });
      }

      const adminId = req.user?.id;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.get("User-Agent");

      const service = await serviceAvailabilityService.extendCountdown(
        id,
        newCountdownEnd,
        reason,
        adminId,
        ipAddress,
        userAgent,
        sendNotifications !== false
      );

      return res.status(200).json({
        success: true,
        message: "Countdown extended successfully",
        data: service,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Shorten countdown (admin)
   * POST /api/admin/services/:id/shorten-countdown
   */
  async shortenCountdown(req, res, next) {
    try {
      const { id } = req.params;
      const { newCountdownEnd, reason, sendNotifications } = req.body;

      if (!newCountdownEnd) {
        return res.status(400).json({
          success: false,
          message: "newCountdownEnd is required",
        });
      }

      const adminId = req.user?.id;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.get("User-Agent");

      const service = await serviceAvailabilityService.shortenCountdown(
        id,
        newCountdownEnd,
        reason,
        adminId,
        ipAddress,
        userAgent,
        sendNotifications !== false
      );

      return res.status(200).json({
        success: true,
        message: "Countdown shortened successfully",
        data: service,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete service (admin - soft delete)
   * DELETE /api/admin/services/:id
   */
  async deleteService(req, res, next) {
    try {
      const { id } = req.params;
      const adminId = req.user?.id;

      const result = await serviceAvailabilityService.deleteService(id, adminId);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get service status history (admin)
   * GET /api/admin/services/:id/history
   */
  async getServiceHistory(req, res, next) {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      const skip = parseInt(req.query.skip) || 0;

      const history = await serviceAvailabilityService.getServiceHistory(id, limit, skip);

      return res.status(200).json({
        success: true,
        message: "Service history retrieved successfully",
        data: history,
        pagination: { limit, skip },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all status history (admin dashboard)
   * GET /api/admin/services/history/all
   */
  async getAllHistory(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const skip = parseInt(req.query.skip) || 0;

      const history = await serviceAvailabilityService.getAllHistory(limit, skip);

      return res.status(200).json({
        success: true,
        message: "All history retrieved successfully",
        data: history,
        pagination: { limit, skip },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get downtime statistics (admin)
   * GET /api/admin/services/:id/stats
   */
  async getDowntimeStats(req, res, next) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const stats = await serviceAvailabilityService.getDowntimeStats(
        id,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null
      );

      return res.status(200).json({
        success: true,
        message: "Downtime statistics retrieved successfully",
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ServiceAvailabilityController();
