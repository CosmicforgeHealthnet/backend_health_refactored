// src/services/walletService.js
const walletRepository = require("../repositories/wallet/wallet");
const walletTransactionRepository = require("../repositories/wallet/wallet_transaction");
const walletTopUpRepository = require("../repositories/wallet/wallet_top_up");
const userRepository = require("../../auth/repositories/userRepository");
const labFacilityRepository = require("../repositories/lab_facility");
const { WALLET_TYPE, WALLET_STATUS, TRANSACTION_TYPE, TRANSACTION_STATUS, PAYMENT_METHOD } = require("../utils/constants");
const bcrypt = require('bcrypt');
const crypto = require("node:crypto");        

class WalletService {
  
  /**
   * Create a new wallet for user
   */
  async createWallet(userId, walletType = WALLET_TYPE.PATIENT, facilityId = null) {
    // Validate user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user already has a wallet
    const existingWallet = await walletRepository.findByUserId(userId);
    if (existingWallet) {
      throw new Error("User already has a wallet");
    }

    // Validate facility for facility wallets
    if (walletType === WALLET_TYPE.FACILITY) {
      if (!facilityId) {
        throw new Error("Facility ID is required for facility wallets");
      }
      
      const facility = await labFacilityRepository.findById(facilityId);
      if (!facility) {
        throw new Error("Facility not found");
      }
    }

    // Create wallet
    const wallet = walletRepository.create({
      userId,
      facilityId,
      walletType,
      status: WALLET_STATUS.ACTIVE,
      balance: 0.00,
      pendingBalance: 0.00,
      frozenBalance: 0.00,
      currency: "USD"
    });

    const savedWallet = await walletRepository.save(wallet);

    // Send wallet creation notification
    try {
      await this.sendWalletCreationNotification(user, savedWallet);
    } catch (emailError) {
      console.error("Failed to send wallet creation notification:", emailError);
    }

    return this.getWalletById(savedWallet.id);
  }

  /**
   * Get wallet by ID
   */
  async getWalletById(walletId) {
    const wallet = await walletRepository.findById(walletId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }
    return wallet;
  }

  /**
   * Get user's wallet
   */
  async getUserWallet(userId) {
    const wallet = await walletRepository.findByUserId(userId);
    if (!wallet) {
      // Auto-create wallet for patients
      const user = await userRepository.findById(userId);
      if (user && user.role === 'patient') {
        return this.createWallet(userId, WALLET_TYPE.PATIENT);
      }
      throw new Error("Wallet not found");
    }
    return wallet;
  }

  /**
   * Add money to wallet (credit transaction)
   */
  async addMoney(walletId, amount, description, metadata = {}) {
    const wallet = await this.getWalletById(walletId);
    
    if (wallet.status !== WALLET_STATUS.ACTIVE) {
      throw new Error("Wallet is not active");
    }

    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }

    // Create transaction
    const transaction = await this.createTransaction({
      walletId: wallet.id,
      userId: wallet.userId,
      type: TRANSACTION_TYPE.CREDIT,
      amount: amount,
      description,
      metadata,
      balanceBefore: parseFloat(wallet.balance),
      balanceAfter: parseFloat(wallet.balance) + parseFloat(amount)
    });

    // Update wallet balance
    await walletRepository.updateBalance(
      walletId, 
      parseFloat(wallet.balance) + parseFloat(amount)
    );

    // Mark transaction as completed
    await walletTransactionRepository.updateStatus(transaction.id, TRANSACTION_STATUS.COMPLETED);

    return this.getWalletById(walletId);
  }

  /**
   * Deduct money from wallet (debit transaction)
   */
  async deductMoney(walletId, amount, description, metadata = {}) {
    const wallet = await this.getWalletById(walletId);
    
    if (wallet.status !== WALLET_STATUS.ACTIVE) {
      throw new Error("Wallet is not active");
    }

    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }

    if (parseFloat(wallet.balance) < amount) {
      throw new Error("Insufficient wallet balance");
    }

    // Create transaction
    const transaction = await this.createTransaction({
      walletId: wallet.id,
      userId: wallet.userId,
      type: TRANSACTION_TYPE.DEBIT,
      amount: amount,
      description,
      metadata,
      balanceBefore: parseFloat(wallet.balance),
      balanceAfter: parseFloat(wallet.balance) - parseFloat(amount)
    });

    // Update wallet balance
    await walletRepository.updateBalance(
      walletId, 
      parseFloat(wallet.balance) - parseFloat(amount)
    );

    // Mark transaction as completed
    await walletTransactionRepository.updateStatus(transaction.id, TRANSACTION_STATUS.COMPLETED);

    return this.getWalletById(walletId);
  }

  /**
   * Process payment for lab order
   */
  async processOrderPayment(orderId, patientId, amount, paymentMethod = PAYMENT_METHOD.WALLET_BALANCE) {
    // Get patient wallet
    const wallet = await this.getUserWallet(patientId);
    
    if (wallet.status !== WALLET_STATUS.ACTIVE) {
      throw new Error("Wallet is not active");
    }

    if (parseFloat(wallet.balance) < amount) {
      throw new Error("Insufficient wallet balance for order payment");
    }

    // Create payment transaction
    const transaction = await this.createTransaction({
      walletId: wallet.id,
      userId: patientId,
      orderId: orderId,
      type: TRANSACTION_TYPE.PAYMENT,
      amount: amount,
      paymentMethod,
      description: `Payment for lab order #${orderId}`,
      metadata: { orderId, paymentMethod },
      balanceBefore: parseFloat(wallet.balance),
      balanceAfter: parseFloat(wallet.balance) - parseFloat(amount)
    });

    // Update wallet balance
    await walletRepository.updateBalance(
      wallet.id, 
      parseFloat(wallet.balance) - parseFloat(amount)
    );

    // Mark transaction as completed
    await walletTransactionRepository.updateStatus(transaction.id, TRANSACTION_STATUS.COMPLETED);

    return {
      transaction,
      wallet: await this.getWalletById(wallet.id)
    };
  }

  /**
   * Process refund for cancelled/failed order
   */
  async processOrderRefund(orderId, patientId, amount, reason) {
    // Get patient wallet
    const wallet = await this.getUserWallet(patientId);

    // Create refund transaction
    const transaction = await this.createTransaction({
      walletId: wallet.id,
      userId: patientId,
      orderId: orderId,
      type: TRANSACTION_TYPE.REFUND,
      amount: amount,
      description: `Refund for lab order #${orderId} - ${reason}`,
      metadata: { orderId, reason },
      balanceBefore: parseFloat(wallet.balance),
      balanceAfter: parseFloat(wallet.balance) + parseFloat(amount)
    });

    // Update wallet balance
    await walletRepository.updateBalance(
      wallet.id, 
      parseFloat(wallet.balance) + parseFloat(amount)
    );

    // Mark transaction as completed
    await walletTransactionRepository.updateStatus(transaction.id, TRANSACTION_STATUS.COMPLETED);

    // Send refund notification
    try {
      await this.sendRefundNotification(wallet.user, amount, orderId, reason);
    } catch (emailError) {
      console.error("Failed to send refund notification:", emailError);
    }

    return {
      transaction,
      wallet: await this.getWalletById(wallet.id)
    };
  }

  /**
   * Create wallet top-up request
   */
  async createTopUp(userId, amount, paymentMethod) {
    const wallet = await this.getUserWallet(userId);
    
    if (wallet.status !== WALLET_STATUS.ACTIVE) {
      throw new Error("Wallet is not active");
    }

    if (amount <= 0 || amount > 10000) {
      throw new Error("Invalid top-up amount. Must be between $0.01 and $10,000");
    }

    const topupNumber = await walletTopUpRepository.generateTopUpNumber();

    const topup = walletTopUpRepository.create({
      topupNumber,
      userId,
      walletId: wallet.id,
      amount,
      paymentMethod,
      metadata: {
        initiatedFrom: 'wallet_service',
        userAgent: 'system'
      }
    });

    const savedTopUp = await walletTopUpRepository.save(topup);

    // For demo purposes, we'll auto-complete the top-up
    // In production, this would integrate with payment processors
    if (paymentMethod !== PAYMENT_METHOD.WALLET_BALANCE) {
      await this.completeTopUp(savedTopUp.id, {
        paymentReference: `ref_${crypto.randomBytes(8).toString('hex')}`,
        externalTransactionId: `ext_${crypto.randomBytes(8).toString('hex')}`
      });
    }

    return savedTopUp;
  }

  /**
   * Complete top-up process
   */
  async completeTopUp(topupId, paymentData = {}) {
    const topup = await walletTopUpRepository.findById(topupId);
    if (!topup) {
      throw new Error("Top-up not found");
    }

    if (topup.status !== 'pending') {
      throw new Error("Top-up is not pending");
    }

    // Update top-up status
    await walletTopUpRepository.updateStatus(topupId, 'completed', {
      paymentReference: paymentData.paymentReference,
      completedAt: new Date()
    });

    // Add money to wallet
    await this.addMoney(
      topup.walletId,
      topup.amount,
      `Wallet top-up - ${topup.topupNumber}`,
      {
        topupId: topup.id,
        paymentMethod: topup.paymentMethod,
        paymentReference: paymentData.paymentReference
      }
    );

    // Send top-up confirmation
    try {
      await this.sendTopUpConfirmation(topup.user, topup.amount, topup.topupNumber);
    } catch (emailError) {
      console.error("Failed to send top-up confirmation:", emailError);
    }

    return walletTopUpRepository.findById(topupId);
  }

  /**
   * Set wallet PIN
   */
  async setWalletPin(walletId, pin, userId) {
    const wallet = await this.getWalletById(walletId);
    
    if (wallet.userId !== userId) {
      throw new Error("Access denied");
    }

    if (!/^\d{4,6}$/.test(pin)) {
      throw new Error("PIN must be 4-6 digits");
    }

    const hashedPin = await bcrypt.hash(pin, 12);
    
    const updatedWallet = Object.assign(wallet, { pin: hashedPin });
    return walletRepository.save(updatedWallet);
  }

  /**
   * Verify wallet PIN
   */
  async verifyWalletPin(walletId, pin, userId) {
    const wallet = await this.getWalletById(walletId);
    
    if (wallet.userId !== userId) {
      throw new Error("Access denied");
    }

    if (!wallet.pin) {
      throw new Error("PIN not set");
    }

    // Check if wallet is locked
    if (wallet.lockedUntil && new Date() < wallet.lockedUntil) {
      throw new Error("Wallet is locked. Please try again later.");
    }

    const isValid = await bcrypt.compare(pin, wallet.pin);
    
    if (!isValid) {
      // Increment failed attempts
      const newAttempts = wallet.pinAttempts + 1;
      await walletRepository.updatePinAttempts(walletId, newAttempts);
      
      // Lock wallet after 3 failed attempts
      if (newAttempts >= 3) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30); // Lock for 30 minutes
        await walletRepository.lockWallet(walletId, lockUntil);
        throw new Error("Too many failed attempts. Wallet locked for 30 minutes.");
      }
      
      throw new Error(`Invalid PIN. ${3 - newAttempts} attempts remaining.`);
    }

    // Reset attempts on successful verification
    await walletRepository.updatePinAttempts(walletId, 0);
    return true;
  }

  /**
   * Get wallet transaction history
   */
  async getTransactionHistory(walletId, userId, limit = 50, offset = 0) {
    const wallet = await this.getWalletById(walletId);
    
    if (wallet.userId !== userId) {
      throw new Error("Access denied");
    }

    return walletTransactionRepository.findByWalletId(walletId, limit, offset);
  }

  /**
   * Get wallet statistics
   */
  async getWalletStats(walletId, userId) {
    const wallet = await this.getWalletById(walletId);
    
    if (wallet.userId !== userId) {
      throw new Error("Access denied");
    }

    const [transactionStats, recentTransactions] = await Promise.all([
      walletTransactionRepository.getTransactionStats(walletId),
      walletTransactionRepository.findRecentTransactions(10, walletId)
    ]);

    return {
      wallet: {
        balance: wallet.balance,
        pendingBalance: wallet.pendingBalance,
        frozenBalance: wallet.frozenBalance,
        status: wallet.status
      },
      transactionStats,
      recentTransactions
    };
  }

  /**
   * Transfer money between wallets (future feature)
   */
  async transferMoney(fromWalletId, toWalletId, amount, description, userId) {
    const fromWallet = await this.getWalletById(fromWalletId);
    const toWallet = await this.getWalletById(toWalletId);
    
    if (fromWallet.userId !== userId) {
      throw new Error("Access denied");
    }

    if (fromWallet.status !== WALLET_STATUS.ACTIVE || toWallet.status !== WALLET_STATUS.ACTIVE) {
      throw new Error("Both wallets must be active");
    }

    if (parseFloat(fromWallet.balance) < amount) {
      throw new Error("Insufficient balance for transfer");
    }

    // Create debit transaction for sender
    const debitTransaction = await this.createTransaction({
      walletId: fromWallet.id,
      userId: fromWallet.userId,
      type: TRANSACTION_TYPE.TRANSFER,
      amount: amount,
      description: `Transfer to wallet ${toWallet.id} - ${description}`,
      metadata: { transferTo: toWallet.id, transferType: 'outgoing' },
      balanceBefore: parseFloat(fromWallet.balance),
      balanceAfter: parseFloat(fromWallet.balance) - parseFloat(amount)
    });

    // Create credit transaction for receiver
    const creditTransaction = await this.createTransaction({
      walletId: toWallet.id,
      userId: toWallet.userId,
      type: TRANSACTION_TYPE.TRANSFER,
      amount: amount,
      description: `Transfer from wallet ${fromWallet.id} - ${description}`,
      metadata: { transferFrom: fromWallet.id, transferType: 'incoming' },
      balanceBefore: parseFloat(toWallet.balance),
      balanceAfter: parseFloat(toWallet.balance) + parseFloat(amount)
    });

    // Update balances
    await Promise.all([
      walletRepository.updateBalance(fromWallet.id, parseFloat(fromWallet.balance) - parseFloat(amount)),
      walletRepository.updateBalance(toWallet.id, parseFloat(toWallet.balance) + parseFloat(amount))
    ]);

    // Mark transactions as completed
    await Promise.all([
      walletTransactionRepository.updateStatus(debitTransaction.id, TRANSACTION_STATUS.COMPLETED),
      walletTransactionRepository.updateStatus(creditTransaction.id, TRANSACTION_STATUS.COMPLETED)
    ]);

    return {
      debitTransaction,
      creditTransaction,
      fromWallet: await this.getWalletById(fromWallet.id),
      toWallet: await this.getWalletById(toWallet.id)
    };
  }

  // Utility methods
  async createTransaction(transactionData) {
    const transactionNumber = await walletTransactionRepository.generateTransactionNumber();
    
    const transaction = walletTransactionRepository.create({
      transactionNumber,
      netAmount: transactionData.amount - (transactionData.fee || 0),
      fee: transactionData.fee || 0,
      status: TRANSACTION_STATUS.PENDING,
      ...transactionData
    });

    return walletTransactionRepository.save(transaction);
  }

  async sendWalletCreationNotification(user, wallet) {
    console.log(`Sending wallet creation notification to ${user.email}`);
    // Implementation depends on your email service
  }

  async sendRefundNotification(user, amount, orderId, reason) {
    console.log(`Sending refund notification to ${user.email} for ${amount}`);
    // Implementation depends on your email service
  }

  async sendTopUpConfirmation(user, amount, topupNumber) {
    console.log(`Sending top-up confirmation to ${user.email} for ${amount}`);
    // Implementation depends on your email service
  }

  /**
   * Search transactions across wallets (admin function)
   */
  async searchTransactions(query, adminUserId) {
    // Verify admin permissions
    const admin = await userRepository.findById(adminUserId);
    if (!admin || !['admin', 'super_admin'].includes(admin.role)) {
      throw new Error("Admin access required");
    }

    return walletTransactionRepository.searchTransactions(query);
  }

  /**
   * Get system-wide wallet statistics (admin function)
   */
  async getSystemWalletStats(adminUserId) {
    // Verify admin permissions
    const admin = await userRepository.findById(adminUserId);
    if (!admin || !['admin', 'super_admin'].includes(admin.role)) {
      throw new Error("Admin access required");
    }

    const [totalBalance, transactionStats] = await Promise.all([
      walletRepository.getTotalBalance(),
      walletTransactionRepository.getTransactionStats()
    ]);

    return {
      totalBalance,
      transactionStats,
      systemHealth: {
        activeWallets: totalBalance.totalWallets,
        totalCirculation: totalBalance.totalBalance
      }
    };
  }
}

module.exports = new WalletService();