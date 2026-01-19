// src/controllers/walletController.js
const walletService = require("../services/wallet");
const { USER_ROLES } = require("../../../shared/utils/constants");

class WalletController {
  
  /**
   * Get user's wallet
   * GET /api/wallet/my
   */
  async getMyWallet(req, res, next) {
    try {
      const { sub: userId } = req.user;
      
      const wallet = await walletService.getUserWallet(userId);
      
      return res.json({
        success: true,
        message: "Wallet retrieved successfully",
        data: wallet
      });
    } catch (error) {
      if (error.message === "Wallet not found") {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Create wallet for user
   * POST /api/wallet/create
   */
  async createWallet(req, res, next) {
    try {
      const { sub: userId } = req.user;
      const { walletType, facilityId } = req.body;
      
      const wallet = await walletService.createWallet(userId, walletType, facilityId);
      
      return res.status(201).json({
        success: true,
        message: "Wallet created successfully",
        data: wallet
      });
    } catch (error) {
      if (error.message.includes("already has a wallet") || error.message.includes("not found")) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get wallet transaction history
   * GET /api/wallet/my/transactions
   */
  async getMyTransactions(req, res, next) {
    try {
      const { sub: userId } = req.user;
      const { limit = 50, offset = 0 } = req.query;
      
      const wallet = await walletService.getUserWallet(userId);
      const transactions = await walletService.getTransactionHistory(
        wallet.id, 
        userId, 
        parseInt(limit), 
        parseInt(offset)
      );
      
      return res.json({
        success: true,
        message: "Transaction history retrieved successfully",
        data: transactions,
        count: transactions.length
      });
    } catch (error) {
      if (error.message === "Wallet not found" || error.message === "Access denied") {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get wallet statistics
   * GET /api/wallet/my/stats
   */
  async getMyWalletStats(req, res, next) {
    try {
      const { sub: userId } = req.user;
      
      const wallet = await walletService.getUserWallet(userId);
      const stats = await walletService.getWalletStats(wallet.id, userId);
      
      return res.json({
        success: true,
        message: "Wallet statistics retrieved successfully",
        data: stats
      });
    } catch (error) {
      if (error.message === "Wallet not found" || error.message === "Access denied") {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Create wallet top-up
   * POST /api/wallet/topup
   */
  async createTopUp(req, res, next) {
    try {
      const { sub: userId } = req.user;
      const { amount, paymentMethod } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Valid amount is required"
        });
      }

      if (!paymentMethod) {
        return res.status(400).json({
          success: false,
          error: "Payment method is required"
        });
      }
      
      const topup = await walletService.createTopUp(userId, amount, paymentMethod);
      
      return res.status(201).json({
        success: true,
        message: "Top-up initiated successfully",
        data: topup
      });
    } catch (error) {
      if (error.message.includes("Invalid") || error.message.includes("not active")) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Set wallet PIN
   * PUT /api/wallet/my/pin
   */
  async setWalletPin(req, res, next) {
    try {
      const { sub: userId } = req.user;
      const { pin } = req.body;
      
      if (!pin) {
        return res.status(400).json({
          success: false,
          error: "PIN is required"
        });
      }
      
      const wallet = await walletService.getUserWallet(userId);
      await walletService.setWalletPin(wallet.id, pin, userId);
      
      return res.json({
        success: true,
        message: "Wallet PIN set successfully"
      });
    } catch (error) {
      if (error.message.includes("PIN must be") || error.message === "Access denied") {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Verify wallet PIN
   * POST /api/wallet/my/verify-pin
   */
  async verifyWalletPin(req, res, next) {
    try {
      const { sub: userId } = req.user;
      const { pin } = req.body;
      
      if (!pin) {
        return res.status(400).json({
          success: false,
          error: "PIN is required"
        });
      }
      
      const wallet = await walletService.getUserWallet(userId);
      const isValid = await walletService.verifyWalletPin(wallet.id, pin, userId);
      
      return res.json({
        success: true,
        message: "PIN verified successfully",
        data: { valid: isValid }
      });
    } catch (error) {
      if (error.message.includes("Invalid PIN") || error.message.includes("locked") || error.message.includes("attempts")) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Transfer money between wallets
   * POST /api/wallet/transfer
   */
  async transferMoney(req, res, next) {
    try {
      const { sub: userId } = req.user;
      const { toWalletId, amount, description, pin } = req.body;
      
      if (!toWalletId || !amount || !description) {
        return res.status(400).json({
          success: false,
          error: "To wallet ID, amount, and description are required"
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Amount must be positive"
        });
      }
      
      const wallet = await walletService.getUserWallet(userId);
      
      // Verify PIN if provided
      if (pin) {
        await walletService.verifyWalletPin(wallet.id, pin, userId);
      }
      
      const transfer = await walletService.transferMoney(
        wallet.id, 
        toWalletId, 
        amount, 
        description, 
        userId
      );
      
      return res.json({
        success: true,
        message: "Transfer completed successfully",
        data: transfer
      });
    } catch (error) {
      if (error.message.includes("Insufficient") || error.message.includes("not active") || error.message.includes("Invalid PIN")) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  // ============== ADMIN ENDPOINTS ==============

  /**
   * Search transactions (admin only)
   * GET /api/wallet/admin/transactions/search
   */
  async searchTransactions(req, res, next) {
    try {
      const { sub: adminId, role } = req.user;
      const { q } = req.query;
      
      if (!['admin', 'super_admin'].includes(role)) {
        return res.status(403).json({
          success: false,
          error: "Admin access required"
        });
      }

      if (!q) {
        return res.status(400).json({
          success: false,
          error: "Search query 'q' is required"
        });
      }
      
      const transactions = await walletService.searchTransactions(q, adminId);
      
      return res.json({
        success: true,
        message: "Transaction search completed",
        data: transactions,
        count: transactions.length
      });
    } catch (error) {
      if (error.message === "Admin access required") {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get system wallet statistics (admin only)
   * GET /api/wallet/admin/stats
   */
  async getSystemWalletStats(req, res, next) {
    try {
      const { sub: adminId, role } = req.user;
      
      if (!['admin', 'super_admin'].includes(role)) {
        return res.status(403).json({
          success: false,
          error: "Admin access required"
        });
      }
      
      const stats = await walletService.getSystemWalletStats(adminId);
      
      return res.json({
        success: true,
        message: "System wallet statistics retrieved successfully",
        data: stats
      });
    } catch (error) {
      if (error.message === "Admin access required") {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Manually add money to wallet (admin only)
   * POST /api/wallet/admin/credit
   */
  async adminCreditWallet(req, res, next) {
    try {
      const { sub: adminId, role } = req.user;
      const { walletId, amount, description } = req.body;
      
      if (!['admin', 'super_admin'].includes(role)) {
        return res.status(403).json({
          success: false,
          error: "Admin access required"
        });
      }

      if (!walletId || !amount || !description) {
        return res.status(400).json({
          success: false,
          error: "Wallet ID, amount, and description are required"
        });
      }
      
      const wallet = await walletService.addMoney(
        walletId, 
        amount, 
        `Admin credit: ${description}`,
        { adminId, adminAction: true }
      );
      
      return res.json({
        success: true,
        message: "Wallet credited successfully",
        data: wallet
      });
    } catch (error) {
      if (error.message.includes("not found") || error.message.includes("not active")) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Process payment webhook (internal endpoint)
   * POST /api/wallet/webhook/payment
   */
  async processPaymentWebhook(req, res, next) {
    try {
      // This would typically be secured with webhook signatures
      const { topupId, status, paymentReference, externalTransactionId } = req.body;
      
      if (!topupId || !status) {
        return res.status(400).json({
          success: false,
          error: "Top-up ID and status are required"
        });
      }

      if (status === 'completed') {
        await walletService.completeTopUp(topupId, {
          paymentReference,
          externalTransactionId
        });
      }
      
      return res.json({
        success: true,
        message: "Webhook processed successfully"
      });
    } catch (error) {
      if (error.message.includes("not found") || error.message.includes("not pending")) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }
}

module.exports = new WalletController();