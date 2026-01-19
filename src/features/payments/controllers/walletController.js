// ================================
// WALLET CONTROLLER
// ================================

// src/controllers/transactions/walletController.js
const walletService = require("../services/walletService");
const ValidationMiddleware = require("../../../shared/middlewares/validation");
const PaymentAuthMiddleware = require("../middlewares/paymentAuth");
const RateLimiterMiddleware = require("../../../shared/middlewares/rateLimiter");

class WalletController {
  /**
   * Get doctor's wallet
   */
  static async getDoctorWallet(req, res) {
    try {
      const doctorId = req.user.sub;
      const wallet = await walletService.getDoctorWallet(doctorId);

      res.status(200).json({
        success: true,
        message: "Wallet retrieved successfully",
        data: wallet
      });
    } catch (error) {
      console.error("Error getting wallet:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get wallet"
      });
    }
  }

  /**
   * Update wallet display currency
   */
  static async updateDisplayCurrency(req, res) {
    try {
      const doctorId = req.user.sub;
      const { currency } = req.body;

      const wallet = await walletService.updateDisplayCurrency(doctorId, currency);

      res.status(200).json({
        success: true,
        message: "Display currency updated successfully",
        data: wallet
      });
    } catch (error) {
      console.error("Error updating display currency:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update display currency"
      });
    }
  }

  /**
 * Resolve bank account details
 */
  static async resolveAccountDetails(req, res) {
    try {
      const { accountNumber, bankCode } = req.body;

      if (!accountNumber || !bankCode) {
        return res.status(400).json({
          success: false,
          message: 'Account number and bank code are required'
        });
      }

      const result = await walletService.resolveAccountDetails(accountNumber, bankCode);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Account details resolved successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error('Error resolving account:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve account details'
      });
    }
  }

  /**
   * Get supported banks
   */
  static async getSupportedBanks(req, res) {
    try {
      const result = await walletService.getSupportedBanks();

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Banks retrieved successfully',
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error('Error getting banks:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get supported banks'
      });
    }
  }

  /**
   * Initiate withdrawal request
   */
  // Replace the existing initiateWithdrawal method in WalletController
  static async initiateWithdrawal(req, res) {
    try {
      const withdrawalData = {
        ...req.validatedData,
        doctorId: req.user.sub
      };

      const result = await walletService.initiateWithdrawal(withdrawalData);

      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          withdrawals: result.withdrawals.map(w => ({
            withdrawalId: w.withdrawal.id,
            processor: w.processor,
            amount: w.amount,
            amountUsd: w.withdrawal.amountUsd,
            status: w.withdrawal.status
          })),
          totalAmount: result.totalAmount,
          currency: result.currency,
          routingStrategy: result.routingStrategy,
          isMultipleTransactions: result.withdrawals.length > 1
        }
      });
    } catch (error) {
      console.error("Error initiating withdrawal:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to initiate withdrawal"
      });
    }
  }

  // REPLACE the existing completeWithdrawalOtp method and ADD new methods:

  /**
   * Complete withdrawal with custom OTP verification
   */
  static async completeWithdrawalOtp(req, res) {
    try {
      const { withdrawalId } = req.params;
      const { otp, walletPassword } = req.body;
      const doctorId = req.user.sub;

      if (!otp) {
        return res.status(400).json({
          success: false,
          message: 'OTP is required'
        });
      }

      // Validate OTP format (6 digits)
      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({
          success: false,
          message: 'OTP must be 6 digits'
        });
      }

      const result = await walletService.verifyCustomOtp(withdrawalId, otp, doctorId, walletPassword);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          withdrawalId: result.withdrawalId
        }
      });

    } catch (error) {
      console.error('Error completing withdrawal OTP:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to complete withdrawal'
      });
    }
  }

  /**
   * Resend OTP for withdrawal
   */
  static async resendWithdrawalOtp(req, res) {
    try {
      const { withdrawalId } = req.params;
      const doctorId = req.user.sub;

      const result = await walletService.resendWithdrawalOtp(withdrawalId, doctorId);

      res.status(200).json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('Error resending OTP:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to resend OTP'
      });
    }
  }

  /**
   * Set wallet password
   */
  static async setWalletPassword(req, res) {
    try {
      const { password } = req.body;
      const doctorId = req.user.sub;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required'
        });
      }

      if (password.length < 4) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 4 characters long'
        });
      }

      const result = await walletService.setWalletPassword(doctorId, password);

      res.status(200).json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('Error setting wallet password:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to set wallet password'
      });
    }
  }

  /**
   * Update wallet password (requires current password)
   */
  static async updateWalletPassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const doctorId = req.user.sub;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 4) {
        return res.status(400).json({
          success: false,
          message: 'New Password must be at least 4 characters long'
        });
      }

      const result = await walletService.updateWalletPassword(doctorId, currentPassword, newPassword);

      res.status(200).json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('Error updating wallet password:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update wallet password'
      });
    }
  }

  /**
   * Request wallet password reset via email
   */
  static async requestWalletPasswordReset(req, res) {
    try {
      const doctorId = req.user.sub;

      const result = await walletService.requestWalletPasswordReset(doctorId);

      res.status(200).json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('Error requesting wallet password reset:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to request password reset'
      });
    }
  }

  /**
   * Reset wallet password using email token (public endpoint - no auth required)
   */
  static async resetWalletPasswordWithToken(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Reset token and new password are required'
        });
      }


      if (newPassword.length < 4) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 4 characters long'
        });
      }

      const result = await walletService.resetWalletPasswordWithToken(token, newPassword);

      res.status(200).json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('Error resetting wallet password:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to reset wallet password'
      });
    }
  }

  /**
   * Verify wallet password reset token (public endpoint - for frontend validation)
   */
  static async verifyWalletPasswordResetToken(req, res) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Reset token is required'
        });
      }

      const result = await walletService.verifyWalletPasswordResetToken(token);

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error verifying reset token:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to verify reset token'
      });
    }
  }

  /**
   * Check if doctor has wallet password
   */
  static async checkWalletPassword(req, res) {
    try {
      const doctorId = req.user.sub;
      const hasPassword = await walletService.hasWalletPassword(doctorId);

      res.status(200).json({
        success: true,
        data: {
          hasWalletPassword: hasPassword
        }
      });

    } catch (error) {
      console.error('Error checking wallet password:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to check wallet password'
      });
    }
  }

  /**
   * Verify wallet password (for sensitive operations)
   */
  static async verifyWalletPassword(req, res) {
    try {
      const { password } = req.body;
      const doctorId = req.user.sub;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required'
        });
      }

      const isValid = await walletService.verifyWalletPassword(doctorId, password);

      res.status(200).json({
        success: true,
        data: {
          isValid
        }
      });

    } catch (error) {
      console.error('Error verifying wallet password:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to verify wallet password'
      });
    }
  }

  /**
   * Get withdrawal history
   */
  static async getWithdrawalHistory(req, res) {
    try {
      const doctorId = req.user.sub;
      const { page = 1, limit = 20 } = req.query;

      let withdrawals = await walletService.getWithdrawalHistory(doctorId);

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedWithdrawals = withdrawals.slice(startIndex, endIndex);

      res.status(200).json({
        success: true,
        message: "Withdrawal history retrieved successfully",
        data: {
          withdrawals: paginatedWithdrawals,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(withdrawals.length / limit),
            totalItems: withdrawals.length,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error("Error getting withdrawal history:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get withdrawal history"
      });
    }
  }

  /**
   * Create wallet for doctor (Admin only)
   */
  static async createDoctorWallet(req, res) {
    try {
      const { doctorId } = req.body;
      const wallet = await walletService.createDoctorWallet(doctorId);

      res.status(201).json({
        success: true,
        message: "Doctor wallet created successfully",
        data: wallet
      });
    } catch (error) {
      console.error("Error creating doctor wallet:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create doctor wallet"
      });
    }
  }

  /**
   * Freeze wallet (Admin only)
   */
  static async freezeWallet(req, res) {
    try {
      const { doctorId, reason } = req.body;
      await walletService.freezeWallet(doctorId, reason);

      res.status(200).json({
        success: true,
        message: "Wallet frozen successfully"
      });
    } catch (error) {
      console.error("Error freezing wallet:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to freeze wallet"
      });
    }
  }

  /**
 * Get supported currencies
 */
  static async getSupportedCurrencies(req, res) {
    try {
      const result = await walletService.getSupportedCurrencies();

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Supported currencies retrieved successfully',
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error('Error getting supported currencies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get supported currencies'
      });
    }
  }

  /**
   * Unfreeze wallet (Admin only)
   */
  static async unfreezeWallet(req, res) {
    try {
      const { doctorId } = req.body;
      await walletService.unfreezeWallet(doctorId);

      res.status(200).json({
        success: true,
        message: "Wallet unfrozen successfully"
      });
    } catch (error) {
      console.error("Error unfreezing wallet:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to unfreeze wallet"
      });
    }
  }
}

module.exports = WalletController;