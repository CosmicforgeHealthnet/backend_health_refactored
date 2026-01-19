// src/repositories/walletRepository.js
const AppDataSource = require("../../../../config/database");
const Wallet = require("../../entities/wallet/wallet");

class WalletRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(Wallet);
  }

  // Basic CRUD operations
  create(data) {
    return this.repo.create(data);
  }

  save(wallet) {
    return this.repo.save(wallet);
  }

  findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: ["user", "facility", "transactions"]
    });
  }

  // Find wallet by user ID
  findByUserId(userId) {
    return this.repo.findOne({
      where: { userId },
      relations: ["user", "transactions"]
    });
  }

  // Find wallet by facility ID
  findByFacilityId(facilityId) {
    return this.repo.findOne({
      where: { facilityId },
      relations: ["facility", "transactions"]
    });
  }

  // Update wallet balance (atomic operation)
  async updateBalance(walletId, newBalance, newPendingBalance = null) {
    const updateData = { 
      balance: newBalance,
      lastTransactionAt: new Date()
    };
    
    if (newPendingBalance !== null) {
      updateData.pendingBalance = newPendingBalance;
    }

    return this.repo.update({ id: walletId }, updateData);
  }

  // Freeze/unfreeze balance
  async freezeBalance(walletId, amount) {
    return this.repo
      .createQueryBuilder()
      .update(Wallet)
      .set({
        balance: () => "balance - :amount",
        frozenBalance: () => "frozen_balance + :amount"
      })
      .where("id = :walletId")
      .setParameters({ walletId, amount })
      .execute();
  }

  async unfreezeBalance(walletId, amount) {
    return this.repo
      .createQueryBuilder()
      .update(Wallet)
      .set({
        balance: () => "balance + :amount",
        frozenBalance: () => "frozen_balance - :amount"
      })
      .where("id = :walletId")
      .setParameters({ walletId, amount })
      .execute();
  }

  // Security operations
  async updatePinAttempts(walletId, attempts) {
    return this.repo.update({ id: walletId }, { pinAttempts: attempts });
  }

  async lockWallet(walletId, lockUntil) {
    return this.repo.update({ id: walletId }, { 
      lockedUntil: lockUntil,
      pinAttempts: 0
    });
  }

  async unlockWallet(walletId) {
    return this.repo.update({ id: walletId }, { 
      lockedUntil: null,
      pinAttempts: 0
    });
  }

  // Find wallets by status
  findByStatus(status) {
    return this.repo.find({
      where: { status },
      relations: ["user", "facility"]
    });
  }

  // Statistics
  async getTotalBalance() {
    const result = await this.repo
      .createQueryBuilder("wallet")
      .select("SUM(wallet.balance)", "totalBalance")
      .addSelect("COUNT(wallet.id)", "totalWallets")
      .where("wallet.status = :status", { status: "active" })
      .getRawOne();

    return {
      totalBalance: parseFloat(result.totalBalance) || 0,
      totalWallets: parseInt(result.totalWallets) || 0
    };
  }

  // Find low balance wallets
  findLowBalanceWallets(threshold = 10) {
    return this.repo.find({
      where: [
        { balance: { $lt: threshold } }
      ],
      relations: ["user"],
      order: { balance: "ASC" }
    });
  }
}

module.exports = new WalletRepository();