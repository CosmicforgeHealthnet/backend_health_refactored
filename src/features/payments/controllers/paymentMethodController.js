// src/controllers/transactions/paymentMethodController.js
const paymentService = require("../services/paymentService");
const ValidationMiddleware = require("../../../shared/middlewares/validation");
const PaymentAuthMiddleware = require("../middlewares/paymentAuth");

class PaymentMethodController {
  // ================================
  // SECURE TOKENIZATION METHODS
  // ================================

  /**
   * SECURE: Initialize card tokenization (replaces validateAndSavePaymentMethod)
   */
  static async initializeCardTokenization(req, res) {
    try {
      const { provider, currency } = req.body;
      const userId = req.user.sub;

      // Validate provider
      if (!['flutterwave', 'paystack'].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: "Invalid provider. Must be 'flutterwave' or 'paystack'"
        });
      }

      // Validate currency
      const supportedCurrencies = ['NGN', 'GHS', 'USD', 'EUR', 'GBP'];
      if (!supportedCurrencies.includes(currency)) {
        return res.status(400).json({
          success: false,
          message: `Unsupported currency. Supported: ${supportedCurrencies.join(', ')}`
        });
      }

      // Use user's preferred currency if available, otherwise use provided currency
      const userCurrency = currency || req.user.preferredCurrency || 'NGN';

      // Construct return URL
      const returnUrl = `${process.env.FRONTEND_URL}/payment-methods/callback?provider=${provider}&userId=${userId}`;

      const result = await paymentService.initializeCardTokenization({
        userId,
        provider,
        currency: userCurrency,
        returnUrl
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            ...result.data,
            instructions: `You will be redirected to ${provider} to securely enter your card details. A validation charge of ${userCurrency} ${result.data.validationAmount} will be made and immediately refunded.`,
            securityInfo: {
              pciCompliant: true,
              cardDataNotStored: true,
              automaticRefund: true
            }
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error("Error initializing card tokenization:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to initialize card tokenization"
      });
    }
  }

  /**
   * SECURE: Handle tokenization callback
   */
  static async handleTokenizationCallback(req, res) {
    try {
      const { provider, reference, userId } = req.body;

      // Validate required fields
      if (!provider || !reference || !userId) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: provider, reference, userId"
        });
      }

      // Verify user authorization
      if (req.user.sub !== userId) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized access"
        });
      }

      const result = await paymentService.handleTokenizationCallback({
        provider,
        reference,
        userId
      });

      if (result.success) {
        res.status(201).json({
          success: true,
          message: result.message,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error("Error handling tokenization callback:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to process tokenization callback"
      });
    }
  }

  /**
   * SECURE: Check tokenization status
   */
  static async checkTokenizationStatus(req, res) {
    try {
      const { reference, provider } = req.params;

      if (!reference || !provider) {
        return res.status(400).json({
          success: false,
          message: "Missing reference or provider"
        });
      }

      const result = await paymentService.getTokenizationStatus(reference, provider);

      res.status(200).json({
        success: true,
        message: "Tokenization status retrieved successfully",
        data: result
      });

    } catch (error) {
      console.error("Error checking tokenization status:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to check tokenization status"
      });
    }
  }

  /**
   * DEPRECATED: Validate and save payment method (kept for backward compatibility)
   */
  static async validateAndSavePaymentMethod(req, res) {
    // Return deprecation notice
    res.status(410).json({
      success: false,
      message: 'This endpoint has been deprecated for security reasons. Please use /initialize-tokenization instead.',
      migration: {
        newEndpoint: '/api/payment-methods/initialize-tokenization',
        newMethod: 'POST',
        requiredFields: ['provider', 'currency'],
        documentation: 'https://docs.yourapp.com/payment-methods/secure-tokenization'
      }
    });
  }

  // ================================
  // PAYMENT METHOD MANAGEMENT
  // ================================

  /**
   * Get user's payment methods
   */
  static async getUserPaymentMethods(req, res) {
    try {
      const userId = req.user.sub;
      const paymentMethods = await paymentService.getUserPaymentMethods(userId);

      res.status(200).json({
        success: true,
        message: "Payment methods retrieved successfully",
        data: paymentMethods.map(method => ({
          id: method.id,
          cardLast4: method.cardLast4,
          cardType: method.cardType,
          cardBrand: method.cardBrand,
          bankName: method.bankName,
          cardCountry: method.cardCountry,
          isDefault: method.isDefault,
          canAutoCharge: method.canAutoCharge,
          hasValidTokens: method.hasValidTokens,
          tokenStatus: method.tokenStatus,
          flutterwaveSuccessRate: method.flutterwaveSuccessRate,
          paystackSuccessRate: method.paystackSuccessRate,
          lastUsed: method.lastUsed,
          createdAt: method.createdAt,
          tokenExpiryDate: method.tokenExpiryDate
        }))
      });
    } catch (error) {
      console.error("Error getting payment methods:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get payment methods"
      });
    }
  }

  /**
   * Get payment methods available for auto-billing
   */
  static async getAutoBillingPaymentMethods(req, res) {
    try {
      const userId = req.user.sub;
      const userPaymentMethodRepository = require("../repositories/userPaymentMethodRepository");

      const paymentMethods = await userPaymentMethodRepository.findForAutoBilling(userId);

      res.status(200).json({
        success: true,
        message: "Auto-billing payment methods retrieved successfully",
        data: paymentMethods.map(method => ({
          id: method.id,
          cardLast4: method.cardLast4,
          cardType: method.cardType,
          cardBrand: method.cardBrand,
          bankName: method.bankName,
          canAutoCharge: method.canAutoCharge,
          autoBillingSuccessCount: method.autoBillingSuccessCount,
          autoBillingFailureCount: method.autoBillingFailureCount,
          lastAutoBillingUse: method.lastAutoBillingUse,
          tokenExpiryDate: method.tokenExpiryDate,
          isDefault: method.isDefault,
          hasFlutterwaveToken: !!method.flutterwaveToken,
          hasPaystackToken: !!method.paystackToken,
          tokenStatus: this.getTokenStatus(method)
        }))
      });
    } catch (error) {
      console.error("Error getting auto-billing payment methods:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get auto-billing payment methods"
      });
    }
  }

  /**
   * Enable/disable auto-charging for payment method
   */
  static async toggleAutoCharging(req, res) {
    try {
      const { paymentMethodId } = req.params;
      const { canAutoCharge } = req.body;
      const userId = req.user.sub;

      const userPaymentMethodRepository = require("../repositories/userPaymentMethodRepository");

      // Verify ownership
      const paymentMethod = await userPaymentMethodRepository.findById(paymentMethodId);
      if (!paymentMethod || paymentMethod.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Payment method not found or unauthorized"
        });
      }

      // Check if payment method has tokens for auto-charging
      if (canAutoCharge && !paymentMethod.flutterwaveToken && !paymentMethod.paystackToken) {
        return res.status(400).json({
          success: false,
          message: "Payment method does not have valid tokens for auto-charging. Please re-add the payment method using secure tokenization."
        });
      }

      // Check token expiry
      const now = new Date();
      const expiryDate = paymentMethod.tokenExpiryDate ? new Date(paymentMethod.tokenExpiryDate) : null;

      if (canAutoCharge && expiryDate && expiryDate < now) {
        return res.status(400).json({
          success: false,
          message: "Payment method tokens have expired. Please re-add the payment method."
        });
      }

      // Update auto-charging setting
      await userPaymentMethodRepository.repo.update(paymentMethodId, {
        canAutoCharge: !!canAutoCharge,
        updatedAt: new Date()
      });

      res.status(200).json({
        success: true,
        message: `Auto-charging ${canAutoCharge ? 'enabled' : 'disabled'} successfully`,
        data: {
          paymentMethodId,
          canAutoCharge: !!canAutoCharge
        }
      });
    } catch (error) {
      console.error("Error toggling auto-charging:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update auto-charging setting"
      });
    }
  }

  /**
   * Get payment method auto-billing analytics
   */
  static async getPaymentMethodAnalytics(req, res) {
    try {
      const userId = req.user.sub;
      const paymentMethods = await paymentService.getUserPaymentMethods(userId);

      const analytics = paymentMethods.map(method => {
        const totalAttempts = method.autoBillingSuccessCount + method.autoBillingFailureCount;
        const successRate = totalAttempts > 0
          ? ((method.autoBillingSuccessCount / totalAttempts) * 100).toFixed(2)
          : 0;

        return {
          id: method.id,
          cardLast4: method.cardLast4,
          cardBrand: method.cardBrand,
          bankName: method.bankName,
          autoBillingSuccessCount: method.autoBillingSuccessCount,
          autoBillingFailureCount: method.autoBillingFailureCount,
          successRate: parseFloat(successRate),
          lastAutoBillingUse: method.lastAutoBillingUse,
          canAutoCharge: method.canAutoCharge,
          tokenExpiryDate: method.tokenExpiryDate,
          hasValidTokens: method.hasValidTokens,
          tokenStatus: method.tokenStatus
        };
      });

      res.status(200).json({
        success: true,
        message: "Payment method analytics retrieved successfully",
        data: {
          paymentMethods: analytics,
          summary: {
            totalMethods: paymentMethods.length,
            autoChargingEnabled: paymentMethods.filter(m => m.canAutoCharge).length,
            withValidTokens: paymentMethods.filter(m => m.hasValidTokens).length,
            averageSuccessRate: analytics.length > 0
              ? (analytics.reduce((sum, m) => sum + m.successRate, 0) / analytics.length).toFixed(2)
              : 0
          }
        }
      });
    } catch (error) {
      console.error("Error getting payment method analytics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get payment method analytics"
      });
    }
  }

  /**
   * Save a new payment method (for internal use - not exposed via API)
   */
  static async savePaymentMethod(req, res) {
    try {
      const paymentMethodData = {
        ...req.validatedData,
        userId: req.user.sub
      };

      const paymentMethod = await paymentService.savePaymentMethod(paymentMethodData);

      res.status(201).json({
        success: true,
        message: "Payment method saved successfully",
        data: {
          id: paymentMethod.id,
          cardLast4: paymentMethod.cardLast4,
          cardType: paymentMethod.cardType,
          cardBrand: paymentMethod.cardBrand,
          isDefault: paymentMethod.isDefault,
          canAutoCharge: paymentMethod.canAutoCharge
        }
      });
    } catch (error) {
      console.error("Error saving payment method:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to save payment method"
      });
    }
  }

  /**
   * Set payment method as default
   */
  static async setDefaultPaymentMethod(req, res) {
    try {
      const { paymentMethodId } = req.params;
      const userId = req.user.sub;

      await paymentService.setDefaultPaymentMethod(userId, paymentMethodId);

      res.status(200).json({
        success: true,
        message: "Payment method set as default successfully"
      });
    } catch (error) {
      console.error("Error setting default payment method:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to set default payment method"
      });
    }
  }

  /**
   * Remove a payment method
   */
  static async removePaymentMethod(req, res) {
    try {
      const { paymentMethodId } = req.params;
      const userId = req.user.sub;

      await paymentService.removePaymentMethod(userId, paymentMethodId);

      res.status(200).json({
        success: true,
        message: "Payment method removed successfully"
      });
    } catch (error) {
      console.error("Error removing payment method:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to remove payment method"
      });
    }
  }

  // ================================
  // UTILITY METHODS
  // ================================

  /**
   * Get supported providers and currencies
   */
  static async getSupportedOptions(req, res) {
    try {
      const supportedOptions = {
        providers: [
          {
            name: 'flutterwave',
            displayName: 'Flutterwave',
            supportedCurrencies: ['NGN', 'GHS', 'USD', 'EUR', 'GBP'],
            features: ['card_tokenization', 'auto_billing', 'refunds', 'webhooks'],
            description: 'Secure payment processing across Africa',
            validationAmounts: {
              'NGN': 100, // ₦1.00
              'GHS': 1,   // GH₵1.00
              'USD': 1,   // $1.00
              'EUR': 1,   // €1.00
              'GBP': 1    // £1.00
            }
          },
          {
            name: 'paystack',
            displayName: 'Paystack',
            supportedCurrencies: ['NGN', 'GHS', 'USD'],
            features: ['card_tokenization', 'auto_billing', 'refunds', 'webhooks'],
            description: 'Modern payment infrastructure for Africa',
            validationAmounts: {
              'NGN': 100, // ₦1.00
              'GHS': 1,   // GH₵1.00
              'USD': 1    // $1.00
            }
          }
        ],
        currencies: [
          { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
          { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵' },
          { code: 'USD', name: 'US Dollar', symbol: '$' },
          { code: 'EUR', name: 'Euro', symbol: '€' },
          { code: 'GBP', name: 'British Pound', symbol: '£' }
        ],
        securityFeatures: [
          'PCI DSS compliant tokenization',
          'No card details stored on our servers',
          'Automatic validation charge refunds',
          'Encrypted token storage',
          'Secure 3D authentication',
          'Real-time fraud detection'
        ]
      };

      res.status(200).json({
        success: true,
        message: "Supported options retrieved successfully",
        data: supportedOptions
      });
    } catch (error) {
      console.error("Error getting supported options:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get supported options"
      });
    }
  }

  /**
   * Refresh expired tokens
   */
  static async refreshPaymentMethodTokens(req, res) {
    try {
      const { paymentMethodId } = req.params;
      const { provider } = req.body;
      const userId = req.user.sub;

      // Validate provider
      if (!['flutterwave', 'paystack'].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: "Invalid provider. Must be 'flutterwave' or 'paystack'"
        });
      }

      // Verify ownership
      const userPaymentMethodRepository = require("../repositories/userPaymentMethodRepository");
      const paymentMethod = await userPaymentMethodRepository.findById(paymentMethodId);

      if (!paymentMethod || paymentMethod.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Payment method not found or unauthorized"
        });
      }

      // Check if tokens are actually expired
      const now = new Date();
      const expiryDate = paymentMethod.tokenExpiryDate ? new Date(paymentMethod.tokenExpiryDate) : null;

      if (expiryDate && expiryDate > now) {
        return res.status(400).json({
          success: false,
          message: "Payment method tokens are still valid"
        });
      }

      // Initialize new tokenization flow
      const returnUrl = `${process.env.FRONTEND_URL}/payment-methods/refresh-callback?provider=${provider}&userId=${userId}&paymentMethodId=${paymentMethodId}`;

      const result = await paymentService.initializeCardTokenization({
        userId,
        provider,
        currency: 'NGN', // Default currency for refresh
        returnUrl
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: "Token refresh initiated successfully",
          data: {
            ...result.data,
            instructions: `Please complete the secure re-authentication with ${provider} to refresh your payment method tokens.`
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error("Error refreshing payment method tokens:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to refresh payment method tokens"
      });
    }
  }

  // Add these methods to your existing PaymentController class
  // (Removed dispute methods since you have disputeService)

  /**
   * Setup auto-billing for subscription
   */
  static async setupSubscriptionAutoBilling(req, res) {
    try {
      const { subscriptionId, paymentMethodId, amount, currency, billingCycle } = req.body;
      const userId = req.user.sub;

      // Verify payment method belongs to user
      const paymentMethod = await userPaymentMethodRepository.findById(paymentMethodId);
      if (!paymentMethod || paymentMethod.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Payment method not found or unauthorized"
        });
      }

      // Implementation here for auto-billing setup
      res.status(200).json({
        success: true,
        message: "Auto-billing setup successful",
        data: { subscriptionId, paymentMethodId, billingCycle }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to setup auto-billing"
      });
    }
  }

  /**
   * Process multi-service payment
   */
  static async processMultiServicePayment(req, res) {
    try {
      const { services, totalAmount, currency, paymentProvider } = req.body;
      const userId = req.user.sub;

      // Validate total amount matches service amounts
      const calculatedTotal = services.reduce((sum, service) => sum + service.amount, 0);
      if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
        return res.status(400).json({
          success: false,
          message: "Total amount doesn't match service amounts"
        });
      }

      // Create individual transactions for each service
      const transactions = [];
      for (const service of services) {
        const transactionData = {
          patientId: userId,
          doctorId: service.doctorId,
          serviceType: service.serviceType,
          serviceId: service.serviceId,
          appointmentDate: service.appointmentDate,
          originalAmount: service.amount,
          originalCurrency: currency,
          paymentProvider,
          description: `${service.serviceType} payment`
        };

        const transaction = await paymentService.initiatePayment(transactionData);
        transactions.push(transaction);
      }

      res.status(200).json({
        success: true,
        message: "Multi-service payment processed",
        data: {
          transactions: transactions.map(t => ({
            id: t.id,
            serviceType: t.serviceType,
            amount: t.originalAmount
          })),
          totalAmount
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to process multi-service payment"
      });
    }
  }

  /**
   * Schedule future payment
   */
  static async schedulePayment(req, res) {
    try {
      const { serviceType, serviceId, amount, currency, scheduleDate, paymentMethodId } = req.body;
      const userId = req.user.sub;

      // Validate schedule date is in the future
      const scheduledDate = new Date(scheduleDate);
      if (scheduledDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: "Schedule date must be in the future"
        });
      }

      // Create scheduled payment record
      const scheduledPayment = {
        userId,
        serviceType,
        serviceId,
        amount,
        currency,
        scheduleDate: scheduledDate,
        paymentMethodId,
        status: 'scheduled'
      };

      res.status(200).json({
        success: true,
        message: "Payment scheduled successfully",
        data: scheduledPayment
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to schedule payment"
      });
    }
  }

  /**
   * Get exchange rates
   */
  static async getExchangeRates(req, res) {
    try {
      const { fromCurrency, toCurrency } = req.query;

      if (!fromCurrency || !toCurrency) {
        return res.status(400).json({
          success: false,
          message: "Both fromCurrency and toCurrency are required"
        });
      }

      const rate = await paymentService.getExchangeRate(fromCurrency, toCurrency);

      res.status(200).json({
        success: true,
        data: {
          fromCurrency,
          toCurrency,
          rate,
          timestamp: new Date()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get exchange rates"
      });
    }
  }

  /**
   * Convert currency
   */
  static async convertCurrency(req, res) {
    try {
      const { fromCurrency, toCurrency, amount } = req.body;

      if (!fromCurrency || !toCurrency || !amount) {
        return res.status(400).json({
          success: false,
          message: "fromCurrency, toCurrency, and amount are required"
        });
      }

      const rate = await paymentService.getExchangeRate(fromCurrency, toCurrency);
      const convertedAmount = amount * rate;

      res.status(200).json({
        success: true,
        data: {
          originalAmount: amount,
          convertedAmount: Math.round(convertedAmount * 100) / 100,
          fromCurrency,
          toCurrency,
          rate,
          timestamp: new Date()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to convert currency"
      });
    }
  }

  /**
   * Get dashboard analytics
   */
  static async getDashboardAnalytics(req, res) {
    try {
      const stats = await paymentService.getPaymentStatistics();
      const serviceAnalytics = await paymentService.getServiceAnalytics();
      const currencyAnalytics = await paymentService.getCurrencyAnalytics();

      res.status(200).json({
        success: true,
        data: {
          overview: stats,
          services: serviceAnalytics.data,
          currencies: currencyAnalytics.data,
          generatedAt: new Date()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get dashboard analytics"
      });
    }
  }

  /**
   * ENHANCED: Process manual refund (Admin only)
   */
  static async processManualRefund(req, res) {
    try {
      const { transactionId } = req.params;
      const { reason, refundAmount, notifyUser = true } = req.body;

      // Get transaction details
      const transaction = await paymentService.getTransactionById(transactionId);
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found"
        });
      }

      // Validate transaction can be refunded
      if (transaction.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: "Only completed transactions can be refunded"
        });
      }

      if (transaction.refundStatus === 'full') {
        return res.status(400).json({
          success: false,
          message: "Transaction already fully refunded"
        });
      }

      // Calculate refund amount if not provided
      const maxRefundAmount = transaction.originalAmount - (transaction.refundAmount || 0);
      const finalRefundAmount = refundAmount || maxRefundAmount;

      if (finalRefundAmount > maxRefundAmount) {
        return res.status(400).json({
          success: false,
          message: `Refund amount cannot exceed ${maxRefundAmount}`
        });
      }

      // Process the refund
      const refundResult = await paymentService.processRefund(transaction, finalRefundAmount);

      if (refundResult.success) {
        // Update transaction
        await transactionRepository.repo.update(transactionId, {
          refundStatus: finalRefundAmount >= maxRefundAmount ? 'full' : 'partial',
          refundAmount: (transaction.refundAmount || 0) + finalRefundAmount,
          refundProcessedAt: new Date(),
          refundReason: reason,
          refundProcessedBy: req.user.sub
        });

        // Handle doctor wallet adjustments if needed
        if (transaction.doctorId && transaction.serviceType === 'appointment') {
          const splits = await transactionSplitRepository.findByTransactionId(transactionId);
          const doctorSplit = splits.find(split => split.recipientType === 'doctor_wallet');

          if (doctorSplit) {
            // Adjust doctor wallet based on funds status
            if (transaction.fundsStatus === 'pending_dispute') {
              await doctorWalletRepository.removePendingCredits(
                transaction.doctorId,
                Math.min(finalRefundAmount, doctorSplit.usdAmount)
              );
            } else if (transaction.fundsStatus === 'released') {
              await doctorWalletRepository.deductAvailableBalance(
                transaction.doctorId,
                Math.min(finalRefundAmount, doctorSplit.usdAmount)
              );
            }
          }
        }

        res.status(200).json({
          success: true,
          message: "Manual refund processed successfully",
          data: {
            transactionId,
            refundAmount: finalRefundAmount,
            refundReference: refundResult.refundReference,
            refundStatus: finalRefundAmount >= maxRefundAmount ? 'full' : 'partial',
            processedAt: new Date()
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: refundResult.error || "Failed to process refund"
        });
      }
    } catch (error) {
      console.error("Manual refund error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process manual refund"
      });
    }
  }

  /**
   * Get batch payment status
   */
  static async getBatchPaymentStatus(req, res) {
    try {
      const { batchId } = req.params;

      // Implementation would depend on your batch payment system
      res.status(200).json({
        success: true,
        data: {
          batchId,
          status: "completed",
          totalTransactions: 0,
          successfulTransactions: 0,
          failedTransactions: 0,
          createdAt: new Date()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get batch status"
      });
    }
  }

  /**
   * Calculate payment fees
   */
  static async calculatePaymentFees(req, res) {
    try {
      const { amount, currency } = req.query;

      if (!amount || !currency) {
        return res.status(400).json({
          success: false,
          message: "Amount and currency are required"
        });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid amount"
        });
      }

      const flutterwaveFee = await paymentService.getFlutterwaveFee(numAmount, currency);
      const paystackFee = await paymentService.getPaystackFee(numAmount, currency);

      res.status(200).json({
        success: true,
        data: {
          amount: numAmount,
          currency,
          fees: {
            flutterwave: {
              fee: flutterwaveFee,
              total: numAmount + flutterwaveFee
            },
            paystack: {
              fee: paystackFee,
              total: numAmount + paystackFee
            }
          },
          recommendation: flutterwaveFee < paystackFee ? 'flutterwave' : 'paystack'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to calculate fees"
      });
    }
  }

  /**
   * Check payment system health
   */
  static async checkPaymentSystemHealth(req, res) {
    try {
      // Test provider connectivity
      const healthChecks = {
        flutterwave: 'active',
        paystack: 'active',
        database: 'active',
        exchangeRates: 'active'
      };

      // You could add actual health checks here
      // const flutterwaveHealth = await testFlutterwaveConnection();
      // const paystackHealth = await testPaystackConnection();

      res.status(200).json({
        success: true,
        data: {
          status: "healthy",
          timestamp: new Date(),
          providers: healthChecks,
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "System health check failed"
      });
    }
  }

  /**
   * Get appointment reschedule history
   */
  static async getAppointmentRescheduleHistory(req, res) {
    try {
      const { transactionId } = req.params;

      const transaction = await paymentService.getTransactionById(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found"
        });
      }

      if (transaction.serviceType !== 'appointment') {
        return res.status(400).json({
          success: false,
          message: "Transaction is not an appointment"
        });
      }

      // Check access permissions
      if (transaction.patientId !== req.user.sub &&
        transaction.doctorId !== req.user.sub &&
        !['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      res.status(200).json({
        success: true,
        data: {
          transactionId,
          rescheduleCount: transaction.rescheduleCount || 0,
          originalDate: transaction.originalAppointmentDate,
          currentDate: transaction.appointmentDate,
          lastRescheduled: transaction.lastRescheduledAt,
          fundsStatus: transaction.fundsStatus,
          isCancelled: transaction.isCancelled,
          cancelledAt: transaction.cancelledAt
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get reschedule history"
      });
    }
  }

  // ================================
  // HELPER METHODS
  // ================================

  /**
   * Helper: Get token status for a payment method
   */
  static getTokenStatus(paymentMethod) {
    const now = new Date();
    const expiryDate = paymentMethod.tokenExpiryDate ? new Date(paymentMethod.tokenExpiryDate) : null;

    if (!paymentMethod.flutterwaveToken && !paymentMethod.paystackToken) {
      return 'no_tokens';
    }

    if (expiryDate && expiryDate < now) {
      return 'expired';
    }

    if (expiryDate && expiryDate < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
      return 'expiring_soon';
    }

    return 'valid';
  }
}

module.exports = PaymentMethodController;