// src/repositories/labOrderRepository.js
const AppDataSource = require("../../../config/database");
const LabOrder = require("../entities/lab_order");

class LabOrderRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(LabOrder);
  }

  // Basic CRUD operations
  create(data) {
    return this.repo.create(data);
  }

  save(order) {
    return this.repo.save(order);
  }

  findById(id) {
    return this.repo.findOne({ 
      where: { id },
      relations: [
        "patient", 
        "facility", 
        "assignedPersonnel", 
        "assignedPersonnel.user",
        "reviewer",
        "reviewer.user", 
        "orderItems"
      ]
    });
  }

  // Generate unique order number
  async generateOrderNumber() {
    const year = new Date().getFullYear();
    const count = await this.repo.count({
      where: {
        orderNumber: { $like: `ORD-${year}-%` }
      }
    });
    const nextNumber = (count + 1).toString().padStart(6, '0');
    return `ORD-${year}-${nextNumber}`;
  }

  // Find orders by patient
  findByPatientId(patientId, limit = 20, offset = 0) {
    return this.repo.find({
      where: { patientId },
      relations: ["facility", "orderItems", "assignedPersonnel", "assignedPersonnel.user"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset
    });
  }

  // Find orders by facility
  findByFacilityId(facilityId, limit = 50, offset = 0) {
    return this.repo.find({
      where: { facilityId },
      relations: ["patient", "orderItems", "assignedPersonnel", "assignedPersonnel.user"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset
    });
  }

  // Find orders by status
  findByStatus(status, facilityId = null) {
    const where = { status };
    if (facilityId) {
      where.facilityId = facilityId;
    }
    
    return this.repo.find({
      where,
      relations: ["patient", "facility", "orderItems", "assignedPersonnel", "assignedPersonnel.user"],
      order: { createdAt: "ASC" }
    });
  }

  // Find orders by assigned personnel
  findByAssignedPersonnel(personnelId) {
    return this.repo.find({
      where: { assignedPersonnelId: personnelId },
      relations: ["patient", "facility", "orderItems"],
      order: { scheduledDateTime: "ASC" }
    });
  }

  // Find orders pending payment
  findPendingPayment(facilityId = null) {
    const where = { status: "pending_payment" };
    if (facilityId) {
      where.facilityId = facilityId;
    }
    
    return this.repo.find({
      where,
      relations: ["patient", "facility", "orderItems"],
      order: { invoiceSentAt: "ASC" }
    });
  }

  // Find orders ready for assignment
  findReadyForAssignment(facilityId) {
    return this.repo.find({
      where: { 
        facilityId,
        status: "payment_confirmed",
        assignedPersonnelId: null
      },
      relations: ["patient", "orderItems"],
      order: { paidAt: "ASC" }
    });
  }

  // Find orders needing review
  findNeedingReview(facilityId = null) {
    const where = { status: "results_ready" };
    if (facilityId) {
      where.facilityId = facilityId;
    }
    
    return this.repo.find({
      where,
      relations: ["patient", "facility", "orderItems", "assignedPersonnel", "assignedPersonnel.user"],
      order: { processingCompletedAt: "ASC" }
    });
  }

  // Update order status with timestamp
  async updateStatus(orderId, status, additionalData = {}) {
    const updateData = { status, ...additionalData };
    
    // Add appropriate timestamp based on status
    const timestampMap = {
      'assigned': 'assignedAt',
      'in_progress': 'collectionStartedAt', 
      'sample_collected': 'collectionCompletedAt',
      'processing': 'processingStartedAt',
      'results_ready': 'processingCompletedAt',
      'under_review': 'reviewStartedAt',
      'results_approved': 'reviewCompletedAt',
      'completed': 'resultsDeliveredAt'
    };

    if (timestampMap[status]) {
      updateData[timestampMap[status]] = new Date();
    }

    return this.repo.update({ id: orderId }, updateData);
  }

  // Assign personnel to order
  async assignPersonnel(orderId, personnelId) {
    return this.repo.update(
      { id: orderId },
      { 
        assignedPersonnelId: personnelId,
        status: "assigned",
        assignedAt: new Date()
      }
    );
  }

  // Assign reviewer to order
  async assignReviewer(orderId, reviewerId) {
    return this.repo.update(
      { id: orderId },
      { 
        reviewerId: reviewerId,
        status: "under_review",
        reviewStartedAt: new Date()
      }
    );
  }

  // Update payment information
  async updatePaymentInfo(orderId, paymentData) {
    const updateData = {
      ...paymentData,
      status: "payment_confirmed",
      paidAt: new Date()
    };
    return this.repo.update({ id: orderId }, updateData);
  }

  // Schedule appointment
  async scheduleAppointment(orderId, scheduledDateTime) {
    return this.repo.update(
      { id: orderId },
      { 
        scheduledDateTime,
        status: "scheduled"
      }
    );
  }

  // Upload results
  async uploadResults(orderId, resultsData) {
    return this.repo.update(
      { id: orderId },
      { 
        ...resultsData,
        status: "results_ready",
        processingCompletedAt: new Date()
      }
    );
  }

  // Search orders
  searchOrders(query, facilityId = null) {
    let queryBuilder = this.repo
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.patient", "patient")
      .leftJoinAndSelect("order.facility", "facility")
      .leftJoinAndSelect("order.orderItems", "orderItems")
      .where("order.orderNumber ILIKE :query", { query: `%${query}%` })
      .orWhere("patient.fullName ILIKE :query", { query: `%${query}%` })
      .orWhere("patient.email ILIKE :query", { query: `%${query}%` });

    if (facilityId) {
      queryBuilder = queryBuilder.andWhere("order.facilityId = :facilityId", { facilityId });
    }

    return queryBuilder
      .orderBy("order.createdAt", "DESC")
      .getMany();
  }

  // Get order statistics
  async getOrderStats(facilityId = null) {
    let queryBuilder = this.repo.createQueryBuilder("order");
    
    if (facilityId) {
      queryBuilder = queryBuilder.where("order.facilityId = :facilityId", { facilityId });
    }

    const statusCounts = await queryBuilder
      .select("order.status", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("order.status")
      .getRawMany();

    const totalOrders = await queryBuilder.getCount();
    
    const todayOrders = await queryBuilder
      .where("DATE(order.createdAt) = DATE(NOW())")
      .getCount();

    return {
      statusCounts: statusCounts.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      totalOrders,
      todayOrders
    };
  }

  // Find overdue orders
  findOverdueOrders(facilityId = null) {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    let queryBuilder = this.repo
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.patient", "patient")
      .leftJoinAndSelect("order.facility", "facility")
      .where("order.createdAt < :threeDaysAgo", { threeDaysAgo })
      .andWhere("order.status NOT IN (:...completedStatuses)", {
        completedStatuses: ["completed", "cancelled"]
      });

    if (facilityId) {
      queryBuilder = queryBuilder.andWhere("order.facilityId = :facilityId", { facilityId });
    }

    return queryBuilder
      .orderBy("order.createdAt", "ASC")
      .getMany();
  }

  // Cancel order
  async cancelOrder(orderId, reason) {
    return this.repo.update(
      { id: orderId },
      { 
        status: "cancelled",
        cancellationReason: reason
      }
    );
  }

  // Get recent orders
  findRecentOrders(facilityId = null, limit = 10) {
    let queryBuilder = this.repo
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.patient", "patient")
      .leftJoinAndSelect("order.facility", "facility")
      .leftJoinAndSelect("order.orderItems", "orderItems");

    if (facilityId) {
      queryBuilder = queryBuilder.where("order.facilityId = :facilityId", { facilityId });
    }

    return queryBuilder
      .orderBy("order.createdAt", "DESC")
      .take(limit)
      .getMany();
  }
}

module.exports = new LabOrderRepository();