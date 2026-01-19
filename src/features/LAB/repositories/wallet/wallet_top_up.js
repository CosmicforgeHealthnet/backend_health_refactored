// src/repositories/walletTopUpRepository.js
const AppDataSource = require("../../../../config/database");
const WalletTopUp = require("../../entities/wallet/wallet_top_up");

class WalletTopUpRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(WalletTopUp);
  }

  // Basic CRUD operations
  create(data) {
    return this.repo.create(data);
  }

  save(topup) {
    return this.repo.save(topup);
  }

  findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: ["user", "wallet", "transaction"]
    });
  }

  // Generate unique top-up number
  async generateTopUpNumber() {
    const year = new Date().getFullYear();
    const count = await this.repo.count({
      where: {
        topupNumber: { $like: `TOP-${year}-%` }
      }
    });
    const nextNumber = (count + 1).toString().padStart(6, '0');
    return `TOP-${year}-${nextNumber}`;
  }

  // Find by payment intent ID
  findByPaymentIntentId(paymentIntentId) {
    return this.repo.findOne({
      where: { paymentIntentId },
      relations: ["user", "wallet"]
    });
  }

  // Find top-ups by user
  findByUserId(userId, limit = 20, offset = 0) {
    return this.repo.find({
      where: { userId },
      relations: ["wallet"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset
    });
  }

  // Find top-ups by status
  findByStatus(status) {
    return this.repo.find({
      where: { status },
      relations: ["user", "wallet"],
      order: { createdAt: "ASC" }
    });
  }

  // Update top-up status
  async updateStatus(topupId, status, additionalData = {}) {
    const updateData = { status, ...additionalData };
    
    if (status === "completed") {
      updateData.completedAt = new Date();
    } else if (status === "failed") {
      updateData.failedAt = new Date();
    }

    return this.repo.update({ id: topupId }, updateData);
  }

  // Get top-up statistics
  async getTopUpStats(userId = null, startDate = null, endDate = null) {
    let queryBuilder = this.repo
      .createQueryBuilder("topup")
      .select("topup.status", "status")
      .addSelect("COUNT(*)", "count")
      .addSelect("SUM(topup.amount)", "totalAmount")
      .groupBy("topup.status");

    if (userId) {
      queryBuilder = queryBuilder.where("topup.userId = :userId", { userId });
    }

    if (startDate) {
      queryBuilder = queryBuilder.andWhere("topup.createdAt >= :startDate", { startDate });
    }

    if (endDate) {
      queryBuilder = queryBuilder.andWhere("topup.createdAt <= :endDate", { endDate });
    }

    const results = await queryBuilder.getRawMany();
    
    return results.reduce((acc, row) => {
      acc[row.status] = {
        count: parseInt(row.count),
        totalAmount: parseFloat(row.totalAmount) || 0
      };
      return acc;
    }, {});
  }

  // Find pending top-ups older than specified time
  findStaleTopUps(hours = 24) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);

    return this.repo.find({
      where: [
        { status: "pending", createdAt: { $lt: cutoffTime } },
        { status: "processing", createdAt: { $lt: cutoffTime } }
      ],
      relations: ["user", "wallet"]
    });
  }
}

module.exports = new WalletTopUpRepository();