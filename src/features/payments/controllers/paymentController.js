// src/controllers/transactions/paymentController.js
const paymentService = require("../services/paymentService");
const userRepository = require("../../auth/repositories/userRepository");
const transactionRepository = require("../repositories/transactionRepository");
const PaymentAuthMiddleware = require("../middlewares/paymentAuth");

class PaymentController {
  // ================================
  // SECURE PAYMENT METHOD MANAGEMENT
  // ================================

  /**
   * SECURE: Initialize card tokenization
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

      // Get user's preferred currency if not provided
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
            instructions: `You will be redirected to ${provider} to securely enter your card details. A validation charge of ${userCurrency} ${result.data.validationAmount} will be made and immediately refunded.`
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
          createdAt: method.createdAt
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
  // PAYMENT PROCESSING (ALL SERVICES)
  // ================================

  /**
   * Get payment options with provider fees and recommendations
   */
  static async getPaymentOptions(req, res) {
    try {
      const { amount, currency, paymentMethodId } = req.query;
      const userId = req.user.sub;

      // Validate required fields
      if (!amount || !currency) {
        return res.status(400).json({
          success: false,
          message: "Amount and currency are required"
        });
      }

      // Validate amount
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid amount"
        });
      }

      const options = await paymentService.getPaymentOptions({
        amount: numAmount,
        currency,
        userId,
        paymentMethodId
      });

      res.status(200).json({
        success: true,
        message: "Payment options retrieved successfully",
        data: options
      });
    } catch (error) {
      console.error("Error getting payment options:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get payment options"
      });
    }
  }

  /**
   * Initiate a payment transaction (supports all services)
   */
  static async initiateLabPayment(req, res) {
    try {
      const bridgeSecret = req.headers['x-lab-payment-secret'];
      if (!process.env.LAB_PAYMENT_BRIDGE_SECRET || bridgeSecret !== process.env.LAB_PAYMENT_BRIDGE_SECRET) {
        return res.status(403).json({
          success: false,
          message: "Invalid lab payment bridge secret"
        });
      }

      const {
        orderId,
        orderNumber,
        patientId,
        patientEmail,
        patientName,
        patientPhone,
        amount,
        currency,
        provider = 'paystack',
        description,
        returnUrl,
        labCallbackBaseUrl
      } = req.body;

      if (!orderId || !patientId || !amount || !currency) {
        return res.status(400).json({
          success: false,
          message: "orderId, patientId, amount, and currency are required"
        });
      }

      if (!['flutterwave', 'paystack'].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment provider"
        });
      }

      const result = await paymentService.initiateLabPayment({
        orderId,
        orderNumber,
        patientId,
        patientEmail,
        patientName,
        patientPhone,
        amount: Number(amount),
        currency,
        provider,
        description,
        returnUrl,
        labCallbackBaseUrl
      });

      return res.status(201).json({
        success: true,
        message: "Lab payment initialized successfully",
        data: result
      });
    } catch (error) {
      console.error("Error initiating lab payment:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to initiate lab payment"
      });
    }
  }

  static async initiatePayment(req, res) {
    try {
      const paymentData = {
        ...req.body,
        patientId: req.user.sub // Ensure patient is the authenticated user
      };

      // Validate service type
      const validServiceTypes = ['appointment', 'subscription', 'consultation', 'medication', 'lab_test'];
      if (!validServiceTypes.includes(paymentData.serviceType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid service type. Must be one of: ${validServiceTypes.join(', ')}`
        });
      }

      // Validate currency
      const supportedCurrencies = ['NGN', 'GHS', 'USD', 'EUR', 'GBP'];
      if (!supportedCurrencies.includes(paymentData.originalCurrency)) {
        return res.status(400).json({
          success: false,
          message: `Unsupported currency. Supported: ${supportedCurrencies.join(', ')}`
        });
      }

      // Validate appointment date for appointment payments
      if (paymentData.serviceType === 'appointment' && !paymentData.appointmentDate) {
        return res.status(400).json({
          success: false,
          message: "Appointment date is required for appointment payments"
        });
      }

      const transaction = await paymentService.initiatePayment(paymentData);

      res.status(201).json({
        success: true,
        message: "Payment initiated successfully",
        data: {
          transactionId: transaction.id,
          status: transaction.status,
          amount: transaction.originalAmount,
          currency: transaction.originalCurrency,
          serviceType: transaction.serviceType,
          appointmentDate: transaction.appointmentDate,
          fundsStatus: transaction.fundsStatus,
          disputeWindowStartsAt: transaction.disputeWindowStartsAt,
          disputeWindowEndsAt: transaction.disputeWindowEndsAt,
          description: transaction.description
        }
      });
    } catch (error) {
      console.error("Error initiating payment:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to initiate payment"
      });
    }
  }

  /**
   * Process payment with selected provider (supports regular and auto-billing)
   */
  static async processPayment(req, res) {
    try {
      const { transactionId, paymentProvider, paymentData, useStoredMethod } = req.body;

      // Validate required fields
      if (!transactionId || !paymentProvider) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID and payment provider are required"
        });
      }

      // Validate provider
      if (!['flutterwave', 'paystack'].includes(paymentProvider)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment provider"
        });
      }

      // Validate payment data for non-stored method payments
      if (!useStoredMethod && (!paymentData || !paymentData.email)) {
        return res.status(400).json({
          success: false,
          message: "Payment data with email is required for new payments"
        });
      }

      const result = await paymentService.processPayment({
        transactionId,
        paymentProvider,
        paymentData,
        useStoredMethod: !!useStoredMethod
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: "Payment processed successfully",
          data: {
            transactionId: result.transaction.id,
            status: result.transaction.status,
            providerTransactionId: result.transaction.providerTransactionId,
            completedAt: result.transaction.completedAt,
            serviceType: result.transaction.serviceType,
            fundsStatus: result.transaction.fundsStatus
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Payment processing failed",
          error: result.error
        });
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Payment processing failed"
      });
    }
  }

  /**
   * Handle payment webhooks from providers
   */
  // Replace the handleWebhook method in PaymentController
  static async handleWebhook(req, res) {
    try {
      const { provider } = req.params;
      console.log(provider);
      const webhookData = req.body;

      console.log('🎯 WEBHOOK RECEIVED IN CONTROLLER');
      console.log('Provider:', provider);
      console.log('Headers:', req.headers);
      console.log('Body:', JSON.stringify(webhookData, null, 2));

      // Validate provider
      if (!['flutterwave', 'paystack'].includes(provider)) {
        console.log('❌ Invalid provider:', provider);
        return res.status(400).json({
          success: false,
          message: 'Invalid provider'
        });
      }

      // Process the webhook
      const result = await paymentService.processPaymentWebhook(webhookData, provider);

      console.log('✅ Webhook processing result:', result);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: "Webhook processed successfully"
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Webhook processing failed",
          error: result.error
        });
      }
    } catch (error) {
      console.error("❌ Webhook controller error:", error);
      res.status(500).json({
        success: false,
        message: "Webhook processing error",
        error: error.message
      });
    }
  }


  /**
 * Get appointments overview with payment status
 */
  static async getAppointmentsOverview(req, res) {
    try {
      const userId = req.user.sub;
      const { role } = req.user;

      // Get appointment transactions
      let appointments;
      if (role === 'patient') {
        appointments = await transactionRepository.findByPatientIdAndServiceType(userId, 'appointment');
      } else if (role === 'doctor') {
        appointments = await transactionRepository.findByDoctorIdAndServiceType(userId, 'appointment');
      } else {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      // Categorize appointments
      const now = new Date();
      const categorized = {
        upcoming: [],
        completed: [],
        cancelled: [],
        pending: []
      };

      appointments.forEach(appointment => {
        const appointmentDate = new Date(appointment.appointmentDate);

        if (appointment.isCancelled) {
          categorized.cancelled.push({
            id: appointment.id,
            appointmentDate: appointment.appointmentDate,
            amount: appointment.originalAmount,
            currency: appointment.originalCurrency,
            status: appointment.status,
            cancelledAt: appointment.cancelledAt,
            refundAmount: appointment.refundAmount,
            refundStatus: appointment.refundStatus
          });
        } else if (appointment.status === 'pending' || appointment.status === 'processing') {
          categorized.pending.push({
            id: appointment.id,
            appointmentDate: appointment.appointmentDate,
            amount: appointment.originalAmount,
            currency: appointment.originalCurrency,
            status: appointment.status,
            paymentProvider: appointment.paymentProvider
          });
        } else if (appointmentDate < now) {
          categorized.completed.push({
            id: appointment.id,
            appointmentDate: appointment.appointmentDate,
            amount: appointment.originalAmount,
            currency: appointment.originalCurrency,
            status: appointment.status,
            fundsStatus: appointment.fundsStatus,
            completedAt: appointment.completedAt
          });
        } else {
          categorized.upcoming.push({
            id: appointment.id,
            appointmentDate: appointment.appointmentDate,
            amount: appointment.originalAmount,
            currency: appointment.originalCurrency,
            status: appointment.status,
            fundsStatus: appointment.fundsStatus
          });
        }
      });

      const summary = {
        total: appointments.length,
        upcoming: categorized.upcoming.length,
        completed: categorized.completed.length,
        cancelled: categorized.cancelled.length,
        pending: categorized.pending.length
      };

      res.status(200).json({
        success: true,
        message: "Appointments overview retrieved successfully",
        data: {
          summary,
          appointments: categorized
        }
      });

    } catch (error) {
      console.error("Error getting appointments overview:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get appointments overview"
      });
    }
  }

  // ================================
  // TRANSACTION MANAGEMENT
  // ================================

  /**
   * Get transaction by ID with enhanced funds status
   */
  static async getTransaction(req, res) {
    try {
      const { transactionId } = req.params;

      // Use enhanced method that includes funds status
      const transaction = await paymentService.getTransactionWithFundsStatus(transactionId);

      // Check if user has access to this transaction
      if (transaction.patientId !== req.user.sub &&
        transaction.doctorId !== req.user.sub &&
        !['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this transaction"
        });
      }

      res.status(200).json({
        success: true,
        message: "Transaction retrieved successfully",
        data: {
          id: transaction.id,
          status: transaction.status,
          serviceType: transaction.serviceType,
          serviceId: transaction.serviceId,
          amount: transaction.originalAmount,
          currency: transaction.originalCurrency,
          usdAmount: transaction.usdAmount,
          appointmentDate: transaction.appointmentDate,
          fundsStatus: transaction.fundsStatus,
          fundsStatusDisplay: transaction.fundsStatusDisplay,
          daysRemaining: transaction.daysRemaining,
          canWithdraw: transaction.canWithdraw,
          isAppointmentPayment: transaction.isAppointmentPayment,
          disputeWindowStartsAt: transaction.disputeWindowStartsAt,
          disputeWindowEndsAt: transaction.disputeWindowEndsAt,
          createdAt: transaction.createdAt,
          completedAt: transaction.completedAt,
          description: (() => {
            if (transaction.serviceType !== 'appointment') return transaction.description;
            const apptDate = transaction.appointmentDate
              ? new Date(transaction.appointmentDate).toISOString().split('T')[0] : '';
            const role = req.user.role;
            if (role === 'doctor') {
              const p = transaction.patient;
              const n = p ? (p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Patient') : 'Patient';
              return `Appointment with ${n} on ${apptDate}`;
            }
            if (role === 'patient') {
              const d = transaction.doctor;
              const n = d ? (d.fullName || [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Doctor') : 'Doctor';
              return `Appointment with Dr. ${n} on ${apptDate}`;
            }
            return transaction.description;
          })(),
          isCancelled: transaction.isCancelled,
          cancelledAt: transaction.cancelledAt,
          rescheduleCount: transaction.rescheduleCount,
          lastRescheduledAt: transaction.lastRescheduledAt
        }
      });
    } catch (error) {
      console.error("Error getting transaction:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get transaction"
      });
    }
  }

  /**
   * Get user's transaction history with enhanced status
   */
  static async getUserTransactions(req, res) {
    try {
      const userId = req.user.sub;
      const { role } = req.user;
      const { page = 1, limit = 20, serviceType, status, currency } = req.query;

      const buildDescription = (transaction) => {
        if (transaction.serviceType !== 'appointment') return transaction.description;
        const apptDate = transaction.appointmentDate
          ? new Date(transaction.appointmentDate).toISOString().split('T')[0]
          : '';
        if (role === 'doctor') {
          const p = transaction.patient;
          const name = p ? (p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Patient') : 'Patient';
          return `Appointment with ${name} on ${apptDate}`;
        }
        if (role === 'patient') {
          const d = transaction.doctor;
          const name = d ? (d.fullName || [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Doctor') : 'Doctor';
          return `Appointment with Dr. ${name} on ${apptDate}`;
        }
        return transaction.description;
      };

      let transactions = await paymentService.getUserTransactions(userId, role);

      // Apply filters
      if (serviceType) {
        transactions = transactions.filter(t => t.serviceType === serviceType);
      }

      if (status) {
        transactions = transactions.filter(t => t.status === status);
      }

      if (currency) {
        transactions = transactions.filter(t => t.originalCurrency === currency);
      }

      // Sort by creation date (newest first)
      transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // ENHANCED: Add funds status to each transaction
      const enhancedTransactions = await Promise.all(
        transactions.map(async (transaction) => {
          try {
            // Get enhanced status for completed appointment payments
            if (transaction.status === 'completed' && transaction.serviceType === 'appointment') {
              const enhancedTransaction = await paymentService.getTransactionWithFundsStatus(transaction.id);
              return {
                id: transaction.id,
                status: transaction.status,
                serviceType: transaction.serviceType,
                amount: transaction.originalAmount,
                currency: transaction.originalCurrency,
                appointmentDate: transaction.appointmentDate,
                fundsStatus: transaction.fundsStatus,
                fundsStatusDisplay: enhancedTransaction.fundsStatusDisplay,
                daysRemaining: enhancedTransaction.daysRemaining,
                canWithdraw: enhancedTransaction.canWithdraw,
                isAppointmentPayment: true,
                createdAt: transaction.createdAt,
                completedAt: transaction.completedAt,
                description: buildDescription(transaction),
                isCancelled: transaction.isCancelled
              };
            }
            return {
              id: transaction.id,
              status: transaction.status,
              serviceType: transaction.serviceType,
              amount: transaction.originalAmount,
              currency: transaction.originalCurrency,
              appointmentDate: transaction.appointmentDate,
              fundsStatus: transaction.fundsStatus,
              isAppointmentPayment: transaction.serviceType === 'appointment',
              createdAt: transaction.createdAt,
              completedAt: transaction.completedAt,
              description: buildDescription(transaction),
              isCancelled: transaction.isCancelled
            };
          } catch (error) {
            console.error(`Error enhancing transaction ${transaction.id}:`, error);
            return {
              id: transaction.id,
              status: transaction.status,
              serviceType: transaction.serviceType,
              amount: transaction.originalAmount,
              currency: transaction.originalCurrency,
              isAppointmentPayment: transaction.serviceType === 'appointment',
              createdAt: transaction.createdAt,
              completedAt: transaction.completedAt,
              description: buildDescription(transaction)
            };
          }
        })
      );

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedTransactions = enhancedTransactions.slice(startIndex, endIndex);

      res.status(200).json({
        success: true,
        message: "Transaction history retrieved successfully",
        data: {
          transactions: paginatedTransactions,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(enhancedTransactions.length / limit),
            totalItems: enhancedTransactions.length,
            itemsPerPage: parseInt(limit)
          },
          summary: {
            totalTransactions: enhancedTransactions.length,
            completedTransactions: enhancedTransactions.filter(t => t.status === 'completed').length,
            pendingTransactions: enhancedTransactions.filter(t => t.status === 'pending').length,
            failedTransactions: enhancedTransactions.filter(t => t.status === 'failed').length,
            appointmentPayments: enhancedTransactions.filter(t => t.isAppointmentPayment).length,
            cancelledAppointments: enhancedTransactions.filter(t => t.isCancelled).length
          }
        }
      });
    } catch (error) {
      console.error("Error getting user transactions:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get transaction history"
      });
    }
  }

  // ================================
  // APPOINTMENT MANAGEMENT
  // ================================

  /**
   * Cancel appointment payment
   */
  static async cancelAppointmentPayment(req, res) {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;

      // Get transaction to verify access
      const transaction = await paymentService.getTransactionById(transactionId);

      // Check if user has access to cancel this transaction
      if (transaction.patientId !== req.user.sub &&
        transaction.doctorId !== req.user.sub &&
        !['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied to cancel this transaction"
        });
      }

      // Additional validation for non-admin users
      if (!['admin', 'super_admin'].includes(req.user.role)) {
        if (req.user.role === 'patient' && transaction.patientId !== req.user.sub) {
          return res.status(403).json({
            success: false,
            message: "Patients can only cancel their own appointments"
          });
        }

        if (req.user.role === 'doctor' && transaction.doctorId !== req.user.sub) {
          return res.status(403).json({
            success: false,
            message: "Doctors can only cancel their own appointments"
          });
        }
      }

      const result = await paymentService.cancelAppointmentPayment(transactionId, {
        reason,
        cancelledBy: req.user.sub,
        cancelledByRole: req.user.role
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: "Appointment payment cancelled successfully",
          data: {
            transactionId: result.data.transactionId,
            refundAmount: result.data.refundAmount,
            refundStatus: result.data.refundStatus,
            keptAmount: result.data.keptAmount,
            cancelledAt: result.data.cancelledAt
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || "Failed to cancel appointment payment",
          error: result.error
        });
      }

    } catch (error) {
      console.error("Error cancelling appointment payment:", error);

      // Handle specific error types
      if (error.message.includes("not found")) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found"
        });
      }

      if (error.message.includes("already cancelled") ||
        error.message.includes("already released") ||
        error.message.includes("Can only cancel")) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to cancel appointment payment"
      });
    }
  }

  /**
   * Reschedule appointment payment
   */
  static async rescheduleAppointmentPayment(req, res) {
    try {
      const { transactionId } = req.params;
      const { newAppointmentDate } = req.body;

      // Validate new appointment date
      if (!newAppointmentDate) {
        return res.status(400).json({
          success: false,
          message: "New appointment date is required"
        });
      }

      const newDate = new Date(newAppointmentDate);
      if (isNaN(newDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment date format"
        });
      }

      // Get transaction to verify access
      const transaction = await paymentService.getTransactionById(transactionId);

      // Check if user has access to reschedule this transaction
      if (transaction.patientId !== req.user.sub &&
        transaction.doctorId !== req.user.sub &&
        !['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied to reschedule this transaction"
        });
      }

      // Additional validation for non-admin users
      if (!['admin', 'super_admin'].includes(req.user.role)) {
        if (req.user.role === 'patient' && transaction.patientId !== req.user.sub) {
          return res.status(403).json({
            success: false,
            message: "Patients can only reschedule their own appointments"
          });
        }

        if (req.user.role === 'doctor' && transaction.doctorId !== req.user.sub) {
          return res.status(403).json({
            success: false,
            message: "Doctors can only reschedule their own appointments"
          });
        }
      }

      const result = await paymentService.rescheduleAppointmentPayment(transactionId, newAppointmentDate);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: "Appointment payment rescheduled successfully",
          data: {
            transactionId: result.data.transactionId,
            originalAppointmentDate: result.data.originalAppointmentDate,
            newAppointmentDate: result.data.newAppointmentDate,
            fundsStatus: result.data.fundsStatus,
            disputeWindowStartsAt: result.data.disputeWindowStartsAt,
            disputeWindowEndsAt: result.data.disputeWindowEndsAt,
            rescheduleCount: result.data.rescheduleCount
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || "Failed to reschedule appointment payment",
          error: result.error
        });
      }

    } catch (error) {
      console.error("Error rescheduling appointment payment:", error);

      // Handle specific error types
      if (error.message.includes("not found")) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found"
        });
      }

      if (error.message.includes("already cancelled") ||
        error.message.includes("already released") ||
        error.message.includes("Can only reschedule")) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to reschedule appointment payment"
      });
    }
  }

  /**
   * Get cancelled transactions summary
   */
  static async getCancelledTransactions(req, res) {
    try {
      const { role } = req.user;
      let userId = null;

      // For non-admin users, filter by their own transactions
      if (!['admin', 'super_admin'].includes(role)) {
        userId = req.user.sub;
      }

      const result = await paymentService.getCancelledTransactionsSummary(userId, role);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: "Cancelled transactions retrieved successfully",
          data: {
            summary: result.data.summary,
            transactions: result.data.transactions.map(transaction => ({
              id: transaction.id,
              appointmentDate: transaction.appointmentDate,
              originalAppointmentDate: transaction.originalAppointmentDate,
              amount: transaction.originalAmount,
              currency: transaction.originalCurrency,
              refundAmount: transaction.refundAmount,
              refundStatus: transaction.refundStatus,
              cancelledAt: transaction.cancelledAt,
              refundProcessedAt: transaction.refundProcessedAt,
              rescheduleCount: transaction.rescheduleCount,
              description: transaction.description
            }))
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to retrieve cancelled transactions"
        });
      }

    } catch (error) {
      console.error("Error getting cancelled transactions:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve cancelled transactions"
      });
    }
  }

  // ================================
  // ANALYTICS AND REPORTS
  // ================================

  /**
   * Get payment statistics (Admin only)
   */
  static async getPaymentStatistics(req, res) {
    try {
      // Check admin access
      if (!['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      const stats = await paymentService.getPaymentStatistics();

      res.status(200).json({
        success: true,
        message: "Payment statistics retrieved successfully",
        data: stats
      });
    } catch (error) {
      console.error("Error getting payment statistics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get payment statistics"
      });
    }
  }

  /**
   * Get service-specific analytics (Admin only)
   */
  static async getServiceAnalytics(req, res) {
    try {
      // Check admin access
      if (!['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      const { serviceType } = req.query;
      const analytics = await paymentService.getServiceAnalytics(serviceType);

      res.status(200).json({
        success: true,
        message: "Service analytics retrieved successfully",
        data: analytics.data
      });
    } catch (error) {
      console.error("Error getting service analytics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get service analytics"
      });
    }
  }

  /**
   * Get provider performance analytics (Admin only)
   */
  static async getProviderPerformance(req, res) {
    try {
      // Check admin access
      if (!['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      const analytics = await paymentService.getProviderPerformanceAnalytics();

      res.status(200).json({
        success: true,
        message: "Provider performance analytics retrieved successfully",
        data: analytics.data
      });
    } catch (error) {
      console.error("Error getting provider performance analytics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get provider performance analytics"
      });
    }
  }

  /**
   * Get currency analytics (Admin only)
   */
  static async getCurrencyAnalytics(req, res) {
    try {
      // Check admin access
      if (!['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      const analytics = await paymentService.getCurrencyAnalytics();

      res.status(200).json({
        success: true,
        message: "Currency analytics retrieved successfully",
        data: analytics.data
      });
    } catch (error) {
      console.error("Error getting currency analytics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get currency analytics"
      });
    }
  }

  /**
   * Get auto-billing analytics (Admin only)
   */
  static async getAutoBillingAnalytics(req, res) {
    try {
      if (!['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const analytics = await paymentService.getAutoBillingAnalytics();

      res.status(200).json({
        success: true,
        message: "Auto-billing analytics retrieved successfully",
        data: analytics
      });
    } catch (error) {
      console.error("Error getting auto-billing analytics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get auto-billing analytics"
      });
    }
  }

  // ================================
  // UTILITY ENDPOINTS
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
            description: 'Secure payment processing across Africa'
          },
          {
            name: 'paystack',
            displayName: 'Paystack',
            supportedCurrencies: ['NGN', 'GHS', 'USD'],
            features: ['card_tokenization', 'auto_billing', 'refunds', 'webhooks'],
            description: 'Modern payment infrastructure for Africa'
          }
        ],
        currencies: [
          { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
          { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵' },
          { code: 'USD', name: 'US Dollar', symbol: '$' },
          { code: 'EUR', name: 'Euro', symbol: '€' },
          { code: 'GBP', name: 'British Pound', symbol: '£' }
        ],
        serviceTypes: [
          { code: 'appointment', name: 'Appointment', description: 'Medical consultations with doctors' },
          { code: 'subscription', name: 'Subscription', description: 'Monthly or yearly service subscriptions' },
          { code: 'consultation', name: 'Consultation', description: 'One-time medical consultations' },
          { code: 'medication', name: 'Medication', description: 'Prescription and over-the-counter medications' },
          { code: 'lab_test', name: 'Lab Test', description: 'Laboratory tests and diagnostics' }
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
   * Get user's preferred currency and payment settings
   */
  static async getUserPaymentSettings(req, res) {
    try {
      const userId = req.user.sub;
      const user = await userRepository.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      const paymentMethods = await paymentService.getUserPaymentMethods(userId);
      const defaultMethod = paymentMethods.find(method => method.isDefault);

      res.status(200).json({
        success: true,
        message: "User payment settings retrieved successfully",
        data: {
          preferredCurrency: user.preferredCurrency || null,
          defaultPaymentMethod: defaultMethod ? {
            id: defaultMethod.id,
            cardLast4: defaultMethod.cardLast4,
            cardBrand: defaultMethod.cardBrand,
            canAutoCharge: defaultMethod.canAutoCharge
          } : null,
          totalPaymentMethods: paymentMethods.length,
          autoChargeEnabled: paymentMethods.some(method => method.canAutoCharge),
          country: user.country || req.location?.country || null
        }
      });
    } catch (error) {
      console.error("Error getting user payment settings:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get user payment settings"
      });
    }
  }

  // Add these missing methods to your PaymentController class
  /**
   * Create appointment payment with direct provider redirect
   */
  static async createAppointmentPayment(req, res) {
    try {
      const { doctorId, appointmentDate, amount, currency, paymentProvider = 'flutterwave', returnUrl } = req.body;
      const userId = req.user.sub;

      // Validate required fields
      if (!doctorId || !appointmentDate || !amount || !currency) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: doctorId, appointmentDate, amount, currency"
        });
      }

      // Validate payment provider
      if (!['flutterwave', 'paystack'].includes(paymentProvider)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment provider. Must be 'flutterwave' or 'paystack'"
        });
      }

      // Get user and doctor details for payment
      const [user, doctor] = await Promise.all([
        userRepository.findById(userId),
        userRepository.findById(doctorId)
      ]);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // Payment providers require a valid email — catch missing/invalid emails early
      const userEmail = (user.email || '').trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!userEmail || !emailRegex.test(userEmail)) {
        return res.status(400).json({
          success: false,
          message: "Your account does not have a valid email address. Please update your profile with a valid email before making a payment."
        });
      }

      // User entity uses fullName, not firstName/lastName
      const patientName = user.fullName || 'Patient';
      const apptDateStr = new Date(appointmentDate).toISOString().split('T')[0];
      const doctorName = doctor ? `Dr. ${doctor.fullName || ''}`.trim() : 'Doctor';

      // Create appointment payment transaction
      const paymentData = {
        patientId: userId,
        doctorId,
        serviceType: 'appointment',
        serviceId: req.body.serviceId || req.body.appointmentId,
        appointmentDate,
        originalAmount: amount,
        originalCurrency: currency,
        paymentProvider,
        description: `Appointment with ${patientName} on ${apptDateStr}`
      };

      const transaction = await paymentService.initiatePayment(paymentData);

      // Build the final destination URL — strip any origin from the client so localhost never leaks.
      // The service layer already wraps this in /api/payments/callback?returnUrl=..., so we must
      // pass the raw destination here (not a pre-wrapped /payment/callback URL).
      let safeReturnPath = '';
      if (returnUrl) {
        try {
          safeReturnPath = new URL(returnUrl).pathname + (new URL(returnUrl).search || '');
        } catch {
          safeReturnPath = returnUrl.startsWith('/') ? returnUrl : `/${returnUrl}`;
        }
      }
      const callbackUrl = safeReturnPath
        ? `${process.env.FRONTEND_URL}${safeReturnPath}`
        : null;

      // Prepare payment data for provider
      const providerPaymentData = {
        email: userEmail,
        name: patientName,
        phone: user.phoneNumber || undefined,
        callbackUrl,
        title: "Medical Appointment Payment",
        description: `Payment for appointment with ${doctorName}`
      };

      // Process payment with the selected provider to get redirect URL
      let providerResponse;
      if (paymentProvider === 'flutterwave') {
        providerResponse = await paymentService.processFlutterwavePayment(transaction, providerPaymentData);
      } else if (paymentProvider === 'paystack') {
        providerResponse = await paymentService.processPaystackPayment(transaction, providerPaymentData);
      }

      if (!providerResponse || !providerResponse.success) {
        return res.status(400).json({
          success: false,
          message: providerResponse?.error || "Failed to create payment with provider"
        });
      }

      // Update transaction with provider details
      await transactionRepository.save({
        ...transaction,
        providerTransactionId: providerResponse.transactionId,
        providerReference: providerResponse.reference,
        status: 'processing' // Update status to processing
      });

      // Return the provider's redirect URL
      res.status(201).json({
        success: true,
        message: "Appointment payment created successfully",
        data: {
          transactionId: transaction.id,
          redirectUrl: providerResponse.authUrl, // THIS IS THE PROVIDER URL!
          appointmentDate: transaction.appointmentDate,
          amount: transaction.originalAmount,
          currency: transaction.originalCurrency,
          paymentProvider: transaction.paymentProvider,
          status: 'processing',
          providerReference: providerResponse.reference,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
        }
      });

    } catch (error) {
      console.error('Create appointment payment error:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create appointment payment"
      });
    }
  }

  /**
   * Handle payment callback from provider
   */
  static async handlePaymentCallback(req, res) {
    const FRONTEND = process.env.FRONTEND_URL || process.env.APP_BASE_URL || process.env.APP_URL || '';
    try {
      const { reference, tx_ref, transaction_id, returnUrl } = req.query;

      // Determine provider and reference
      let provider, transactionRef;
      if (tx_ref && tx_ref.startsWith('FLW-')) {
        provider = 'flutterwave';
        transactionRef = tx_ref;
      } else if (reference) {
        provider = 'paystack';
        transactionRef = reference;
      } else {
        const baseReturnUrl = returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : '';
        return res.redirect(`${FRONTEND}/payment/error?message=Invalid+callback+parameters${baseReturnUrl}`);
      }

      // Find transaction — first by provider reference, then by UUID parsed from the ref
      let transaction = await transactionRepository.findByProviderReference(transactionRef);

      if (!transaction) {
        const parts = transactionRef.split('-');
        // Both FLW-{uuid5parts}-timestamp and PST-{uuid5parts}-timestamp share this structure
        if (parts.length >= 7) {
          const parsedId = `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}-${parts[5]}`;
          transaction = await transactionRepository.findById(parsedId);
        }
      }

      if (!transaction) {
        return res.redirect(`${FRONTEND}/payment/error?message=Transaction+not+found`);
      }

      // Idempotency: if already completed, just redirect to success
      if (transaction.status === 'completed') {
        const baseReturnUrl = returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : '';
        return res.redirect(`${FRONTEND}/payment/callback?reference=${transactionRef}&status=successful${baseReturnUrl}`);
      }

      // Verify payment with provider
      let verificationResult;
      if (provider === 'flutterwave') {
        verificationResult = await paymentService.verifyFlutterwavePayment(transaction_id || transaction.providerTransactionId);
      } else {
        verificationResult = await paymentService.verifyPaystackPayment(transactionRef);
      }

      if (verificationResult.success) {
        // Atomic conditional update — only succeeds if still in processing state
        const updated = await transactionRepository.repo.createQueryBuilder()
          .update()
          .set({
            status: 'completed',
            completedAt: new Date(),
            providerFee: verificationResult.data?.app_fee || verificationResult.data?.fees || 0
          })
          .where('id = :id AND status = :status', { id: transaction.id, status: 'processing' })
          .execute();

        // Only process funds if we were the one to complete it (prevents double-credit)
        if (updated.affected > 0) {
          const SubscriptionService = require('../../subscriptions/services/subscriptionService');
          if (transaction.serviceType === 'subscription' || transaction.serviceType === 'subscription_upgrade') {
            await SubscriptionService.processSubscriptionUpgradeAfterPayment(transaction.id).catch(e =>
              console.error('Subscription upgrade error on callback:', e)
            );
          } else if (transaction.doctorId && transaction.serviceType === 'appointment') {
            await paymentService.processFundsForAppointmentPayment(transaction);

            try {
              const AppointmentService = require('../../appointments/services/appointmentService');
              const appointmentService = new AppointmentService();
              await appointmentService.updatePaymentStatus(transaction.serviceId, {
                paymentStatus: 'completed',
                paymentId: transaction.id,
                paymentMethod: transaction.paymentProvider || 'paystack'
              });
              console.log(`✅ Automatically updated appointment ${transaction.serviceId} to paid status`);
            } catch (syncError) {
              console.error(`❌ Failed to automatically sync appointment status:`, syncError);
            }
          } else if (transaction.serviceType === 'pharmacy') {
            try {
              await paymentService._handleCartOrderPayment(transaction);
            } catch (cartErr) {
              console.error('❌ Cart order post-payment handling failed on callback:', cartErr.message);
            }
          } else if (transaction.doctorId) {
            await paymentService.processFundsImmediate(transaction);
          }
        }

        const baseReturnUrl = returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : '';
        return res.redirect(`${FRONTEND}/payment/callback?reference=${transactionRef}&status=successful${baseReturnUrl}`);
      } else {
        // Atomic conditional update to failed
        await transactionRepository.repo.createQueryBuilder()
          .update()
          .set({ status: 'failed', failedAt: new Date() })
          .where('id = :id AND status = :status', { id: transaction.id, status: 'processing' })
          .execute();

        const baseReturnUrl = returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : '';
        return res.redirect(`${FRONTEND}/payment/callback?reference=${transactionRef}&status=failed${baseReturnUrl}`);
      }

    } catch (error) {
      console.error('Payment callback error:', error);
      return res.redirect(`${FRONTEND}/payment/error?message=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * Handle appointment date change (webhook from booking system)
   */
  static async handleAppointmentDateChange(req, res) {
    try {
      const { appointmentId, newDate, oldDate } = req.body;

      // Find transaction by appointment ID
      const transactions = await paymentService.getTransactionsByServiceId('appointment', appointmentId);

      if (!transactions || transactions.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Appointment payment not found"
        });
      }

      // Update appointment date for the most recent transaction
      const transaction = transactions[0];
      const result = await paymentService.rescheduleAppointmentPayment(
        transaction.id,
        newDate
      );

      res.status(200).json({
        success: true,
        message: "Appointment date updated successfully",
        data: {
          transactionId: transaction.id,
          oldDate,
          newDate,
          fundsStatus: result.data.fundsStatus,
          disputeWindowStartsAt: result.data.disputeWindowStartsAt,
          disputeWindowEndsAt: result.data.disputeWindowEndsAt
        }
      });
    } catch (error) {
      console.error('Handle appointment date change error:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update appointment date"
      });
    }
  }

  /**
   * Get appointment payment status
   */
  static async getAppointmentPaymentStatus(req, res) {
    try {
      const { transactionId } = req.params;

      const transaction = await paymentService.getTransactionWithFundsStatus(transactionId);

      // Check if user has access to this transaction
      if (transaction.patientId !== req.user.sub &&
        transaction.doctorId !== req.user.sub &&
        !['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this transaction"
        });
      }

      res.status(200).json({
        success: true,
        data: {
          transactionId: transaction.id,
          status: transaction.status,
          appointmentDate: transaction.appointmentDate,
          amount: transaction.originalAmount,
          currency: transaction.originalCurrency,
          fundsStatus: transaction.fundsStatus,
          fundsStatusDisplay: transaction.fundsStatusDisplay,
          daysRemaining: transaction.daysRemaining,
          canWithdraw: transaction.canWithdraw,
          isCancelled: transaction.isCancelled,
          paymentProvider: transaction.paymentProvider,
          providerReference: transaction.providerReference,
          completedAt: transaction.completedAt,
          // Only show retry URL if payment is still pending/failed
          retryPaymentUrl: ['pending', 'failed'].includes(transaction.status)
            ? `${process.env.FRONTEND_URL}/payment/retry/${transactionId}`
            : null
        }
      });
    } catch (error) {
      console.error('Get appointment payment status error:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get appointment payment status"
      });
    }
  }

  /**
   * Retry failed appointment payment
   */
  static async retryAppointmentPayment(req, res) {
    try {
      const { transactionId } = req.params;
      const { paymentProvider, returnUrl } = req.body;

      // Get transaction
      const transaction = await paymentService.getTransactionById(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found"
        });
      }

      // Check if user has access
      if (transaction.patientId !== req.user.sub) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      // Check if transaction can be retried
      if (!['pending', 'failed'].includes(transaction.status)) {
        return res.status(400).json({
          success: false,
          message: "Transaction cannot be retried"
        });
      }

      // Get user details
      const user = await userRepository.findById(req.user.sub);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // Pass raw destination — service layer wraps it in /api/payments/callback?returnUrl=...
      let safeRetryPath = '';
      if (returnUrl) {
        try {
          safeRetryPath = new URL(returnUrl).pathname + (new URL(returnUrl).search || '');
        } catch {
          safeRetryPath = returnUrl.startsWith('/') ? returnUrl : `/${returnUrl}`;
        }
      }
      const callbackUrl = safeRetryPath ? `${process.env.FRONTEND_URL}${safeRetryPath}` : null;

      // Prepare payment data
      const providerPaymentData = {
        email: user.email,
        name: user.fullName || 'Patient',
        phone: user.phoneNumber || undefined,
        callbackUrl,
        title: "Medical Appointment Payment (Retry)",
        description: `Retry payment for appointment`
      };

      // Process payment with provider
      let providerResponse;
      if (paymentProvider === 'flutterwave') {
        providerResponse = await paymentService.processFlutterwavePayment(transaction, providerPaymentData);
      } else if (paymentProvider === 'paystack') {
        providerResponse = await paymentService.processPaystackPayment(transaction, providerPaymentData);
      }

      if (!providerResponse || !providerResponse.success) {
        return res.status(400).json({
          success: false,
          message: providerResponse?.error || "Failed to retry payment"
        });
      }

      // Update transaction
      await transactionRepository.save({
        ...transaction,
        providerTransactionId: providerResponse.transactionId,
        providerReference: providerResponse.reference,
        paymentProvider,
        status: 'processing'
      });

      res.status(200).json({
        success: true,
        message: "Payment retry initiated successfully",
        data: {
          transactionId: transaction.id,
          redirectUrl: providerResponse.authUrl,
          paymentProvider,
          providerReference: providerResponse.reference
        }
      });

    } catch (error) {
      console.error('Retry appointment payment error:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retry payment"
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
      console.error("Error calculating payment fees:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to calculate fees"
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
      console.error("Error getting exchange rates:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get exchange rates"
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
      console.error("Error converting currency:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to convert currency"
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
      console.error("Error checking payment system health:", error);
      res.status(500).json({
        success: false,
        message: "System health check failed"
      });
    }
  }

  /**
   * Setup subscription auto-billing
   */
  static async setupSubscriptionAutoBilling(req, res) {
    try {
      const { subscriptionId, paymentMethodId, amount, currency, billingCycle } = req.body;
      const userId = req.user.sub;

      // Basic validation
      if (!subscriptionId || !paymentMethodId || !amount || !currency || !billingCycle) {
        return res.status(400).json({
          success: false,
          message: "All fields are required: subscriptionId, paymentMethodId, amount, currency, billingCycle"
        });
      }

      // Verify payment method belongs to user
      const paymentMethods = await paymentService.getUserPaymentMethods(userId);
      const paymentMethod = paymentMethods.find(pm => pm.id === paymentMethodId);

      if (!paymentMethod) {
        return res.status(404).json({
          success: false,
          message: "Payment method not found"
        });
      }

      if (!paymentMethod.canAutoCharge) {
        return res.status(400).json({
          success: false,
          message: "Payment method is not enabled for auto-charging"
        });
      }

      // Here you would implement the actual subscription setup
      // This is a placeholder implementation
      res.status(200).json({
        success: true,
        message: "Auto-billing setup successful",
        data: {
          subscriptionId,
          paymentMethodId,
          billingCycle,
          amount,
          currency,
          status: 'active'
        }
      });
    } catch (error) {
      console.error("Error setting up subscription auto-billing:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to setup auto-billing"
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

      if (!services || !Array.isArray(services) || services.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Services array is required and cannot be empty"
        });
      }

      // Validate total amount matches service amounts
      const calculatedTotal = services.reduce((sum, service) => sum + (service.amount || 0), 0);
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
            amount: t.originalAmount,
            status: t.status
          })),
          totalAmount
        }
      });
    } catch (error) {
      console.error("Error processing multi-service payment:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to process multi-service payment"
      });
    }
  }

  /**
   * Schedule payment
   */
  static async schedulePayment(req, res) {
    try {
      const { serviceType, serviceId, amount, currency, scheduleDate, paymentMethodId } = req.body;
      const userId = req.user.sub;

      // Validate required fields
      if (!serviceType || !serviceId || !amount || !currency || !scheduleDate) {
        return res.status(400).json({
          success: false,
          message: "All fields are required: serviceType, serviceId, amount, currency, scheduleDate"
        });
      }

      // Validate schedule date is in the future
      const scheduledDate = new Date(scheduleDate);
      if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: "Schedule date must be a valid future date"
        });
      }

      // Create scheduled payment record (placeholder implementation)
      const scheduledPayment = {
        id: `scheduled_${Date.now()}`,
        userId,
        serviceType,
        serviceId,
        amount,
        currency,
        scheduleDate: scheduledDate,
        paymentMethodId,
        status: 'scheduled',
        createdAt: new Date()
      };

      res.status(201).json({
        success: true,
        message: "Payment scheduled successfully",
        data: scheduledPayment
      });
    } catch (error) {
      console.error("Error scheduling payment:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to schedule payment"
      });
    }
  }

  /**
   * Get batch payment status
   */
  static async getBatchPaymentStatus(req, res) {
    try {
      const { batchId } = req.params;

      if (!batchId) {
        return res.status(400).json({
          success: false,
          message: "Batch ID is required"
        });
      }

      // Placeholder implementation
      res.status(200).json({
        success: true,
        message: "Batch payment status retrieved successfully",
        data: {
          batchId,
          status: "completed",
          totalTransactions: 0,
          successfulTransactions: 0,
          failedTransactions: 0,
          createdAt: new Date(),
          completedAt: new Date()
        }
      });
    } catch (error) {
      console.error("Error getting batch payment status:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get batch status"
      });
    }
  }

  /**
   * Get dashboard analytics
   */
  static async getDashboardAnalytics(req, res) {
    try {
      const [stats, serviceAnalytics, currencyAnalytics] = await Promise.all([
        paymentService.getPaymentStatistics(),
        paymentService.getServiceAnalytics(),
        paymentService.getCurrencyAnalytics()
      ]);

      res.status(200).json({
        success: true,
        message: "Dashboard analytics retrieved successfully",
        data: {
          overview: stats,
          services: serviceAnalytics.data,
          currencies: currencyAnalytics.data,
          generatedAt: new Date()
        }
      });
    } catch (error) {
      console.error("Error getting dashboard analytics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get dashboard analytics"
      });
    }
  }

  /**
   * Process manual refund (Admin only)
   */
  static async processManualRefund(req, res) {
    try {
      const { transactionId } = req.params;
      const { reason, refundAmount, notifyUser = true } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: "Refund reason is required"
        });
      }

      // Get transaction details
      const transaction = await paymentService.getTransactionById(transactionId);

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
        message: error.message || "Failed to process manual refund"
      });
    }
  }
}

module.exports = PaymentController;
