const AppDataSource = require("../../../config/database");
const ServiceAvailability = require("../entities/ServiceAvailability");
const ServiceStatusHistory = require("../entities/ServiceStatusHistory");
const { ServiceStatus } = require("../entities/ServiceAvailability");
const { LessThanOrEqual, IsNull, Not } = require("typeorm");

class ServiceAvailabilityRepository {
  constructor() {
    this.serviceRepository = AppDataSource.getRepository(ServiceAvailability);
    this.historyRepository = AppDataSource.getRepository(ServiceStatusHistory);
  }

  /**
   * Create a new service
   */
  async createService(data) {
    const service = this.serviceRepository.create(data);
    return await this.serviceRepository.save(service);
  }

  /**
   * Find service by ID
   */
  async findById(id) {
    return await this.serviceRepository.findOne({
      where: { id, isDeleted: false },
      relations: ["updatedByUser"],
    });
  }

  /**
   * Find service by service key
   */
  async findByServiceKey(serviceKey) {
    return await this.serviceRepository.findOne({
      where: { serviceKey, isDeleted: false },
    });
  }

  /**
   * Get all services
   */
  async findAll(includeDisabled = false) {
    const where = { isDeleted: false };
    if (!includeDisabled) {
      where.isEnabled = true;
    }

    return await this.serviceRepository.find({
      where,
      order: { displayOrder: "ASC", name: "ASC" },
      relations: ["updatedByUser"],
    });
  }

  /**
   * Get services by status
   */
  async findByStatus(status) {
    return await this.serviceRepository.find({
      where: { status, isDeleted: false, isEnabled: true },
      order: { displayOrder: "ASC", name: "ASC" },
    });
  }

  /**
   * Get services by category
   */
  async findByCategory(category) {
    return await this.serviceRepository.find({
      where: { category, isDeleted: false, isEnabled: true },
      order: { displayOrder: "ASC", name: "ASC" },
    });
  }

  /**
   * Find services with expired countdowns (for lazy reactivation)
   */
  async findExpiredCountdowns() {
    const now = new Date();
    return await this.serviceRepository.find({
      where: {
        status: ServiceStatus.DOWN,
        countdownEnd: LessThanOrEqual(now),
        isDeleted: false,
      },
    });
  }

  /**
   * Update service
   */
  async updateService(id, data) {
    await this.serviceRepository.update(id, {
      ...data,
      updatedAt: new Date(),
    });
    return await this.findById(id);
  }

  /**
   * Update service status
   */
  async updateStatus(id, status, countdownEnd = null, additionalData = {}) {
    const updateData = {
      status,
      countdownEnd,
      updatedAt: new Date(),
      ...additionalData,
    };

    await this.serviceRepository.update(id, updateData);
    return await this.findById(id);
  }

  /**
   * Soft delete service
   */
  async softDelete(id) {
    await this.serviceRepository.update(id, {
      isDeleted: true,
      updatedAt: new Date(),
    });
  }

  /**
   * Create status history entry
   */
  async createHistoryEntry(data) {
    const history = this.historyRepository.create(data);
    return await this.historyRepository.save(history);
  }

  /**
   * Get status history for a service
   */
  async getServiceHistory(serviceId, limit = 50, skip = 0) {
    return await this.historyRepository.find({
      where: { serviceId },
      order: { createdAt: "DESC" },
      take: limit,
      skip,
      relations: ["changedByUser"],
    });
  }

  /**
   * Get all status history (for admin dashboard)
   */
  async getAllHistory(limit = 100, skip = 0) {
    return await this.historyRepository.find({
      order: { createdAt: "DESC" },
      take: limit,
      skip,
      relations: ["service", "changedByUser"],
    });
  }

  /**
   * Update history entry (for notification counts)
   */
  async updateHistoryEntry(id, data) {
    await this.historyRepository.update(id, data);
    return await this.historyRepository.findOne({ where: { id } });
  }

  /**
   * Get downtime statistics for a service
   */
  async getDowntimeStats(serviceId, startDate = null, endDate = null) {
    const queryBuilder = this.historyRepository
      .createQueryBuilder("history")
      .select("COUNT(*)", "totalIncidents")
      .addSelect("SUM(history.downtimeDurationMinutes)", "totalDowntimeMinutes")
      .addSelect("AVG(history.downtimeDurationMinutes)", "avgDowntimeMinutes")
      .where("history.serviceId = :serviceId", { serviceId })
      .andWhere("history.newStatus = :status", { status: ServiceStatus.ACTIVE });

    if (startDate) {
      queryBuilder.andWhere("history.createdAt >= :startDate", { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere("history.createdAt <= :endDate", { endDate });
    }

    return await queryBuilder.getRawOne();
  }

  /**
   * Get the last downtime entry for a service (to calculate duration)
   */
  async getLastDowntimeEntry(serviceId) {
    return await this.historyRepository.findOne({
      where: {
        serviceId,
        newStatus: ServiceStatus.DOWN,
      },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Check if service key exists
   */
  async serviceKeyExists(serviceKey, excludeId = null) {
    const where = { serviceKey, isDeleted: false };
    if (excludeId) {
      where.id = Not(excludeId);
    }
    const existing = await this.serviceRepository.findOne({ where });
    return !!existing;
  }
}

module.exports = new ServiceAvailabilityRepository();
