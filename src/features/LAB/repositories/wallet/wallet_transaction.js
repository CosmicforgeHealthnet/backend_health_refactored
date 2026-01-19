// src/repositories/walletTransactionRepository.js
const AppDataSource = require("../../../../config/database");
const WalletTransaction = require("../../entities/wallet/wallet_transaction");

class WalletTransactionRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(WalletTransaction);
  }

  // Basic CRUD operations
  create(data) {
    return this.repo.create(data);
  }

  save(transaction) {
    return this.repo.save(transaction);
  }

  findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: ["wallet", "user", "order", "facility"]
    });
  }

  // Generate unique transaction number
  async generateTransactionNumber() {
    const year = new Date().getFullYear();
    const count = await this.repo.count({
      where: {
        transactionNumber: { $like: `TXN-${year}-%` }
      }
    });
    const nextNumber = (count + 1).toString().padStart(6, '0');
    return `TXN-${year}-${nextNumber}`;
  }

  // Find transactions by wallet
  findByWalletId(walletId, limit = 50, offset = 0) {
    return this.repo.find({
      where: { walletId },
      relations: ["order", "facility"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset
    });
  }

  // Find transactions by user
  findByUserId(userId, limit = 50, offset = 0) {
    return this.repo.find({
      where: { userId },
      relations: ["wallet", "order", "facility"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset
    });
  }

  // Find transactions by type
  findByType(type, walletId = null, limit = 50) {
    const where = { type };
    if (walletId) {
      where.walletId = walletId;
    }

    return this.repo.find({
      where,
      relations: ["wallet", "user", "order"],
      order: { createdAt: "DESC" },
      take: limit
    });
  }

  // Find pending transactions
  findPendingTransactions() {
    return this.repo.find({
      where: { status: "pending" },
      relations: ["wallet", "user"],
      order: { createdAt: "ASC" }
    });
  }

  // Update transaction status
  async updateStatus(transactionId, status, additionalData = {}) {
    const updateData = { status, ...additionalData };
    
    if (status === "completed") {
      updateData.processedAt = new Date();
    } else if (status === "failed") {
      updateData.failedAt = new Date();
    }

    return this.repo.update({ id: transactionId }, updateData);
  }

  // Get transaction statistics
  async getTransactionStats(walletId = null, startDate = null, endDate = null) {
    let queryBuilder = this.repo
      .createQueryBuilder("transaction")
      .select("transaction.type", "type")
      .addSelect("transaction.status", "status")
      .addSelect("COUNT(*)", "count")
      .addSelect("SUM(transaction.amount)", "totalAmount")
      .groupBy("transaction.type, transaction.status");

    if (walletId) {
      queryBuilder = queryBuilder.where("transaction.walletId = :walletId", { walletId });
    }

    if (startDate) {
      queryBuilder = queryBuilder.andWhere("transaction.createdAt >= :startDate", { startDate });
    }

    if (endDate) {
      queryBuilder = queryBuilder.andWhere("transaction.createdAt <= :endDate", { endDate });
    }

    const results = await queryBuilder.getRawMany();
    
    return results.reduce((acc, row) => {
      if (!acc[row.type]) acc[row.type] = {};
      acc[row.type][row.status] = {
        count: parseInt(row.count),
        totalAmount: parseFloat(row.totalAmount) || 0
      };
      return acc;
    }, {});
  }

  // Search transactions
  searchTransactions(query, userId = null) {
    let queryBuilder = this.repo
      .createQueryBuilder("transaction")
      .leftJoinAndSelect("transaction.wallet", "wallet")
      .leftJoinAndSelect("transaction.user", "user")
      .leftJoinAndSelect("transaction.order", "order")
      .where("transaction.transactionNumber ILIKE :query", { query: `%${query}%` })
      .orWhere("transaction.description ILIKE :query", { query: `%${query}%` })
      .orWhere("transaction.externalReference ILIKE :query", { query: `%${query}%` });

    if (userId) {
      queryBuilder = queryBuilder.andWhere("transaction.userId = :userId", { userId });
    }

    return queryBuilder
      .orderBy("transaction.createdAt", "DESC")
      .getMany();
  }

  // Get recent transactions
  findRecentTransactions(limit = 10, walletId = null) {
    const where = {};
    if (walletId) {
      where.walletId = walletId;
    }

    return this.repo.find({
      where,
      relations: ["user", "order"],
      order: { createdAt: "DESC" },
      take: limit
    });
  }

  // Find transactions by date range
  findByDateRange(startDate, endDate, walletId = null) {
    let queryBuilder = this.repo
      .createQueryBuilder("transaction")
      .leftJoinAndSelect("transaction.user", "user")
      .leftJoinAndSelect("transaction.order", "order")
      .where("transaction.createdAt >= :startDate", { startDate })
      .andWhere("transaction.createdAt <= :endDate", { endDate });

    if (walletId) {
      queryBuilder = queryBuilder.andWhere("transaction.walletId = :walletId", { walletId });
    }

    return queryBuilder
      .orderBy("transaction.createdAt", "DESC")
      .getMany();
  }

  // Find failed transactions for retry
  findFailedTransactions(maxRetries = 3) {
    return this.repo.find({
      where: [
        { status: "failed", retryCount: { $lt: maxRetries } }
      ],
      relations: ["wallet", "user"],
      order: { createdAt: "ASC" }
    });
  }
}

module.exports = new WalletTransactionRepository();