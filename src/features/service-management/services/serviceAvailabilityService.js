const serviceAvailabilityRepository = require("../repositories/serviceAvailabilityRepository");
const { ServiceStatus } = require("../entities/ServiceAvailability");
const { StatusChangeAction } = require("../entities/ServiceStatusHistory");
const serviceNotificationService = require("./serviceNotificationService");

class ServiceAvailabilityService {
  /**
   * Create a new service
   */
  async createService(data, adminId = null, ipAddress = null, userAgent = null) {
    // Check if service key already exists
    const exists = await serviceAvailabilityRepository.serviceKeyExists(data.serviceKey);
    if (exists) {
      throw new Error(`Service with key '${data.serviceKey}' already exists`);
    }

    const service = await serviceAvailabilityRepository.createService({
      ...data,
      status: ServiceStatus.ACTIVE,
      lastUpdatedBy: adminId,
    });

    // Create history entry for creation
    await serviceAvailabilityRepository.createHistoryEntry({
      serviceId: service.id,
      previousStatus: null,
      newStatus: ServiceStatus.ACTIVE,
      action: StatusChangeAction.CREATED,
      reason: "Service created",
      changedBy: adminId,
      ipAddress,
      userAgent,
    });

    return service;
  }

  /**
   * Get a service by ID with lazy reactivation check
   */
  async getServiceById(id) {
    const service = await serviceAvailabilityRepository.findById(id);
    if (!service) {
      throw new Error("Service not found");
    }

    // Lazy check: auto-reactivate if countdown has expired
    return await this._lazyReactivationCheck(service);
  }

  /**
   * Get a service by service key with lazy reactivation check
   */
  async getServiceByKey(serviceKey) {
    const service = await serviceAvailabilityRepository.findByServiceKey(serviceKey);
    if (!service) {
      throw new Error(`Service with key '${serviceKey}' not found`);
    }

    // Lazy check: auto-reactivate if countdown has expired
    return await this._lazyReactivationCheck(service);
  }

  /**
   * Get all services with lazy reactivation check
   */
  async getAllServices(includeDisabled = false) {
    const services = await serviceAvailabilityRepository.findAll(includeDisabled);

    // Perform lazy reactivation check on all services
    const checkedServices = await Promise.all(
      services.map(service => this._lazyReactivationCheck(service))
    );

    return checkedServices;
  }

  /**
   * Get services by status
   */
  async getServicesByStatus(status) {
    // First check for any expired countdowns
    await this._checkAllExpiredCountdowns();
    return await serviceAvailabilityRepository.findByStatus(status);
  }

  /**
   * Get services by category
   */
  async getServicesByCategory(category) {
    const services = await serviceAvailabilityRepository.findByCategory(category);

    // Perform lazy reactivation check
    return await Promise.all(
      services.map(service => this._lazyReactivationCheck(service))
    );
  }

  /**
   * Set service to DOWN with optional countdown
   */
  async setServiceDown(
    serviceId,
    countdownEnd = null,
    reason = null,
    downtimeMessage = null,
    showCountdown = true,
    adminId = null,
    ipAddress = null,
    userAgent = null,
    sendNotifications = true
  ) {
    const service = await serviceAvailabilityRepository.findById(serviceId);
    if (!service) {
      throw new Error("Service not found");
    }

    const previousStatus = service.status;
    const previousCountdownEnd = service.countdownEnd;

    // Update the service
    const updatedService = await serviceAvailabilityRepository.updateStatus(
      serviceId,
      ServiceStatus.DOWN,
      countdownEnd,
      {
        downtimeReason: reason,
        downtimeMessage,
        showCountdown,
        lastUpdatedBy: adminId,
      }
    );

    // Create history entry
    const historyEntry = await serviceAvailabilityRepository.createHistoryEntry({
      serviceId,
      previousStatus,
      newStatus: ServiceStatus.DOWN,
      action: StatusChangeAction.MANUAL_DOWN,
      previousCountdownEnd,
      newCountdownEnd: countdownEnd,
      reason,
      changedBy: adminId,
      ipAddress,
      userAgent,
      metadata: { downtimeMessage, showCountdown },
    });

    // Send notifications to all users
    if (sendNotifications) {
      this._sendDowntimeNotifications(updatedService, historyEntry.id);
    }

    return updatedService;
  }

  /**
   * Set service to ACTIVE (manual override)
   */
  async setServiceActive(
    serviceId,
    adminId = null,
    ipAddress = null,
    userAgent = null,
    sendNotifications = true
  ) {
    const service = await serviceAvailabilityRepository.findById(serviceId);
    if (!service) {
      throw new Error("Service not found");
    }

    if (service.status === ServiceStatus.ACTIVE) {
      return service; // Already active
    }

    const previousStatus = service.status;
    const previousCountdownEnd = service.countdownEnd;

    // Calculate downtime duration
    const downtimeDuration = await this._calculateDowntimeDuration(serviceId);

    // Update the service
    const updatedService = await serviceAvailabilityRepository.updateStatus(
      serviceId,
      ServiceStatus.ACTIVE,
      null, // Clear countdown
      {
        downtimeReason: null,
        downtimeMessage: null,
        lastUpdatedBy: adminId,
      }
    );

    // Create history entry
    const historyEntry = await serviceAvailabilityRepository.createHistoryEntry({
      serviceId,
      previousStatus,
      newStatus: ServiceStatus.ACTIVE,
      action: StatusChangeAction.OVERRIDE_ACTIVE,
      previousCountdownEnd,
      newCountdownEnd: null,
      reason: "Service manually reactivated by admin",
      changedBy: adminId,
      ipAddress,
      userAgent,
      downtimeDurationMinutes: downtimeDuration,
    });

    // Send notifications to all users
    if (sendNotifications) {
      this._sendReactivationNotifications(updatedService, historyEntry.id);
    }

    return updatedService;
  }

  /**
   * Extend the countdown for a downed service
   */
  async extendCountdown(
    serviceId,
    newCountdownEnd,
    reason = null,
    adminId = null,
    ipAddress = null,
    userAgent = null,
    sendNotifications = true
  ) {
    const service = await serviceAvailabilityRepository.findById(serviceId);
    if (!service) {
      throw new Error("Service not found");
    }

    if (service.status !== ServiceStatus.DOWN) {
      throw new Error("Can only extend countdown for services that are down");
    }

    const previousCountdownEnd = service.countdownEnd;

    // Validate that new countdown is actually later
    if (previousCountdownEnd && new Date(newCountdownEnd) <= new Date(previousCountdownEnd)) {
      throw new Error("New countdown end must be later than current countdown end. Use shortenCountdown to make it earlier.");
    }

    // Update the service
    const updatedService = await serviceAvailabilityRepository.updateStatus(
      serviceId,
      ServiceStatus.DOWN,
      newCountdownEnd,
      { lastUpdatedBy: adminId }
    );

    // Create history entry
    const historyEntry = await serviceAvailabilityRepository.createHistoryEntry({
      serviceId,
      previousStatus: ServiceStatus.DOWN,
      newStatus: ServiceStatus.DOWN,
      action: StatusChangeAction.COUNTDOWN_EXTENDED,
      previousCountdownEnd,
      newCountdownEnd,
      reason: reason || "Countdown extended",
      changedBy: adminId,
      ipAddress,
      userAgent,
    });

    // Send notifications about extended downtime
    if (sendNotifications) {
      this._sendCountdownExtendedNotifications(updatedService, previousCountdownEnd, historyEntry.id);
    }

    return updatedService;
  }

  /**
   * Shorten the countdown for a downed service
   */
  async shortenCountdown(
    serviceId,
    newCountdownEnd,
    reason = null,
    adminId = null,
    ipAddress = null,
    userAgent = null,
    sendNotifications = true
  ) {
    const service = await serviceAvailabilityRepository.findById(serviceId);
    if (!service) {
      throw new Error("Service not found");
    }

    if (service.status !== ServiceStatus.DOWN) {
      throw new Error("Can only shorten countdown for services that are down");
    }

    const previousCountdownEnd = service.countdownEnd;

    // Validate that new countdown is actually earlier
    if (previousCountdownEnd && new Date(newCountdownEnd) >= new Date(previousCountdownEnd)) {
      throw new Error("New countdown end must be earlier than current countdown end. Use extendCountdown to make it later.");
    }

    // Check if the new countdown is in the past (should immediately activate)
    if (new Date(newCountdownEnd) <= new Date()) {
      return await this.setServiceActive(serviceId, adminId, ipAddress, userAgent, sendNotifications);
    }

    // Update the service
    const updatedService = await serviceAvailabilityRepository.updateStatus(
      serviceId,
      ServiceStatus.DOWN,
      newCountdownEnd,
      { lastUpdatedBy: adminId }
    );

    // Create history entry
    await serviceAvailabilityRepository.createHistoryEntry({
      serviceId,
      previousStatus: ServiceStatus.DOWN,
      newStatus: ServiceStatus.DOWN,
      action: StatusChangeAction.COUNTDOWN_SHORTENED,
      previousCountdownEnd,
      newCountdownEnd,
      reason: reason || "Countdown shortened",
      changedBy: adminId,
      ipAddress,
      userAgent,
    });

    // Optionally send notification about shortened downtime (good news!)
    if (sendNotifications) {
      this._sendCountdownShortenedNotifications(updatedService, previousCountdownEnd);
    }

    return updatedService;
  }

  /**
   * Update service details (not status)
   */
  async updateService(serviceId, data, adminId = null) {
    const service = await serviceAvailabilityRepository.findById(serviceId);
    if (!service) {
      throw new Error("Service not found");
    }

    // If changing service key, check it doesn't already exist
    if (data.serviceKey && data.serviceKey !== service.serviceKey) {
      const exists = await serviceAvailabilityRepository.serviceKeyExists(data.serviceKey, serviceId);
      if (exists) {
        throw new Error(`Service with key '${data.serviceKey}' already exists`);
      }
    }

    // Don't allow status changes through this method
    delete data.status;
    delete data.countdownEnd;

    return await serviceAvailabilityRepository.updateService(serviceId, {
      ...data,
      lastUpdatedBy: adminId,
    });
  }

  /**
   * Soft delete a service
   */
  async deleteService(serviceId, adminId = null) {
    const service = await serviceAvailabilityRepository.findById(serviceId);
    if (!service) {
      throw new Error("Service not found");
    }

    await serviceAvailabilityRepository.softDelete(serviceId);
    return { message: "Service deleted successfully" };
  }

  /**
   * Get status history for a service
   */
  async getServiceHistory(serviceId, limit = 50, skip = 0) {
    return await serviceAvailabilityRepository.getServiceHistory(serviceId, limit, skip);
  }

  /**
   * Get all status history (admin dashboard)
   */
  async getAllHistory(limit = 100, skip = 0) {
    return await serviceAvailabilityRepository.getAllHistory(limit, skip);
  }

  /**
   * Get downtime statistics for a service
   */
  async getDowntimeStats(serviceId, startDate = null, endDate = null) {
    return await serviceAvailabilityRepository.getDowntimeStats(serviceId, startDate, endDate);
  }

  /**
   * Check service availability (simple boolean check)
   */
  async isServiceAvailable(serviceKey) {
    try {
      const service = await this.getServiceByKey(serviceKey);
      return service.status === ServiceStatus.ACTIVE && service.isEnabled;
    } catch (error) {
      // If service doesn't exist, consider it available (no restrictions)
      return true;
    }
  }

  /**
   * Get public service status (for frontend)
   */
  async getPublicServiceStatus(serviceKey) {
    try {
      const service = await this.getServiceByKey(serviceKey);

      return {
        serviceKey: service.serviceKey,
        name: service.name,
        status: service.status,
        isAvailable: service.status === ServiceStatus.ACTIVE && service.isEnabled,
        countdownEnd: service.status === ServiceStatus.DOWN && service.showCountdown
          ? service.countdownEnd
          : null,
        downtimeMessage: service.status === ServiceStatus.DOWN
          ? service.downtimeMessage
          : null,
        showCountdown: service.showCountdown,
      };
    } catch (error) {
      return {
        serviceKey,
        name: serviceKey,
        status: ServiceStatus.ACTIVE,
        isAvailable: true,
        countdownEnd: null,
        downtimeMessage: null,
        showCountdown: false,
      };
    }
  }

  /**
   * Bulk check multiple services
   */
  async getMultipleServiceStatuses(serviceKeys) {
    const statuses = await Promise.all(
      serviceKeys.map(key => this.getPublicServiceStatus(key))
    );

    return statuses.reduce((acc, status) => {
      acc[status.serviceKey] = status;
      return acc;
    }, {});
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Lazy reactivation check - auto-reactivate if countdown has expired
   */
  async _lazyReactivationCheck(service) {
    if (
      service.status === ServiceStatus.DOWN &&
      service.countdownEnd &&
      new Date() >= new Date(service.countdownEnd)
    ) {
      // Auto-reactivate the service
      const downtimeDuration = await this._calculateDowntimeDuration(service.id);

      const updatedService = await serviceAvailabilityRepository.updateStatus(
        service.id,
        ServiceStatus.ACTIVE,
        null,
        {
          downtimeReason: null,
          downtimeMessage: null,
        }
      );

      // Create history entry for auto-reactivation
      const historyEntry = await serviceAvailabilityRepository.createHistoryEntry({
        serviceId: service.id,
        previousStatus: ServiceStatus.DOWN,
        newStatus: ServiceStatus.ACTIVE,
        action: StatusChangeAction.AUTO_REACTIVATED,
        previousCountdownEnd: service.countdownEnd,
        newCountdownEnd: null,
        reason: "Service automatically reactivated after countdown expired",
        changedBy: null, // System action
        downtimeDurationMinutes: downtimeDuration,
      });

      // Send notifications about service being back
      this._sendReactivationNotifications(updatedService, historyEntry.id);

      return updatedService;
    }

    return service;
  }

  /**
   * Check all services with expired countdowns
   */
  async _checkAllExpiredCountdowns() {
    const expiredServices = await serviceAvailabilityRepository.findExpiredCountdowns();

    for (const service of expiredServices) {
      await this._lazyReactivationCheck(service);
    }
  }

  /**
   * Calculate downtime duration in minutes
   */
  async _calculateDowntimeDuration(serviceId) {
    const lastDownEntry = await serviceAvailabilityRepository.getLastDowntimeEntry(serviceId);

    if (!lastDownEntry) {
      return null;
    }

    const downSince = new Date(lastDownEntry.createdAt);
    const now = new Date();
    const durationMs = now - downSince;
    const durationMinutes = Math.round(durationMs / 60000);

    return durationMinutes;
  }

  /**
   * Send notifications when service goes down
   */
  async _sendDowntimeNotifications(service, historyId) {
    try {
      const notificationCount = await serviceNotificationService.notifyServiceDown(
        service,
        service.countdownEnd,
        service.downtimeMessage
      );

      // Update history with notification count
      await serviceAvailabilityRepository.updateHistoryEntry(historyId, {
        notificationsSent: true,
        notificationCount,
      });
    } catch (error) {
      console.error("Failed to send downtime notifications:", error);
    }
  }

  /**
   * Send notifications when service is reactivated
   */
  async _sendReactivationNotifications(service, historyId) {
    try {
      const notificationCount = await serviceNotificationService.notifyServiceBack(service);

      // Update history with notification count
      await serviceAvailabilityRepository.updateHistoryEntry(historyId, {
        notificationsSent: true,
        notificationCount,
      });
    } catch (error) {
      console.error("Failed to send reactivation notifications:", error);
    }
  }

  /**
   * Send notifications when countdown is extended
   */
  async _sendCountdownExtendedNotifications(service, previousCountdownEnd, historyId) {
    try {
      const notificationCount = await serviceNotificationService.notifyCountdownExtended(
        service,
        previousCountdownEnd,
        service.countdownEnd
      );

      // Update history with notification count
      await serviceAvailabilityRepository.updateHistoryEntry(historyId, {
        notificationsSent: true,
        notificationCount,
      });
    } catch (error) {
      console.error("Failed to send countdown extended notifications:", error);
    }
  }

  /**
   * Send notifications when countdown is shortened (good news)
   */
  async _sendCountdownShortenedNotifications(service, previousCountdownEnd) {
    try {
      await serviceNotificationService.notifyCountdownShortened(
        service,
        previousCountdownEnd,
        service.countdownEnd
      );
    } catch (error) {
      console.error("Failed to send countdown shortened notifications:", error);
    }
  }
}

module.exports = new ServiceAvailabilityService();
