// src/repositories/labOrderItemRepository.js
const AppDataSource = require("../../../config/database");
const LabOrderItem = require("../entities/lab_order_item");

class LabOrderItemRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(LabOrderItem);
  }

  // Basic CRUD operations
  create(data) {
    return this.repo.create(data);
  }

  save(orderItem) {
    return this.repo.save(orderItem);
  }

  findById(id) {
    return this.repo.findOne({ 
      where: { id },
      relations: ["order"]
    });
  }

  // Find items by order ID
  findByOrderId(orderId) {
    return this.repo.find({
      where: { orderId },
      order: { createdAt: "ASC" }
    });
  }

  // Bulk create order items
  async createOrderItems(orderId, items) {
    const orderItems = items.map(item => this.create({
      ...item,
      orderId,
      totalPrice: item.unitPrice * (item.quantity || 1)
    }));

    return this.repo.save(orderItems);
  }

  // Update item results
  async updateResults(itemId, resultsData) {
    return this.repo.update({ id: itemId }, resultsData);
  }

  // Find items by test category
  findByTestCategory(category, facilityId = null) {
    let queryBuilder = this.repo
      .createQueryBuilder("item")
      .leftJoinAndSelect("item.order", "order")
      .where("item.testCategory = :category", { category });

    if (facilityId) {
      queryBuilder = queryBuilder.andWhere("order.facilityId = :facilityId", { facilityId });
    }

    return queryBuilder.getMany();
  }

  // Get popular tests
  async getPopularTests(facilityId = null, limit = 10) {
    let queryBuilder = this.repo
      .createQueryBuilder("item")
      .leftJoin("item.order", "order")
      .select("item.testName", "testName")
      .addSelect("item.testCode", "testCode")
      .addSelect("COUNT(*)", "count")
      .groupBy("item.testName, item.testCode");

    if (facilityId) {
      queryBuilder = queryBuilder.where("order.facilityId = :facilityId", { facilityId });
    }

    return queryBuilder
      .orderBy("count", "DESC")
      .take(limit)
      .getRawMany();
  }

  // Delete order items
  deleteByOrderId(orderId) {
    return this.repo.delete({ orderId });
  }
}

module.exports = new LabOrderItemRepository();