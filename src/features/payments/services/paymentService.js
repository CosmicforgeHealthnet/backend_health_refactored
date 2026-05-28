// src/services/transactions/paymentService.js
const transactionRepository = require("../repositories/transactionRepository");
const transactionSplitRepository = require("../repositories/transactionSplitRepository");
const userPaymentMethodRepository = require("../repositories/userPaymentMethodRepository");
const doctorWalletRepository = require("../repositories/doctorWalletRepository");
const { sendAppointmentPaymentReceiptEmail, sendSubscriptionPaymentReceiptEmail } = require('../../../shared/services/email/emailHelpers');
const userRepository = require("../../auth/repositories/userRepository");
const {
  sendAppointmentPaymentReceiptWhatsApp,
  sendSubscriptionPaymentReceiptWhatsApp,
} = require("../../notifications/whatsapp/helper");
const axios = require("axios");

class PaymentService {
  constructor() {
    this.flutterwaveBaseUrl = "https://api.flutterwave.com/v3";
    this.paystackBaseUrl = "https://api.paystack.co";
    this.exchangeRateApi = "https://api.exchangerate-api.com/v4/latest";
  }

  // ================================
  // SECURE TOKENIZATION METHODS
  // ================================

  /**
   * SECURE: Initialize card tokenization flow
   * @param {Object} data - Tokenization request data
   * @returns {Promise<Object>} - Tokenization initialization result
   */
  async initializeCardTokenization(data) {
    const { userId, provider, currency, returnUrl } = data;

    try {
      // Get user details
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Dynamic validation amount based on currency
      const validationAmount = this.getValidationAmount(currency);

      let result;
      if (provider === 'flutterwave') {
        result = await this.initializeFlutterwaveTokenization(user, currency, returnUrl, validationAmount);
      } else if (provider === 'paystack') {
        result = await this.initializePaystackTokenization(user, currency, returnUrl, validationAmount);
      } else {
        throw new Error('Invalid provider. Must be flutterwave or paystack');
      }

      return {
        success: true,
        message: 'Card tokenization initialized successfully',
        data: {
          provider,
          authorizationUrl: result.authUrl,
          reference: result.reference,
          validationAmount,
          currency,
          expiresAt: result.expiresAt || new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
        }
      };

    } catch (error) {
      console.error('Error initializing card tokenization:', error);
      return {
        success: false,
        error: error.message || 'Card tokenization initialization failed'
      };
    }
  }

  /**
   * Get validation amount based on currency
   * @param {string} currency - Currency code
   * @returns {number} - Validation amount
   */
  getValidationAmount(currency) {
    const validationAmounts = {
      'NGN': 100, // ₦1.00
      'GHS': 1,   // GH₵1.00
      'USD': 1,   // $1.00
      'EUR': 1,   // €1.00
      'GBP': 1    // £1.00
    };
    return validationAmounts[currency] || 1;
  }

  /**
   * SECURE: Initialize Flutterwave tokenization
   * @param {Object} user - User object
   * @param {string} currency - Currency code
   * @param {string} returnUrl - Return URL after tokenization
   * @param {number} validationAmount - Validation amount
   * @returns {Promise<Object>} - Flutterwave tokenization result
   */
  async initializeFlutterwaveTokenization(user, currency, returnUrl, validationAmount) {
    try {
      const reference = `FLW-TOKEN-${user.id}-${Date.now()}`;

      const payload = {
        tx_ref: reference,
        amount: validationAmount,
        currency: currency,
        payment_options: "card",
        customer: {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          phonenumber: user.phone
        },
        customizations: {
          title: "Add Payment Method",
          description: `Secure card validation - ${currency} ${validationAmount} will be refunded`,
          logo: process.env.COMPANY_LOGO_URL
        },
        redirect_url: returnUrl,
        meta: {
          user_id: user.id,
          tokenization_flow: true,
          validation_amount: validationAmount,
          currency: currency
        }
      };

      const response = await axios.post(
        `${this.flutterwaveBaseUrl}/payments`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status === 'success') {
        return {
          success: true,
          authUrl: response.data.data.link,
          reference: reference,
          transactionId: response.data.data.id
        };
      } else {
        throw new Error(response.data.message || 'Flutterwave tokenization failed');
      }

    } catch (error) {
      console.error('Flutterwave tokenization error:', error);
      throw new Error(error.response?.data?.message || 'Flutterwave tokenization failed');
    }
  }

  /**
   * SECURE: Initialize Paystack tokenization
   * @param {Object} user - User object
   * @param {string} currency - Currency code
   * @param {string} returnUrl - Return URL after tokenization
   * @param {number} validationAmount - Validation amount
   * @returns {Promise<Object>} - Paystack tokenization result
   */
  async initializePaystackTokenization(user, currency, returnUrl, validationAmount) {
    try {
      const reference = `PST-TOKEN-${user.id}-${Date.now()}`;

      // Convert to kobo/pesewas for Paystack
      const amountInMinorUnits = currency === 'NGN' || currency === 'GHS'
        ? validationAmount * 100
        : validationAmount * 100;

      const payload = {
        email: user.email,
        amount: amountInMinorUnits,
        currency: currency,
        reference: reference,
        callback_url: returnUrl,
        metadata: {
          user_id: user.id,
          tokenization_flow: true,
          validation_amount: validationAmount,
          currency: currency,
          custom_fields: [
            {
              display_name: "Purpose",
              variable_name: "purpose",
              value: "Card Tokenization"
            }
          ]
        },
        channels: ["card"]
      };

      const response = await axios.post(
        `${this.paystackBaseUrl}/transaction/initialize`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status) {
        return {
          success: true,
          authUrl: response.data.data.authorization_url,
          reference: reference,
          accessCode: response.data.data.access_code
        };
      } else {
        throw new Error(response.data.message || 'Paystack tokenization failed');
      }

    } catch (error) {
      console.error('Paystack tokenization error:', error);
      throw new Error(error.response?.data?.message || 'Paystack tokenization failed');
    }
  }

  /**
   * SECURE: Handle tokenization callback and save payment method
   * @param {Object} data - Callback data
   * @returns {Promise<Object>} - Processing result
   */
  async handleTokenizationCallback(data) {
    const { provider, reference, userId } = data;

    try {
      let verificationResult;
      if (provider === 'flutterwave') {
        verificationResult = await this.verifyFlutterwaveTokenization(reference);
      } else if (provider === 'paystack') {
        verificationResult = await this.verifyPaystackTokenization(reference);
      } else {
        throw new Error('Invalid provider');
      }

      if (!verificationResult.success) {
        throw new Error(verificationResult.error || 'Tokenization verification failed');
      }

      // Extract card and token information
      const cardInfo = verificationResult.cardInfo;
      const tokenInfo = verificationResult.tokenInfo;

      // Check if payment method already exists
      const existingMethod = await userPaymentMethodRepository.findByCardLast4(userId, cardInfo.last4);
      if (existingMethod) {
        // Update existing method with new token
        const updateData = {
          tokenExpiryDate: tokenInfo.expiryDate,
          canAutoCharge: true,
          updatedAt: new Date()
        };

        if (provider === 'flutterwave') {
          updateData.flutterwaveToken = tokenInfo.token;
          updateData.flutterwaveCustomerId = tokenInfo.customerId;
        } else {
          updateData.paystackToken = tokenInfo.token;
          updateData.paystackCustomerId = tokenInfo.customerId;
        }

        await userPaymentMethodRepository.repo.update(existingMethod.id, updateData);

        // Process refund for validation amount
        await this.processValidationRefund(verificationResult.transactionData, provider);

        return {
          success: true,
          message: 'Payment method updated successfully',
          data: {
            paymentMethodId: existingMethod.id,
            cardLast4: cardInfo.last4,
            cardBrand: cardInfo.brand,
            cardType: cardInfo.type,
            bankName: cardInfo.bank,
            canAutoCharge: true,
            provider: provider,
            isExisting: true
          }
        };
      }

      // Create new payment method
      const paymentMethodData = {
        userId: userId,
        cardLast4: cardInfo.last4,
        cardType: cardInfo.type,
        cardBrand: cardInfo.brand,
        bankName: cardInfo.bank || 'Unknown Bank',
        cardBin: cardInfo.bin,
        cardCountry: cardInfo.country,
        tokenExpiryDate: tokenInfo.expiryDate,
        isDefault: false,
        canAutoCharge: true,
        isActive: true
      };

      // Set provider-specific token
      if (provider === 'flutterwave') {
        paymentMethodData.flutterwaveToken = tokenInfo.token;
        paymentMethodData.flutterwaveCustomerId = tokenInfo.customerId;
      } else {
        paymentMethodData.paystackToken = tokenInfo.token;
        paymentMethodData.paystackCustomerId = tokenInfo.customerId;
      }

      const savedMethod = await this.savePaymentMethod(paymentMethodData);

      // Process refund for validation amount
      await this.processValidationRefund(verificationResult.transactionData, provider);

      return {
        success: true,
        message: 'Payment method added successfully',
        data: {
          paymentMethodId: savedMethod.id,
          cardLast4: cardInfo.last4,
          cardBrand: cardInfo.brand,
          cardType: cardInfo.type,
          bankName: cardInfo.bank,
          canAutoCharge: true,
          provider: provider,
          isExisting: false
        }
      };

    } catch (error) {
      console.error('Error handling tokenization callback:', error);
      return {
        success: false,
        error: error.message || 'Tokenization callback processing failed'
      };
    }
  }

  /**
   * SECURE: Verify Flutterwave tokenization
   * @param {string} reference - Transaction reference
   * @returns {Promise<Object>} - Verification result
   */
  async verifyFlutterwaveTokenization(reference) {
    try {
      const response = await axios.get(
        `${this.flutterwaveBaseUrl}/transactions`,
        {
          params: { tx_ref: reference },
          headers: {
            'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`
          }
        }
      );

      if (response.data.status !== 'success' || !response.data.data.length) {
        throw new Error('Transaction not found');
      }

      const transaction = response.data.data[0];

      if (transaction.status !== 'successful') {
        throw new Error('Transaction was not successful');
      }

      const cardInfo = {
        last4: transaction.card.last_4digits,
        type: transaction.card.type,
        brand: transaction.card.issuer,
        bank: transaction.card.issuer,
        bin: transaction.card.first_6digits,
        country: transaction.card.country,
        expiry: transaction.card.expiry
      };

      const tokenInfo = {
        token: transaction.customer.id,
        customerId: transaction.customer.id,
        expiryDate: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000) // 5 years
      };

      return {
        success: true,
        cardInfo,
        tokenInfo,
        transactionData: transaction
      };

    } catch (error) {
      console.error('Flutterwave tokenization verification error:', error);
      return {
        success: false,
        error: error.message || 'Flutterwave tokenization verification failed'
      };
    }
  }

  /**
   * SECURE: Verify Paystack tokenization
   * @param {string} reference - Transaction reference
   * @returns {Promise<Object>} - Verification result
   */
  async verifyPaystackTokenization(reference) {
    try {
      const response = await axios.get(
        `${this.paystackBaseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
          }
        }
      );

      if (!response.data.status || response.data.data.status !== 'success') {
        throw new Error('Transaction was not successful');
      }

      const transaction = response.data.data;

      const cardInfo = {
        last4: transaction.authorization.last4,
        type: transaction.authorization.card_type,
        brand: transaction.authorization.brand,
        bank: transaction.authorization.bank,
        bin: transaction.authorization.bin,
        country: transaction.authorization.country_code,
        expiry: `${transaction.authorization.exp_month}/${transaction.authorization.exp_year}`
      };

      const tokenInfo = {
        token: transaction.authorization.authorization_code,
        customerId: transaction.customer.id,
        expiryDate: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000) // 5 years
      };

      return {
        success: true,
        cardInfo,
        tokenInfo,
        transactionData: transaction
      };

    } catch (error) {
      console.error('Paystack tokenization verification error:', error);
      return {
        success: false,
        error: error.message || 'Paystack tokenization verification failed'
      };
    }
  }

  /**
   * SECURE: Process refund for validation amount
   * @param {Object} transactionData - Transaction data
   * @param {string} provider - Payment provider
   * @returns {Promise<void>}
   */
  async processValidationRefund(transactionData, provider) {
    try {
      console.log(`🔄 Processing validation refund for ${provider} transaction`);

      if (provider === 'flutterwave') {
        await axios.post(
          `${this.flutterwaveBaseUrl}/transactions/${transactionData.id}/refund`,
          {
            amount: transactionData.amount,
            comments: "Card validation refund - automatic refund for tokenization"
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } else if (provider === 'paystack') {
        await axios.post(
          `${this.paystackBaseUrl}/refund`,
          {
            transaction: transactionData.reference,
            amount: transactionData.amount,
            currency: transactionData.currency,
            customer_note: "Card validation refund",
            merchant_note: "Automatic refund for card tokenization"
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      console.log(`✅ Validation refund processed successfully for ${provider}`);
    } catch (error) {
      console.error(`❌ Error processing validation refund for ${provider}:`, error);
      // Don't throw error - refund failure shouldn't fail the tokenization
    }
  }

  /**
   * SECURE: Get tokenization status
   * @param {string} reference - Transaction reference
   * @param {string} provider - Payment provider
   * @returns {Promise<Object>} - Status result
   */
  async getTokenizationStatus(reference, provider) {
    try {
      if (provider === 'flutterwave') {
        const response = await axios.get(
          `${this.flutterwaveBaseUrl}/transactions`,
          {
            params: { tx_ref: reference },
            headers: {
              'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`
            }
          }
        );

        if (response.data.status === 'success' && response.data.data.length > 0) {
          const transaction = response.data.data[0];
          return {
            success: true,
            status: transaction.status,
            message: this.getStatusMessage(transaction.status),
            canProceed: transaction.status === 'successful'
          };
        }
      } else if (provider === 'paystack') {
        const response = await axios.get(
          `${this.paystackBaseUrl}/transaction/verify/${reference}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
            }
          }
        );

        if (response.data.status) {
          return {
            success: true,
            status: response.data.data.status,
            message: this.getStatusMessage(response.data.data.status),
            canProceed: response.data.data.status === 'success'
          };
        }
      }

      return {
        success: false,
        status: 'unknown',
        message: 'Transaction not found',
        canProceed: false
      };

    } catch (error) {
      console.error('Error checking tokenization status:', error);
      return {
        success: false,
        status: 'error',
        message: 'Failed to check status',
        canProceed: false
      };
    }
  }

  /**
   * Helper: Get user-friendly status message
   * @param {string} status - Transaction status
   * @returns {string} - User-friendly message
   */
  getStatusMessage(status) {
    const messages = {
      'successful': 'Payment method added successfully',
      'success': 'Payment method added successfully',
      'pending': 'Processing your card details...',
      'failed': 'Card validation failed. Please try again.',
      'cancelled': 'Card validation was cancelled',
      'abandoned': 'Card validation was not completed'
    };

    return messages[status] || 'Unknown status';
  }

  // ================================
  // EXISTING PAYMENT METHODS (PRESERVED)
  // ================================

  /**
   * Get payment options with real provider fees and recommendations
   * @param {Object} data - Payment request data
   * @returns {Promise<Object>} - Payment options with fees and recommendations
   */
  async getPaymentOptions(data) {
    const { amount, currency, paymentMethodId } = data;

    // Get user's payment method performance if provided
    let paymentMethod = null;
    if (paymentMethodId) {
      paymentMethod = await userPaymentMethodRepository.findById(paymentMethodId);
    }

    // Calculate success rates
    const flutterwaveSuccessRate = paymentMethod
      ? paymentMethod.flutterwaveAttemptCount > 0
        ? paymentMethod.flutterwaveSuccessCount / paymentMethod.flutterwaveAttemptCount
        : 0.85
      : 0.85;

    const paystackSuccessRate = paymentMethod
      ? paymentMethod.paystackAttemptCount > 0
        ? paymentMethod.paystackSuccessCount / paymentMethod.paystackAttemptCount
        : 0.80
      : 0.80;

    // Get real provider fees
    const [flutterwaveFee, paystackFee] = await Promise.all([
      this.getFlutterwaveFee(amount, currency),
      this.getPaystackFee(amount, currency)
    ]);

    const options = {
      flutterwave: {
        fee: flutterwaveFee,
        total: amount + flutterwaveFee,
        successRate: flutterwaveSuccessRate,
        recommended: false,
        reason: ""
      },
      paystack: {
        fee: paystackFee,
        total: amount + paystackFee,
        successRate: paystackSuccessRate,
        recommended: false,
        reason: ""
      }
    };

    // Determine recommendation
    if (flutterwaveFee < paystackFee && flutterwaveSuccessRate >= 0.80) {
      options.flutterwave.recommended = true;
      options.flutterwave.reason = "Better rate + high success rate";
    } else if (paystackSuccessRate > flutterwaveSuccessRate + 0.10) {
      options.paystack.recommended = true;
      options.paystack.reason = "Higher success rate";
    } else {
      options.flutterwave.recommended = flutterwaveFee <= paystackFee;
      options.flutterwave.reason = options.flutterwave.recommended ? "Better rate" : "";
      options.paystack.recommended = !options.flutterwave.recommended;
      options.paystack.reason = options.paystack.recommended ? "Better rate" : "";
    }

    return options;
  }

  /**
   * Get real Flutterwave fee
   * @param {number} amount - Transaction amount
   * @param {string} currency - Currency code
   * @returns {Promise<number>} - Fee amount
   */
  async getFlutterwaveFee(amount, currency) {
    try {
      const response = await axios.post(
        `${this.flutterwaveBaseUrl}/charges/fee`,
        {
          amount,
          currency,
          type: "card"
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data.fee;
    } catch (error) {
      console.error('Error getting Flutterwave fee:', error);
      return Math.round(amount * 0.015);
    }
  }

  /**
   * Get real Paystack fee
   * @param {number} amount - Transaction amount
   * @param {string} currency - Currency code
   * @returns {Promise<number>} - Fee amount
   */
  async getPaystackFee(amount, currency) {
    try {
      let fee = 0;
      const amountInKobo = amount * 100;

      if (currency === 'NGN') {
        if (amountInKobo <= 250000) {
          fee = amountInKobo * 0.015;
        } else {
          fee = 250000 * 0.015 + (amountInKobo - 250000) * 0.015;
        }
        fee = Math.max(fee, 10000);
      } else if (currency === 'GHS') {
        fee = amountInKobo * 0.029;
        fee = Math.max(fee, 10);
      } else {
        fee = amountInKobo * 0.039 + 15000;
      }

      return Math.round(fee / 100);
    } catch (error) {
      console.error('Error calculating Paystack fee:', error);
      return Math.round(amount * 0.020);
    }
  }

  /**
   * Get real exchange rate
   * @param {string} from - From currency
   * @param {string} to - To currency
   * @returns {Promise<number>} - Exchange rate
   */
  async getExchangeRate(from, to) {
    if (from === to) return 1.0;

    const cacheKey = `${from}_${to}`;
    const cached = this._rateCache?.get(cacheKey);
    if (cached && Date.now() - cached.ts < 60 * 60 * 1000) {
      return cached.rate;
    }

    try {
      const response = await axios.get(`${this.exchangeRateApi}/${from}`);
      const rate = response.data.rates[to] || 1.0;

      if (!this._rateCache) this._rateCache = new Map();
      this._rateCache.set(cacheKey, { rate, ts: Date.now() });

      return rate;
    } catch (error) {
      // Return stale cache rather than failing completely
      if (cached) return cached.rate;
      console.error('Error fetching exchange rate:', error);
      throw new Error('Unable to fetch current exchange rate');
    }
  }

  // Called by the background job to pre-warm the cache
  warmExchangeRateCache(from, to, rate) {
    if (!this._rateCache) this._rateCache = new Map();
    this._rateCache.set(`${from}_${to}`, { rate, ts: Date.now() });
  }

  // ================================
  // AUTO-BILLING METHODS
  // ================================

  /**
   * Process payment using stored token (for auto-billing)
   */
  async processTokenPayment(transaction, paymentMethod, provider) {
    try {
      let result;

      if (provider === 'flutterwave' && paymentMethod.flutterwaveToken) {
        result = await this.processFlutterwaveTokenPayment(transaction, paymentMethod);
      } else if (provider === 'paystack' && paymentMethod.paystackToken) {
        result = await this.processPaystackTokenPayment(transaction, paymentMethod);
      } else {
        throw new Error(`No valid token available for provider: ${provider}`);
      }

      return result;

    } catch (error) {
      console.error('Error processing token payment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process Flutterwave token payment
   */
  async processFlutterwaveTokenPayment(transaction, paymentMethod) {
    try {
      const payload = {
        token: paymentMethod.flutterwaveToken,
        currency: transaction.originalCurrency,
        amount: transaction.originalAmount,
        email: transaction.patient?.email,
        tx_ref: `FLW-AUTO-${transaction.id}-${Date.now()}`
      };

      const response = await axios.post(
        `${this.flutterwaveBaseUrl}/tokenized-charges`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status === 'success') {
        return {
          success: true,
          transactionId: response.data.data.id,
          reference: response.data.data.tx_ref,
          fee: response.data.data.app_fee || 0,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Token payment failed'
        };
      }

    } catch (error) {
      console.error('Flutterwave token payment error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Token payment failed'
      };
    }
  }

  /**
   * Process Paystack token payment
   */
  async processPaystackTokenPayment(transaction, paymentMethod) {
    try {
      const payload = {
        authorization_code: paymentMethod.paystackToken,
        email: transaction.patient?.email,
        amount: transaction.originalAmount * 100,
        currency: transaction.originalCurrency
      };

      const response = await axios.post(
        `${this.paystackBaseUrl}/transaction/charge_authorization`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status) {
        return {
          success: true,
          transactionId: response.data.data.id,
          reference: response.data.data.reference,
          fee: (response.data.data.fees || 0) / 100,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Token payment failed'
        };
      }

    } catch (error) {
      console.error('Paystack token payment error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Token payment failed'
      };
    }
  }

  /**
   * Get auto-billing analytics
   */
  async getAutoBillingAnalytics() {
    try {
      const autoBillingStats = await transactionRepository.getAutoBillingStats();

      const successRate = autoBillingStats.totalAutoBilling > 0
        ? (autoBillingStats.successfulAutoBilling / autoBillingStats.totalAutoBilling * 100).toFixed(2)
        : 0;

      return {
        totalAutoBillingTransactions: parseInt(autoBillingStats.totalAutoBilling || 0),
        successfulAutoBilling: parseInt(autoBillingStats.successfulAutoBilling || 0),
        failedAutoBilling: parseInt(autoBillingStats.failedAutoBilling || 0),
        autoBillingSuccessRate: parseFloat(successRate),
        revenueFromAutoBilling: 0
      };

    } catch (error) {
      console.error('Error getting auto-billing analytics:', error);
      throw error;
    }
  }

  // ================================
  // TRANSACTION PROCESSING (ALL SERVICES)
  // ================================

  /**
 * Get doctor's commission rate based on subscription tier
 * @param {string} doctorId - Doctor ID
 * @returns {Promise<number>} - Commission rate percentage
 */
  async getDoctorCommissionRate(doctorId) {
    try {
      // Updated path to point to the correct feature location
      const subscriptionCompatibilityService = require('../../subscriptions/services/subscriptionCompatibilityService');
      const doctorSubscription = await subscriptionCompatibilityService.getUserSubscription(doctorId);

      // Get commission rate from subscription, fallback to user tier, then default to 30%
      if (doctorSubscription && doctorSubscription.commissionRate) {
        return doctorSubscription.commissionRate;
      }

      // Fallback: check user table tier
      const doctor = await userRepository.findById(doctorId);
      if (doctor && doctor.tier) {
        const tierCommissionRates = {
          'free': 30,
          'basic': 20,
          'professional': 15,
          'premium': 10
        };
        return tierCommissionRates[doctor.tier] || 30;
      }

      // Default to free plan rate
      return 30;
    } catch (error) {
      console.error('Error getting doctor commission rate:', error);
      return 30; // Default to free plan rate
    }
  }

  // In your PaymentService.initiatePayment method, add this logic:

  async initiatePayment(data) {
    const {
      patientId,
      doctorId,
      serviceType,
      serviceId,
      appointmentDate,
      planType,
      billingCycle,
      originalAmount,
      originalCurrency,
      paymentProvider,
      paymentMethodId,
      appointmentFee, // ← This will be ignored for appointments (calculated automatically)
      serviceFee,     // ← This will be ignored for appointments (calculated automatically)
      vat,           // ← This will be ignored for appointments (calculated automatically)
      description,
      isAutoBilling
    } = data;

    // Validate users exist
    const patient = await userRepository.findById(patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    // For appointment payments, doctorId is required
    if (serviceType === 'appointment' && !doctorId) {
      throw new Error("Doctor ID is required for appointment payments");
    }

    // For subscription payments, doctorId is not needed
    let finalDoctorId = doctorId;
    if (serviceType === 'subscription' || serviceType === 'subscription_upgrade' || serviceType === 'subscription_renewal') {
      finalDoctorId = null; // Explicitly set to null for subscription payments
    }

    // Only validate doctor exists if doctorId is provided
    if (finalDoctorId) {
      const doctor = await userRepository.findById(finalDoctorId);
      if (!doctor) {
        throw new Error("Doctor not found");
      }
    }

    // Convert to USD using real exchange rate
    const exchangeRate = await this.getExchangeRate(originalCurrency, 'USD');
    const usdAmount = originalAmount * exchangeRate;

    // Enhanced dispute logic (only for appointment payments)
    const now = new Date();
    let disputeWindowStartsAt, disputeWindowEndsAt, fundsStatus;

    if (serviceType === 'appointment' && appointmentDate) {
      const apptDate = new Date(appointmentDate);

      if (apptDate <= now) {
        disputeWindowStartsAt = now;
        disputeWindowEndsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        fundsStatus = 'pending_dispute';
      } else {
        disputeWindowStartsAt = apptDate;
        disputeWindowEndsAt = new Date(apptDate.getTime() + 3 * 24 * 60 * 60 * 1000);
        fundsStatus = 'pending_appointment';
      }
    } else {
      // For non-appointment payments (subscriptions, etc.)
      disputeWindowStartsAt = now;
      disputeWindowEndsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      fundsStatus = 'released'; // No dispute window for subscriptions
    }

    // Create transaction with the correct doctorId (null for subscriptions)
    const transactionData = {
      patientId,
      doctorId: finalDoctorId, // This will be null for subscription payments
      serviceType,
      serviceId,
      planType,
      billingCycle,
      originalAmount,
      originalCurrency,
      usdAmount,
      exchangeRateUsed: exchangeRate,
      paymentProvider,
      paymentMethodId,
      description,
      status: 'pending',
      appointmentDate: serviceType === 'appointment' ? appointmentDate : null,
      disputeWindowStartsAt,
      disputeWindowEndsAt,
      fundsStatus,
      isAutoBilling: (serviceType === 'appointment') ? false : (isAutoBilling || false)
    };

    const transaction = transactionRepository.create(transactionData);
    const savedTransaction = await transactionRepository.save(transaction);

    // ✅ ENHANCED: Smart split calculation based on service type
    const splits = [];

    if (serviceType === 'appointment' && finalDoctorId) {
      const PLATFORM_FEE_RATE = 0.07; // 7% platform fee — set by system

      // Step 1: 7% platform fee on the full amount
      const platformFee    = originalAmount * PLATFORM_FEE_RATE;
      const afterPlatform  = originalAmount - platformFee;

      // Step 2: Doctor commission (10–30% based on subscription tier) on the remainder
      const commissionRate   = await this.getDoctorCommissionRate(finalDoctorId);
      const commissionAmount = afterPlatform * (commissionRate / 100);

      // Step 3: Doctor receives the rest
      const doctorAmount = afterPlatform - commissionAmount;

      console.log(`💰 Appointment Payment Breakdown for ${originalAmount} ${originalCurrency}:`);
      console.log(`   Platform Fee (7%): ${platformFee.toFixed(2)}`);
      console.log(`   After Platform Fee: ${afterPlatform.toFixed(2)}`);
      console.log(`   Doctor Commission (${commissionRate}%): ${commissionAmount.toFixed(2)}`);
      console.log(`   Doctor Gets: ${doctorAmount.toFixed(2)}`);

      // Platform fee → company
      splits.push({
        transactionId: savedTransaction.id,
        type: 'service_fee',
        originalAmount: parseFloat(platformFee.toFixed(2)),
        originalCurrency,
        usdAmount: parseFloat((platformFee * exchangeRate).toFixed(2)),
        recipientType: 'company_wallet',
        recipientId: null
      });

      // Commission → company
      splits.push({
        transactionId: savedTransaction.id,
        type: 'service_fee',
        originalAmount: parseFloat(commissionAmount.toFixed(2)),
        originalCurrency,
        usdAmount: parseFloat((commissionAmount * exchangeRate).toFixed(2)),
        recipientType: 'company_wallet',
        recipientId: null
      });

      // Remainder → doctor
      splits.push({
        transactionId: savedTransaction.id,
        type: 'appointment_fee',
        originalAmount: parseFloat(doctorAmount.toFixed(2)),
        originalCurrency,
        usdAmount: parseFloat((doctorAmount * exchangeRate).toFixed(2)),
        recipientType: 'doctor_wallet',
        recipientId: finalDoctorId
      });

    } else {
      // ✅ NON-APPOINTMENT PAYMENTS: Use legacy split logic for backward compatibility
      console.log(`💰 Non-Appointment Payment: ${serviceType} for ${originalAmount} ${originalCurrency}`);

      if (appointmentFee > 0 && finalDoctorId) {
        splits.push({
          transactionId: savedTransaction.id,
          type: 'appointment_fee',
          originalAmount: appointmentFee,
          originalCurrency,
          usdAmount: appointmentFee * exchangeRate,
          recipientType: 'doctor_wallet',
          recipientId: finalDoctorId
        });
      }

      // Service fee goes to company
      if (serviceFee > 0) {
        splits.push({
          transactionId: savedTransaction.id,
          type: 'service_fee',
          originalAmount: serviceFee,
          originalCurrency,
          usdAmount: serviceFee * exchangeRate,
          recipientType: 'company_wallet',
          recipientId: null
        });
      }
    }

    // Save splits if any exist
    if (splits.length > 0) {
      console.log(`💾 Creating ${splits.length} transaction splits`);
      const createdSplits = splits.map(split => transactionSplitRepository.create(split));
      await transactionSplitRepository.saveMultiple(createdSplits);

      // Log split summary
      console.log('📊 Split Summary:');
      splits.forEach(split => {
        console.log(`   ${split.type}: ${split.originalAmount} ${split.originalCurrency} → ${split.recipientType}`);
      });
    } else {
      console.log('📊 No splits created for this transaction');
    }

    console.log(`✅ Transaction ${savedTransaction.id} created successfully`);
    return savedTransaction;
  }

  /**
 * Get appointments overview with payment status
 */
  async getAppointmentsOverview(userId, role) {
    try {
      let appointments;
      if (role === 'patient') {
        appointments = await transactionRepository.findByPatientIdAndServiceType(userId, 'appointment');
      } else if (role === 'doctor') {
        appointments = await transactionRepository.findByDoctorIdAndServiceType(userId, 'appointment');
      } else {
        throw new Error("Invalid role");
      }

      // Add enhanced status to each appointment
      const enhancedAppointments = await Promise.all(
        appointments.map(async (appointment) => {
          if (appointment.status === 'completed' && appointment.serviceType === 'appointment') {
            const enhanced = await this.getTransactionWithFundsStatus(appointment.id);
            return {
              ...appointment,
              fundsStatusDisplay: enhanced.fundsStatusDisplay,
              daysRemaining: enhanced.daysRemaining,
              canWithdraw: enhanced.canWithdraw
            };
          }
          return appointment;
        })
      );

      return enhancedAppointments;
    } catch (error) {
      console.error('Error getting appointments overview:', error);
      throw error;
    }
  }

  /**
   * Process payment with selected provider (supports all service types)
   * @param {Object} data - Payment processing data
   * @returns {Promise<Object>} - Processing result
   */
  async processPayment(data) {
    const { transactionId, paymentProvider, paymentData, useStoredMethod } = data;

    const transaction = await transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    try {
      // Update transaction status
      await transactionRepository.updateStatus(transactionId, 'processing');

      let result;

      // Check if using stored payment method for auto-billing
      if (useStoredMethod && transaction.paymentMethodId) {
        const paymentMethod = await userPaymentMethodRepository.findById(transaction.paymentMethodId);
        if (paymentMethod && paymentMethod.canAutoCharge) {
          // Use token payment
          result = await this.processTokenPayment(transaction, paymentMethod, paymentProvider);
        } else {
          throw new Error('Payment method not available for auto-billing');
        }
      } else {
        // Use regular payment flow
        if (paymentProvider === 'flutterwave') {
          result = await this.processFlutterwavePayment(transaction, paymentData);
        } else {
          result = await this.processPaystackPayment(transaction, paymentData);
        }
      }

      if (result.success) {
        // Prepare update data
        const updateData = {
          providerTransactionId: result.transactionId || result.reference,
          providerReference: result.reference,
          status: 'processing', // Default to processing until webhook confirms
          updatedAt: new Date()
        };

        // If it's a token payment (auto-billing) or provider returned immediate success status
        // AND we have a completed status explicitly from the provider handler
        if (useStoredMethod || (result.data && (result.data.status === 'successful' || result.data.status === 'success'))) {
          updateData.status = 'completed';
          updateData.providerFee = result.fee;
          updateData.completedAt = new Date();

          // Only verify funds processing for COMPLETED transactions
          if (transaction.doctorId && transaction.serviceType === 'appointment') {
            await this.processFundsForAppointmentPayment(transaction);
          } else if (transaction.doctorId) {
            await this.processFundsImmediate(transaction);
          }
        }

        // Update transaction
        await transactionRepository.repo.update(transaction.id, updateData);

        // Update payment method usage stats if successful/processing
        if (transaction.paymentMethodId) {
          await userPaymentMethodRepository.updateLastUsed(
            transaction.paymentMethodId,
            paymentProvider
          );

          // Only update success rate if actually completed
          if (updateData.status === 'completed') {
            await userPaymentMethodRepository.updateSuccessRate(
              transaction.paymentMethodId,
              paymentProvider,
              true
            );
          }
        }

        // Save payment token if new payment and token available AND completed
        if (!useStoredMethod && result.data && updateData.status === 'completed') {
          await this.savePaymentToken(transaction, result.data, paymentProvider);
        }

        return { success: true, transaction: await transactionRepository.findById(transactionId) };
      } else {
        // Handle payment failure
        await transactionRepository.updateStatus(transactionId, 'failed', {
          failedAt: new Date()
        });

        // Update payment method failure rate
        if (transaction.paymentMethodId) {
          await userPaymentMethodRepository.updateSuccessRate(
            transaction.paymentMethodId,
            paymentProvider,
            false
          );
        }

        throw new Error(result.error || 'Payment processing failed');
      }
    } catch (error) {
      await transactionRepository.updateStatus(transactionId, 'failed', {
        failedAt: new Date()
      });
      throw error;
    }
  }

  /**
   * Process Flutterwave payment
   * @param {Object} transaction - Transaction object
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} - Payment result
   */
  /**
   * FIXED: Process Flutterwave payment WITH webhook URL
   */
  async processFlutterwavePayment(transaction, paymentData) {
    try {
      const txRef = `FLW-${transaction.id}-${Date.now()}`;
      const baseReturnUrlFLW = (paymentData.callbackUrl || paymentData.redirectUrl || paymentData.returnUrl)
        ? `?returnUrl=${encodeURIComponent(paymentData.callbackUrl || paymentData.redirectUrl || paymentData.returnUrl)}`
        : '';
      const backendBase = (process.env.BACKEND_URL || process.env.APP_BASE_URL || '').replace(/\/api\/?$/, '');
        
      const payload = {
        tx_ref: txRef,
        amount: transaction.originalAmount,
        currency: transaction.originalCurrency,
        payment_options: "card,banktransfer,ussd",
        customer: {
          email: paymentData.email,
          phonenumber: paymentData.phone,
          name: paymentData.name
        },
        customizations: {
          title: paymentData.title || "Health Platform Payment",
          description: transaction.description || `Payment for ${transaction.serviceType}`,
          logo: process.env.COMPANY_LOGO_URL
        },
        redirect_url: `${backendBase}/api/payments/callback${baseReturnUrlFLW}`,
        webhook_url: `${backendBase}/webhooks/payments/flutterwave`,
        meta: {
          transaction_id: transaction.id,
          service_type: transaction.serviceType,
          service_id: transaction.serviceId
        }
      };

      // ✅ ADD THIS HERE  
      if (paymentData.enableAutoBilling) {
        payload.payment_options = "card";
      }

      const response = await axios.post(
        `${this.flutterwaveBaseUrl}/payments`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status === 'success') {
        // Update transaction immediately with provider reference
        await transactionRepository.repo.update(transaction.id, {
          providerTransactionId: response.data.data.id,
          providerReference: txRef,
          status: 'processing'
        });

        return {
          success: true,
          transactionId: response.data.data.id,
          reference: `FLW-${transaction.id}-${Date.now()}`,
          fee: response.data.data.charged_amount - transaction.originalAmount,
          authUrl: response.data.data.link,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Payment failed'
        };
      }
    } catch (error) {
      console.error('Flutterwave payment error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Payment processing failed'
      };
    }
  }

  /**
   * Process Paystack payment
   * @param {Object} transaction - Transaction object
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} - Payment result
   */
  /**
   * FIXED: Process Paystack payment WITH webhook callback
   */
  async processPaystackPayment(transaction, paymentData) {
    try {
      const reference = `PST-${transaction.id}-${Date.now()}`;
      const baseReturnUrlPST = (paymentData.callbackUrl || paymentData.redirectUrl || paymentData.returnUrl)
        ? `?returnUrl=${encodeURIComponent(paymentData.callbackUrl || paymentData.redirectUrl || paymentData.returnUrl)}`
        : '';
      const backendBase = (process.env.BACKEND_URL || process.env.APP_BASE_URL || '').replace(/\/api\/?$/, '');

      const payload = {
        email: paymentData.email,
        amount: transaction.originalAmount * 100, // Convert to kobo/pesewas
        currency: transaction.originalCurrency,
        reference: reference,
        callback_url: `${backendBase}/api/payments/callback${baseReturnUrlPST}`,
        metadata: {
          transaction_id: transaction.id,
          service_type: transaction.serviceType,
          service_id: transaction.serviceId,
          webhook_url: `${backendBase}/webhooks/payments/paystack`,
          custom_fields: [
            {
              display_name: "Service Type",
              variable_name: "service_type",
              value: transaction.serviceType
            }
          ]
        }
      };

      // ✅ ADD THIS HERE
      if (paymentData.enableAutoBilling) {
        payload.channels = ["card"];
      }

      const response = await axios.post(
        `${this.paystackBaseUrl}/transaction/initialize`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status) {
        // Update transaction immediately with provider reference
        await transactionRepository.repo.update(transaction.id, {
          providerTransactionId: reference,
          providerReference: reference,
          status: 'processing'
        });

        return {
          success: true,
          transactionId: reference,
          reference: reference,
          fee: 0, // Fee will be calculated after completion
          authUrl: response.data.data.authorization_url,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Payment initialization failed'
        };
      }
    } catch (error) {
      console.error('Paystack payment error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Payment processing failed'
      };
    }
  }

  /**
   * Save payment token after successful payment
   */
  async savePaymentToken(transaction, providerResponse, provider) {
    try {
      // Extract token from provider response
      let token = null;
      let customerId = null;
      let expiryDate = null;

      if (provider === 'flutterwave' && providerResponse.customer?.id) {
        token = providerResponse.customer.id;
        customerId = providerResponse.customer.id;
        expiryDate = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000); // 10 years
      } else if (provider === 'paystack' && providerResponse.authorization?.authorization_code) {
        token = providerResponse.authorization.authorization_code;
        customerId = providerResponse.customer?.id;
        expiryDate = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000); // 5 years
      }

      if (token && transaction.paymentMethodId) {
        // Update existing payment method with token
        const updateData = {
          tokenExpiryDate: expiryDate,
          canAutoCharge: true,
          updatedAt: new Date()
        };

        if (provider === 'flutterwave') {
          updateData.flutterwaveToken = token;
          updateData.flutterwaveCustomerId = customerId;
        } else {
          updateData.paystackToken = token;
          updateData.paystackCustomerId = customerId;
        }

        await userPaymentMethodRepository.repo.update(transaction.paymentMethodId, updateData);

        console.log(`✅ Saved ${provider} token for payment method ${transaction.paymentMethodId}`);
      }

    } catch (error) {
      console.error('Error saving payment token:', error);
    }
  }

  /**
   * Verify Flutterwave payment
   * @param {string} transactionId - Flutterwave transaction ID
   * @returns {Promise<Object>} - Verification result
   */
  async verifyFlutterwavePayment(transactionId) {
    try {
      const response = await axios.get(
        `${this.flutterwaveBaseUrl}/transactions/${transactionId}/verify`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`
          }
        }
      );

      return {
        success: response.data.status === 'success' && response.data.data.status === 'successful',
        data: response.data.data
      };
    } catch (error) {
      console.error('Flutterwave verification error:', error);
      return { success: false, error: 'Verification failed' };
    }
  }

  /**
   * Verify Paystack payment
   * @param {string} reference - Paystack reference
   * @returns {Promise<Object>} - Verification result
   */
  async verifyPaystackPayment(reference) {
    try {
      const response = await axios.get(
        `${this.paystackBaseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
          }
        }
      );

      return {
        success: response.data.status && response.data.data.status === 'success',
        data: response.data.data
      };
    } catch (error) {
      console.error('Paystack verification error:', error);
      return { success: false, error: 'Verification failed' };
    }
  }

  /**
  * ENHANCED: Process payment webhook with appointment logic and subscription upgrades
  * @param {Object} webhookData - Webhook payload
  * @param {string} provider - Payment provider (flutterwave/paystack)
  * @returns {Promise<Object>} - Processing result
  */
  async processPaymentWebhook(webhookData, provider) {
    try {
      console.log('🎯 WEBHOOK PROCESSING STARTED');
      console.log('Provider:', provider);
      console.log('Webhook data:', JSON.stringify(webhookData, null, 2));

      if (!webhookData || !webhookData.data) {
        throw new Error('Invalid webhook data structure');
      }

      let transactionId, reference, status, verificationResult;
      let ourTransaction;

      if (provider === 'flutterwave') {
        // For Flutterwave, extract transaction reference from webhook
        transactionId = webhookData.data.id;
        reference = webhookData.data.tx_ref;
        status = webhookData.data.status;

        console.log('🔍 Flutterwave - Looking for transaction with reference:', reference);

        // Find our transaction by the tx_ref pattern
        if (reference && reference.startsWith('FLW-')) {
          const parts = reference.split('-');
          if (parts.length >= 6) {
            const ourTransactionId = `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}-${parts[5]}`;
            ourTransaction = await transactionRepository.findById(ourTransactionId);
          }
        }

        // If not found by ID, try by provider reference
        if (!ourTransaction) {
          ourTransaction = await transactionRepository.findByProviderReference(reference);
        }

        verificationResult = await this.verifyFlutterwavePayment(transactionId);

      } else if (provider === 'paystack') {
        reference = webhookData.data.reference;
        status = webhookData.data.status;

        console.log('🔍 Paystack - Looking for transaction with reference:', reference);

        // Find our transaction by the reference pattern
        if (reference && reference.startsWith('PST-')) {
          const parts = reference.split('-');
          if (parts.length >= 6) {
            const ourTransactionId = `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}-${parts[5]}`;
            ourTransaction = await transactionRepository.findById(ourTransactionId);
          }
        }

        // If not found by ID, try by provider reference
        if (!ourTransaction) {
          ourTransaction = await transactionRepository.findByProviderReference(reference);
        }

        verificationResult = await this.verifyPaystackPayment(reference);
      }

      if (!ourTransaction) {
        console.error('❌ Transaction not found for reference:', reference);
        throw new Error(`Transaction not found for reference: ${reference}`);
      }

      console.log('✅ Found transaction:', ourTransaction.id);

      if (!verificationResult.success) {
        console.error('❌ Payment verification failed');
        throw new Error('Payment verification failed');
      }

      console.log('✅ Payment verification successful');

      if (status === 'successful' || status === 'success') {
        console.log('🎉 Processing successful payment...');

        // Update transaction as completed
        await transactionRepository.repo.update(ourTransaction.id, {
          status: 'completed',
          providerTransactionId: provider === 'flutterwave' ? transactionId : reference,
          providerReference: reference,
          providerFee: verificationResult.data.app_fee || verificationResult.data.fees || 0,
          completedAt: new Date()
        });

        // Update payment method success rate
        if (ourTransaction.paymentMethodId) {
          await userPaymentMethodRepository.updateSuccessRate(
            ourTransaction.paymentMethodId,
            provider,
            true
          );
        }

        // Save payment token for future use
        await this.savePaymentToken(ourTransaction, verificationResult.data, provider);

        // Handle different service types
        if (ourTransaction.serviceType === 'subscription' || ourTransaction.serviceType === 'subscription_upgrade') {
          console.log('🔄 Processing subscription upgrade...');
          try {
            const SubscriptionService = require('../../subscriptions/services/subscriptionService');
            await SubscriptionService.processSubscriptionUpgradeAfterPayment(ourTransaction.id);
            console.log('✅ Subscription upgraded successfully');
          } catch (subscriptionError) {
            console.error('❌ Error upgrading subscription:', subscriptionError);
          }
        } else if (ourTransaction.doctorId && ourTransaction.serviceType === 'appointment') {
          console.log('💰 Processing appointment funds...');
          await this.processFundsForAppointmentPayment(ourTransaction);
          
          // 🔥 AUTOMATIC SYNC: Update appointment payment status immediately
          try {
            const AppointmentService = require('../../appointments/services/appointmentService');
            const appointmentService = new AppointmentService();
            await appointmentService.updatePaymentStatus(ourTransaction.serviceId, {
              paymentStatus: 'completed',
              paymentId: ourTransaction.id,
              paymentMethod: ourTransaction.paymentProvider || provider
            });
            console.log(`✅ Automatically updated appointment ${ourTransaction.serviceId} to paid status via webhook`);
          } catch (syncError) {
            console.error(`❌ Failed to automatically sync appointment status via webhook:`, syncError);
          }
        } else if (ourTransaction.doctorId) {
          console.log('💰 Processing immediate funds...');
          await this.processFundsImmediate(ourTransaction);
        }


        // 📧 NEW: Send payment receipt emails
        console.log('📧 Sending payment receipt email...');
        try {
          // const { sendAppointmentPaymentReceiptEmail, sendSubscriptionPaymentReceiptEmail } = require('../../../shared/services/email/emailHelpers');

          // Get patient details
          const patient = await userRepository.findById(ourTransaction.patientId);

          if (ourTransaction.serviceType === 'appointment') {
            // Send appointment receipt
            const splits = await transactionSplitRepository.findByTransactionId(ourTransaction.id);
            // Updated path to point to the correct feature location
            const AppointmentService = require('../../appointments/services/appointmentService');
            // Check if it's a class or instance. Assuming class based on usage 'new'.
            // If the service exports a class directly:
            const appointmentService = new AppointmentService();
            const appointment = await appointmentService.findById(ourTransaction.serviceId);

            if (appointment && patient) {
              await sendAppointmentPaymentReceiptEmail(patient, ourTransaction, appointment, splits);
              await sendAppointmentPaymentReceiptWhatsApp(patient, ourTransaction, appointment);
              console.log('✅ Appointment receipt email sent successfully');
            }
          } else if (ourTransaction.serviceType === 'subscription' || ourTransaction.serviceType === 'subscription_upgrade') {
            // Send subscription receipt
            // Updated path to point to the correct feature location
            const subscriptionCompatibilityService = require('../../subscriptions/services/subscriptionCompatibilityService');
            const subscription = await subscriptionCompatibilityService.getUserSubscription(ourTransaction.patientId);

            if (subscription && patient) {
              await sendSubscriptionPaymentReceiptEmail(patient, ourTransaction, subscription);
              await sendSubscriptionPaymentReceiptWhatsApp(patient, ourTransaction, subscription);
              console.log('✅ Subscription receipt email sent successfully');
            }
          }
        } catch (emailError) {
          console.error('❌ Error sending receipt email:', emailError);
          // Don't throw error - email failure shouldn't fail the payment processing
        }

        console.log('✅ Webhook processed successfully for transaction:', ourTransaction.id);
        return { success: true, transaction: ourTransaction };

      } else {
        console.log('❌ Payment failed, updating transaction status');

        // Mark as failed
        await transactionRepository.repo.update(ourTransaction.id, {
          status: 'failed',
          failedAt: new Date()
        });

        if (ourTransaction.paymentMethodId) {
          await userPaymentMethodRepository.updateSuccessRate(
            ourTransaction.paymentMethodId,
            provider,
            false
          );
        }

        return { success: false, error: 'Payment failed' };
      }
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      console.error('❌ Full webhook data:', JSON.stringify(webhookData, null, 2));
      throw error;
    }
  }

  /**
* Save payment token from transaction (wrapper method)
* @param {Object} transaction - Transaction object
* @returns {Promise<Object>} - Result of token saving operation
*/
  async savePaymentTokenFromTransaction(transaction) {
    try {
      console.log(`🔄 Attempting to save payment token for transaction ${transaction.id}`);

      if (!transaction.providerTransactionId || !transaction.paymentProvider) {
        console.log(`ℹ️ No provider transaction ID or provider specified for transaction ${transaction.id}`);
        return { success: true, message: 'No token to save' };
      }

      let verificationResult;

      // Get the provider response data by verifying the transaction
      if (transaction.paymentProvider === 'flutterwave') {
        verificationResult = await this.verifyFlutterwavePayment(transaction.providerTransactionId);
      } else if (transaction.paymentProvider === 'paystack') {
        verificationResult = await this.verifyPaystackPayment(transaction.providerReference || transaction.providerTransactionId);
      } else {
        throw new Error(`Unsupported payment provider: ${transaction.paymentProvider}`);
      }

      if (!verificationResult.success) {
        throw new Error('Failed to verify transaction for token extraction');
      }

      // Extract token information from provider response
      let tokenData = null;

      if (transaction.paymentProvider === 'flutterwave' && verificationResult.data.customer?.id) {
        tokenData = {
          flutterwaveToken: verificationResult.data.customer.id,
          flutterwaveCustomerId: verificationResult.data.customer.id,
          tokenExpiryDate: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000), // 5 years
          provider: 'flutterwave'
        };
      } else if (transaction.paymentProvider === 'paystack' && verificationResult.data.authorization?.authorization_code) {
        tokenData = {
          paystackToken: verificationResult.data.authorization.authorization_code,
          paystackCustomerId: verificationResult.data.customer?.id,
          tokenExpiryDate: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000), // 5 years
          provider: 'paystack'
        };
      }

      if (!tokenData) {
        console.log(`ℹ️ No reusable token found in ${transaction.paymentProvider} response for transaction ${transaction.id}`);
        return { success: true, message: 'No reusable token available' };
      }

      // Check if user has an existing payment method or create a new one
      if (transaction.paymentMethodId) {
        // Update existing payment method with token
        const updateData = {
          tokenExpiryDate: tokenData.tokenExpiryDate,
          canAutoCharge: true,
          updatedAt: new Date()
        };

        if (tokenData.provider === 'flutterwave') {
          updateData.flutterwaveToken = tokenData.flutterwaveToken;
          updateData.flutterwaveCustomerId = tokenData.flutterwaveCustomerId;
        } else {
          updateData.paystackToken = tokenData.paystackToken;
          updateData.paystackCustomerId = tokenData.paystackCustomerId;
        }

        await userPaymentMethodRepository.repo.update(transaction.paymentMethodId, updateData);

        console.log(`✅ Updated payment method ${transaction.paymentMethodId} with ${tokenData.provider} token`);
        return {
          success: true,
          message: 'Payment method updated with token',
          paymentMethodId: transaction.paymentMethodId
        };

      } else {
        // Create new payment method from transaction data
        const cardInfo = this.extractCardInfoFromVerification(verificationResult.data, transaction.paymentProvider);

        if (!cardInfo) {
          console.log(`ℹ️ Insufficient card information to create payment method for transaction ${transaction.id}`);
          return { success: true, message: 'Insufficient card info for payment method creation' };
        }

        const paymentMethodData = {
          userId: transaction.patientId,
          cardLast4: cardInfo.last4,
          cardType: cardInfo.type || 'unknown',
          cardBrand: cardInfo.brand || 'unknown',
          bankName: cardInfo.bank || 'Unknown Bank',
          cardBin: cardInfo.bin,
          cardCountry: cardInfo.country,
          tokenExpiryDate: tokenData.tokenExpiryDate,
          isDefault: false,
          canAutoCharge: true,
          isActive: true
        };

        // Set provider-specific token
        if (tokenData.provider === 'flutterwave') {
          paymentMethodData.flutterwaveToken = tokenData.flutterwaveToken;
          paymentMethodData.flutterwaveCustomerId = tokenData.flutterwaveCustomerId;
        } else {
          paymentMethodData.paystackToken = tokenData.paystackToken;
          paymentMethodData.paystackCustomerId = tokenData.paystackCustomerId;
        }

        const savedMethod = await this.savePaymentMethod(paymentMethodData);

        console.log(`✅ Created new payment method ${savedMethod.id} with ${tokenData.provider} token`);
        return {
          success: true,
          message: 'New payment method created with token',
          paymentMethodId: savedMethod.id
        };
      }

    } catch (error) {
      console.error('❌ Error saving payment token from transaction:', error);
      return {
        success: false,
        error: error.message || 'Failed to save payment token'
      };
    }
  }

  /**
  * Helper: Extract card information from provider verification response
  * @param {Object} providerData - Provider response data
  * @param {string} provider - Payment provider
  * @returns {Object|null} - Extracted card information
  */
  extractCardInfoFromVerification(providerData, provider) {
    try {
      if (provider === 'flutterwave' && providerData.card) {
        return {
          last4: providerData.card.last_4digits,
          type: providerData.card.type,
          brand: providerData.card.issuer,
          bank: providerData.card.issuer,
          bin: providerData.card.first_6digits,
          country: providerData.card.country
        };
      } else if (provider === 'paystack' && providerData.authorization) {
        return {
          last4: providerData.authorization.last4,
          type: providerData.authorization.card_type,
          brand: providerData.authorization.brand,
          bank: providerData.authorization.bank,
          bin: providerData.authorization.bin,
          country: providerData.authorization.country_code
        };
      }
      return null;
    } catch (error) {
      console.error('Error extracting card info:', error);
      return null;
    }
  }

  // ================================
  // APPOINTMENT PAYMENT HANDLING
  // ================================

  /**
   * NEW: Process funds for appointment payments
   * @param {Object} transaction - Transaction object
   * @returns {Promise<void>}
   */
  async processFundsForAppointmentPayment(transaction) {
    try {
      // Idempotency guard: if fundsStatus already set, funds were already processed
      if (transaction.fundsStatus && transaction.fundsStatus !== null) {
        console.log(`⚠️ Funds already processed for transaction ${transaction.id} (fundsStatus: ${transaction.fundsStatus}), skipping`);
        return;
      }

      const splits = await transactionSplitRepository.findByTransactionId(transaction.id);
      const doctorSplit = splits.find(split => split.recipientType === 'doctor_wallet');

      if (doctorSplit) {
        const now = new Date();
        const appointmentDate = new Date(transaction.appointmentDate);

        // Always add to pending credits immediately so doctor can see the money
        await doctorWalletRepository.addPendingCredits(
          transaction.doctorId,
          doctorSplit.usdAmount
        );

        if (appointmentDate <= now) {
          // Appointment is today or past - dispute window active
          await transactionRepository.repo.update(transaction.id, {
            fundsStatus: 'pending_dispute'
          });

          console.log(`✅ Added ${doctorSplit.usdAmount} to pending credits for doctor ${transaction.doctorId} (dispute window active)`);
        } else {
          // Appointment is in future - money visible but locked until appointment
          await transactionRepository.repo.update(transaction.id, {
            fundsStatus: 'pending_appointment'
          });

          console.log(`✅ Added ${doctorSplit.usdAmount} to pending credits for doctor ${transaction.doctorId} (visible but locked until appointment on ${appointmentDate.toISOString()})`);
        }
      }
    } catch (error) {
      console.error('Error processing appointment payment funds:', error);
    }
  }

  /**
   * NEW: Process funds immediately (non-appointment payments)
   * @param {Object} transaction - Transaction object
   * @returns {Promise<void>}
   */
  async processFundsImmediate(transaction) {
    try {
      const splits = await transactionSplitRepository.findByTransactionId(transaction.id);
      const doctorSplit = splits.find(split => split.recipientType === 'doctor_wallet');

      if (doctorSplit) {
        // Add to pending credits immediately (old 3-day rule)
        await doctorWalletRepository.addPendingCredits(
          transaction.doctorId,
          doctorSplit.usdAmount
        );

        console.log(`✅ Added ${doctorSplit.usdAmount} to pending credits for doctor ${transaction.doctorId} (non-appointment payment)`);
      }
    } catch (error) {
      console.error('Error processing immediate payment funds:', error);
    }
  }

  /**
   * NEW: Get transaction with enhanced status info
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} - Transaction with enhanced status information
   */
  async getTransactionWithFundsStatus(transactionId) {
    const transaction = await transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // Calculate status display
    const now = new Date();
    let statusDisplay, daysRemaining, canWithdraw = false;

    if (transaction.serviceType === 'appointment' && transaction.appointmentDate) {
      const appointmentDate = new Date(transaction.appointmentDate);
      const disputeEnds = new Date(transaction.disputeWindowEndsAt);

      if (transaction.fundsStatus === 'pending_appointment') {
        const daysToAppointment = Math.ceil((appointmentDate - now) / (1000 * 60 * 60 * 24));
        statusDisplay = `Waiting for appointment (${daysToAppointment} days)`;
        daysRemaining = daysToAppointment;
      } else if (transaction.fundsStatus === 'pending_dispute') {
        const daysToRelease = Math.ceil((disputeEnds - now) / (1000 * 60 * 60 * 24));
        statusDisplay = `Dispute window active (${daysToRelease} days remaining)`;
        daysRemaining = daysToRelease;
      } else if (transaction.fundsStatus === 'releasable') {
        statusDisplay = 'Available for withdrawal';
        canWithdraw = true;
      }
    } else {
      // Non-appointment payment
      const disputeEnds = new Date(transaction.disputeWindowEndsAt);
      const daysToRelease = Math.ceil((disputeEnds - now) / (1000 * 60 * 60 * 24));

      if (daysToRelease > 0) {
        statusDisplay = `Dispute window (${daysToRelease} days remaining)`;
        daysRemaining = daysToRelease;
      } else {
        statusDisplay = 'Available for withdrawal';
        canWithdraw = true;
      }
    }

    return {
      ...transaction,
      fundsStatusDisplay: statusDisplay,
      daysRemaining,
      canWithdraw,
      isAppointmentPayment: transaction.serviceType === 'appointment'
    };
  }

  // ================================
  // PAYMENT METHOD MANAGEMENT
  // ================================

  /**
   * Get user's payment methods with performance data
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Payment methods with success rates
   */
  async getUserPaymentMethods(userId) {
    const paymentMethods = await userPaymentMethodRepository.findByUserId(userId);

    return paymentMethods.map(method => ({
      ...method,
      flutterwaveSuccessRate: method.flutterwaveAttemptCount > 0
        ? method.flutterwaveSuccessCount / method.flutterwaveAttemptCount
        : null,
      paystackSuccessRate: method.paystackAttemptCount > 0
        ? method.paystackSuccessCount / method.paystackAttemptCount
        : null,
      hasValidTokens: !!(method.flutterwaveToken || method.paystackToken),
      tokenStatus: this.getTokenStatus(method)
    }));
  }

  /**
   * Helper: Get token status for a payment method
   */
  getTokenStatus(paymentMethod) {
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

  /**
   * Save a new payment method
   * @param {Object} data - Payment method data
   * @returns {Promise<Object>} - Saved payment method
   */
  async savePaymentMethod(data) {
    const { userId } = data;

    // Check if we should set as default (first payment method)
    const existingMethods = await userPaymentMethodRepository.findByUserId(userId);
    const isFirstMethod = existingMethods.length === 0;

    const paymentMethodData = {
      ...data,
      isDefault: isFirstMethod,
      isActive: true
    };

    const paymentMethod = userPaymentMethodRepository.create(paymentMethodData);
    return await userPaymentMethodRepository.save(paymentMethod);
  }

  /**
   * Set payment method as default
   * @param {string} userId - User ID
   * @param {string} paymentMethodId - Payment method ID
   * @returns {Promise<void>}
   */
  async setDefaultPaymentMethod(userId, paymentMethodId) {
    // Verify ownership
    const paymentMethod = await userPaymentMethodRepository.findById(paymentMethodId);
    if (!paymentMethod || paymentMethod.userId !== userId) {
      throw new Error("Payment method not found or unauthorized");
    }

    await userPaymentMethodRepository.setDefault(userId, paymentMethodId);
  }

  /**
   * Remove a payment method
   * @param {string} userId - User ID
   * @param {string} paymentMethodId - Payment method ID
   * @returns {Promise<void>}
   */
  async removePaymentMethod(userId, paymentMethodId) {
    // Verify ownership
    const paymentMethod = await userPaymentMethodRepository.findById(paymentMethodId);
    if (!paymentMethod || paymentMethod.userId !== userId) {
      throw new Error("Payment method not found or unauthorized");
    }

    await userPaymentMethodRepository.repo.update(paymentMethodId, { isActive: false });
  }

  // ================================
  // TRANSACTION QUERIES
  // ================================

  /**
   * Get transaction by ID with full details
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} - Transaction with splits and disputes
   */
  async getTransactionById(transactionId) {
    const transaction = await transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }
    return transaction;
  }

  /**
   * Get user's transaction history
   * @param {string} userId - User ID
   * @param {string} role - User role (patient/doctor)
   * @returns {Promise<Array>} - Transaction history
   */
  async getUserTransactions(userId, role, page = 1, limit = 20) {
    if (role === 'patient') {
      return await transactionRepository.findByPatientId(userId);
    } else if (role === 'doctor') {
      return await transactionRepository.findByDoctorId(userId);
    } else {
      throw new Error("Invalid role specified");
    }
  }

  /**
   * Get transactions by service type
   * @param {string} serviceType - Service type
   * @returns {Promise<Array>} - Transactions
   */
  async getTransactionsByServiceType(serviceType) {
    return await transactionRepository.findByServiceType(serviceType);
  }

  /**
   * Get transactions by service ID
   * @param {string} serviceType - Service type
   * @param {string} serviceId - Service ID
   * @returns {Promise<Array>} - Transactions
   */
  async getTransactionsByServiceId(serviceType, serviceId) {
    return await transactionRepository.findByServiceId(serviceType, serviceId);
  }

  // ================================
  // APPOINTMENT MANAGEMENT
  // ================================

  /**
   * Cancel appointment payment and process refund
   * @param {string} transactionId - Transaction ID
   * @param {Object} cancellationData - Cancellation details
   * @returns {Promise<Object>} - Cancellation result
   */
  async cancelAppointmentPayment(transactionId, cancellationData = {}) {
    try {
      const transaction = await transactionRepository.findById(transactionId);
      if (!transaction) {
        throw new Error("Transaction not found");
      }

      // Validate this is an appointment payment
      if (transaction.serviceType !== 'appointment') {
        throw new Error("Can only cancel appointment payments");
      }

      // Check if already cancelled
      if (transaction.isCancelled) {
        throw new Error("Transaction is already cancelled");
      }

      // Check if payment is completed
      if (transaction.status !== 'completed') {
        throw new Error("Can only cancel completed payments");
      }

      // Check if funds are already released to doctor
      if (transaction.fundsStatus === 'released') {
        throw new Error("Cannot cancel - funds already released to doctor");
      }

      // Get transaction splits to calculate refund
      const splits = await transactionSplitRepository.findByTransactionId(transactionId);
      const appointmentFeeSplit = splits.find(split => split.type === 'appointment_fee');

      if (!appointmentFeeSplit) {
        throw new Error("No appointment fee found to refund");
      }

      // Determine refund amount based on who cancelled and how close to appointment
      const cancelledByRole = cancellationData.cancelledByRole || 'patient';
      const now = new Date();
      const appointmentDate = new Date(transaction.appointmentDate);
      const hoursUntilAppointment = (appointmentDate - now) / (1000 * 60 * 60);

      let refundAmount;
      let refundPolicy;

      if (cancelledByRole === 'doctor' || cancelledByRole === 'system' ||
          cancelledByRole === 'admin' || cancelledByRole === 'super_admin') {
        // Doctor/admin/system cancellation → always full refund, patient did nothing wrong
        refundAmount = transaction.usdAmount;
        refundPolicy = 'full';
        console.log(`💰 Full refund of $${refundAmount} (cancelled by ${cancelledByRole})`);
      } else if (hoursUntilAppointment >= 24) {
        // 24h+ before appointment → full refund
        refundAmount = transaction.usdAmount;
        refundPolicy = 'full';
        console.log(`💰 Full refund of $${refundAmount} (cancelled ${Math.floor(hoursUntilAppointment)}h before appointment)`);
      } else if (hoursUntilAppointment >= 2) {
        // 2h–24h before appointment → 50% refund
        refundAmount = parseFloat((transaction.usdAmount * 0.5).toFixed(2));
        refundPolicy = 'partial';
        console.log(`💰 50% refund of $${refundAmount} (cancelled ${Math.floor(hoursUntilAppointment)}h before appointment)`);
      } else {
        // Under 2h or appointment already passed → no refund
        refundAmount = 0;
        refundPolicy = 'none';
        console.log(`💰 No refund (cancelled ${hoursUntilAppointment < 0 ? 'after' : 'under 2h before'} appointment)`);
      }

      // Update transaction as cancelled — do NOT set fundsStatus to 'released'
      // isCancelled flag is the correct guard; the dispute window job already filters isCancelled = false
      await transactionRepository.repo.update(transactionId, {
        isCancelled: true,
        cancelledAt: now,
        refundStatus: 'pending',
        refundAmount: refundAmount
      });

      // Remove pending credits from doctor wallet if funds were already credited
      // Covers both pending_appointment and pending_dispute states
      if (transaction.doctorId && (
        transaction.fundsStatus === 'pending_appointment' ||
        transaction.fundsStatus === 'pending_dispute'
      )) {
        await doctorWalletRepository.removePendingCredits(
          transaction.doctorId,
          appointmentFeeSplit.usdAmount
        );
        console.log(`🔄 Removed $${appointmentFeeSplit.usdAmount} pending credits from doctor ${transaction.doctorId}`);
      }

      // If no refund due, skip provider call and resolve immediately
      if (refundAmount === 0) {
        await transactionRepository.repo.update(transactionId, {
          refundStatus: 'none',
          refundProcessedAt: new Date()
        });
        console.log(`✅ Cancelled appointment payment ${transactionId} - no refund (policy: ${refundPolicy})`);
        return {
          success: true,
          message: "Appointment payment cancelled. No refund applies based on cancellation policy.",
          data: {
            transactionId,
            refundAmount: 0,
            refundStatus: 'none',
            keptAmount: parseFloat(transaction.usdAmount),
            cancelledAt: now
          }
        };
      }

      // Process the refund via payment provider
      const refundResult = await this.processRefund(transaction, refundAmount);

      if (refundResult.success) {
        await transactionRepository.repo.update(transactionId, {
          refundStatus: refundPolicy,
          refundProcessedAt: new Date()
        });

        console.log(`✅ Cancelled appointment payment ${transactionId} - refunded $${refundAmount} to patient (policy: ${refundPolicy})`);

        return {
          success: true,
          message: "Appointment payment cancelled and refund processed",
          data: {
            transactionId,
            refundAmount,
            refundStatus: refundPolicy,
            keptAmount: parseFloat((transaction.usdAmount - refundAmount).toFixed(2)),
            cancelledAt: now
          }
        };
      } else {
        // Mark refund as failed
        await transactionRepository.repo.update(transactionId, {
          refundStatus: 'failed'
        });

        throw new Error(`Refund processing failed: ${refundResult.error}`);
      }

    } catch (error) {
      console.error('Error cancelling appointment payment:', error);
      throw error;
    }
  }

  /**
   * Reschedule appointment payment with new date
   * @param {string} transactionId - Transaction ID  
   * @param {string} newAppointmentDate - New appointment date
   * @returns {Promise<Object>} - Reschedule result
   */
  async rescheduleAppointmentPayment(transactionId, newAppointmentDate) {
    try {
      const transaction = await transactionRepository.findById(transactionId);
      if (!transaction) {
        throw new Error("Transaction not found");
      }

      // Validate this is an appointment payment
      if (transaction.serviceType !== 'appointment') {
        throw new Error("Can only reschedule appointment payments");
      }

      // Check if already cancelled
      if (transaction.isCancelled) {
        throw new Error("Cannot reschedule cancelled appointment");
      }

      // Check if payment is completed
      if (transaction.status !== 'completed') {
        throw new Error("Can only reschedule completed payments");
      }

      // Check if funds are already released
      if (transaction.fundsStatus === 'released') {
        throw new Error("Cannot reschedule - funds already released to doctor");
      }

      const newApptDate = new Date(newAppointmentDate);
      const now = new Date();
      const originalDate = transaction.appointmentDate;

      // Calculate new dispute window timing
      let newDisputeWindowStartsAt, newDisputeWindowEndsAt, newFundsStatus;

      if (newApptDate <= now) {
        // New appointment is today or in the past - start dispute window immediately
        newDisputeWindowStartsAt = now;
        newDisputeWindowEndsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        newFundsStatus = 'pending_dispute';
      } else {
        // New appointment is in the future - wait for appointment date
        newDisputeWindowStartsAt = newApptDate;
        newDisputeWindowEndsAt = new Date(newApptDate.getTime() + 3 * 24 * 60 * 60 * 1000);
        newFundsStatus = 'pending_appointment';
      }

      // Handle funds based on status change
      const splits = await transactionSplitRepository.findByTransactionId(transactionId);
      const doctorSplit = splits.find(split => split.recipientType === 'doctor_wallet');

      if (doctorSplit && transaction.doctorId) {
        // If moving from pending_dispute to pending_appointment, remove pending credits
        if (transaction.fundsStatus === 'pending_dispute' && newFundsStatus === 'pending_appointment') {
          await doctorWalletRepository.removePendingCredits(
            transaction.doctorId,
            doctorSplit.usdAmount
          );
          console.log(`🔄 Removed ${doctorSplit.usdAmount} pending credits - appointment moved to future`);
        }
        // If moving from pending_appointment to pending_dispute, add pending credits
        else if (transaction.fundsStatus === 'pending_appointment' && newFundsStatus === 'pending_dispute') {
          await doctorWalletRepository.addPendingCredits(
            transaction.doctorId,
            doctorSplit.usdAmount
          );
          console.log(`✅ Added ${doctorSplit.usdAmount} pending credits - appointment moved to past/today`);
        }
      }

      // Update transaction with new appointment details
      const updateData = {
        originalAppointmentDate: originalDate,
        appointmentDate: newApptDate,
        disputeWindowStartsAt: newDisputeWindowStartsAt,
        disputeWindowEndsAt: newDisputeWindowEndsAt,
        fundsStatus: newFundsStatus,
        rescheduleCount: (transaction.rescheduleCount || 0) + 1,
        lastRescheduledAt: new Date()
      };

      await transactionRepository.repo.update(transactionId, updateData);

      console.log(`✅ Rescheduled appointment payment ${transactionId} from ${originalDate} to ${newApptDate}`);

      return {
        success: true,
        message: "Appointment payment rescheduled successfully",
        data: {
          transactionId,
          originalAppointmentDate: originalDate,
          newAppointmentDate: newApptDate,
          fundsStatus: newFundsStatus,
          disputeWindowStartsAt: newDisputeWindowStartsAt,
          disputeWindowEndsAt: newDisputeWindowEndsAt,
          rescheduleCount: updateData.rescheduleCount
        }
      };

    } catch (error) {
      console.error('Error rescheduling appointment payment:', error);
      throw error;
    }
  }

  /**
   * Process refund to patient
   * @param {Object} transaction - Transaction object
   * @param {number} refundAmount - Amount to refund in USD
   * @returns {Promise<Object>} - Refund result
   */
  async processRefund(transaction, refundAmount) {
    try {
      console.log(`🔄 Processing refund of ${refundAmount} for transaction ${transaction.id}`);

      // Convert refund amount to original currency
      const refundInOriginalCurrency = refundAmount / transaction.exchangeRateUsed;

      // Choose refund method based on original payment provider
      let refundResult;
      if (transaction.paymentProvider === 'flutterwave') {
        refundResult = await this.processFlutterwaveRefund(transaction, refundInOriginalCurrency);
      } else if (transaction.paymentProvider === 'paystack') {
        refundResult = await this.processPaystackRefund(transaction, refundInOriginalCurrency);
      } else {
        throw new Error(`Unsupported payment provider for refund: ${transaction.paymentProvider}`);
      }

      if (refundResult.success) {
        console.log(`✅ Refund processed successfully via ${transaction.paymentProvider}`);
        return {
          success: true,
          refundReference: refundResult.reference,
          refundAmount: refundAmount,
          refundCurrency: transaction.originalCurrency,
          refundAmountOriginalCurrency: refundInOriginalCurrency,
          provider: transaction.paymentProvider
        };
      } else {
        throw new Error(refundResult.error || 'Refund processing failed');
      }

    } catch (error) {
      console.error('Error processing refund:', error);
      return {
        success: false,
        error: error.message || 'Refund processing failed'
      };
    }
  }

  /**
   * Process Flutterwave refund
   * @param {Object} transaction - Transaction object
   * @param {number} refundAmount - Amount in original currency
   * @returns {Promise<Object>} - Refund result
   */
  async processFlutterwaveRefund(transaction, refundAmount) {
    try {
      const payload = {
        id: transaction.providerTransactionId,
        amount: refundAmount
      };

      const response = await axios.post(
        `${this.flutterwaveBaseUrl}/transactions/${transaction.providerTransactionId}/refund`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status === 'success') {
        return {
          success: true,
          reference: response.data.data.id,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Flutterwave refund failed'
        };
      }

    } catch (error) {
      console.error('Flutterwave refund error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Flutterwave refund processing failed'
      };
    }
  }

  /**
   * Process Paystack refund
   * @param {Object} transaction - Transaction object
   * @param {number} refundAmount - Amount in original currency
   * @returns {Promise<Object>} - Refund result
   */
  async processPaystackRefund(transaction, refundAmount) {
    try {
      const payload = {
        transaction: transaction.providerReference,
        amount: Math.round(refundAmount * 100), // Convert to kobo/pesewas
        currency: transaction.originalCurrency,
        customer_note: "Appointment cancellation refund",
        merchant_note: `Refund for cancelled appointment - Transaction ${transaction.id}`
      };

      const response = await axios.post(
        `${this.paystackBaseUrl}/refund`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status) {
        return {
          success: true,
          reference: response.data.data.id,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Paystack refund failed'
        };
      }

    } catch (error) {
      console.error('Paystack refund error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Paystack refund processing failed'
      };
    }
  }

  /**
   * Get cancelled transactions summary
   * @param {string} userId - User ID (optional)
   * @param {string} role - User role
   * @returns {Promise<Object>} - Cancelled transactions summary
   */
  async getCancelledTransactionsSummary(userId = null, role = null) {
    try {
      let queryBuilder = transactionRepository.repo.createQueryBuilder('transaction')
        .where('transaction.isCancelled = :isCancelled', { isCancelled: true })
        .andWhere('transaction.serviceType = :serviceType', { serviceType: 'appointment' });

      // Filter by user if provided
      if (userId && role) {
        if (role === 'patient') {
          queryBuilder = queryBuilder.andWhere('transaction.patientId = :userId', { userId });
        } else if (role === 'doctor') {
          queryBuilder = queryBuilder.andWhere('transaction.doctorId = :userId', { userId });
        }
      }

      const cancelledTransactions = await queryBuilder.getMany();

      // Calculate summary statistics
      const summary = {
        totalCancelled: cancelledTransactions.length,
        totalRefundedAmount: 0,
        totalKeptAmount: 0,
        refundStatusBreakdown: {
          pending: 0,
          full: 0,
          failed: 0
        }
      };

      cancelledTransactions.forEach(transaction => {
        summary.totalRefundedAmount += transaction.refundAmount || 0;
        summary.totalKeptAmount += (transaction.usdAmount - (transaction.refundAmount || 0));

        if (transaction.refundStatus === 'pending') summary.refundStatusBreakdown.pending++;
        else if (transaction.refundStatus === 'full') summary.refundStatusBreakdown.full++;
        else if (transaction.refundStatus === 'failed') summary.refundStatusBreakdown.failed++;
      });

      return {
        success: true,
        data: {
          summary,
          transactions: cancelledTransactions
        }
      };

    } catch (error) {
      console.error('Error getting cancelled transactions summary:', error);
      throw error;
    }
  }

  // ================================
  // ANALYTICS AND STATISTICS
  // ================================

  /**
   * Get payment statistics for admin dashboard
   * @returns {Promise<Object>} - Payment statistics
   */
  async getPaymentStatistics() {
    try {
      const stats = await transactionRepository.repo.createQueryBuilder('transaction')
        .select([
          'COUNT(*) as totalTransactions',
          'SUM(CASE WHEN status = \'completed\' THEN usdAmount ELSE 0 END) as totalRevenue',
          'COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completedTransactions',
          'COUNT(CASE WHEN status = \'failed\' THEN 1 END) as failedTransactions',
          'COUNT(CASE WHEN status = \'disputed\' THEN 1 END) as disputedTransactions',
          'AVG(CASE WHEN status = \'completed\' THEN usdAmount END) as averageTransactionValue',
          'COUNT(CASE WHEN serviceType = \'appointment\' AND status = \'completed\' THEN 1 END) as appointmentTransactions',
          'COUNT(CASE WHEN serviceType = \'subscription\' AND status = \'completed\' THEN 1 END) as subscriptionTransactions',
          'COUNT(CASE WHEN serviceType = \'consultation\' AND status = \'completed\' THEN 1 END) as consultationTransactions'
        ])
        .getRawOne();

      return {
        totalTransactions: parseInt(stats.totalTransactions),
        totalRevenueUsd: parseFloat(stats.totalRevenue || 0),
        completedTransactions: parseInt(stats.completedTransactions || 0),
        failedTransactions: parseInt(stats.failedTransactions || 0),
        disputedTransactions: parseInt(stats.disputedTransactions || 0),
        averageTransactionValueUsd: parseFloat(stats.averageTransactionValue || 0),
        appointmentTransactions: parseInt(stats.appointmentTransactions || 0),
        subscriptionTransactions: parseInt(stats.subscriptionTransactions || 0),
        consultationTransactions: parseInt(stats.consultationTransactions || 0),
        successRate: stats.totalTransactions > 0
          ? (stats.completedTransactions / stats.totalTransactions * 100).toFixed(2)
          : 0
      };
    } catch (error) {
      console.error('Error getting payment statistics:', error);
      throw new Error('Unable to fetch payment statistics');
    }
  }

  /**
   * Get service-specific analytics
   * @param {string} serviceType - Service type (optional)
   * @returns {Promise<Object>} - Service analytics
   */
  async getServiceAnalytics(serviceType = null) {
    try {
      let queryBuilder = transactionRepository.repo.createQueryBuilder('transaction')
        .select([
          'serviceType',
          'originalCurrency',
          'COUNT(*) as transactionCount',
          'SUM(CASE WHEN status = \'completed\' THEN originalAmount ELSE 0 END) as totalRevenue',
          'AVG(CASE WHEN status = \'completed\' THEN originalAmount END) as averageAmount',
          'COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completedCount',
          'COUNT(CASE WHEN status = \'failed\' THEN 1 END) as failedCount'
        ])
        .groupBy('serviceType, originalCurrency');

      if (serviceType) {
        queryBuilder = queryBuilder.where('serviceType = :serviceType', { serviceType });
      }

      const results = await queryBuilder.getRawMany();

      return {
        success: true,
        data: results.map(result => ({
          serviceType: result.serviceType,
          currency: result.originalCurrency,
          transactionCount: parseInt(result.transactionCount),
          totalRevenue: parseFloat(result.totalRevenue || 0),
          averageAmount: parseFloat(result.averageAmount || 0),
          completedCount: parseInt(result.completedCount || 0),
          failedCount: parseInt(result.failedCount || 0),
          successRate: result.transactionCount > 0
            ? (result.completedCount / result.transactionCount * 100).toFixed(2)
            : 0
        }))
      };
    } catch (error) {
      console.error('Error getting service analytics:', error);
      throw error;
    }
  }

  /**
   * Get provider performance analytics
   * @returns {Promise<Object>} - Provider performance data
   */
  async getProviderPerformanceAnalytics() {
    try {
      const stats = await transactionRepository.repo.createQueryBuilder('transaction')
        .select([
          'paymentProvider',
          'COUNT(*) as totalTransactions',
          'COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completedTransactions',
          'COUNT(CASE WHEN status = \'failed\' THEN 1 END) as failedTransactions',
          'SUM(CASE WHEN status = \'completed\' THEN providerFee ELSE 0 END) as totalFees',
          'AVG(CASE WHEN status = \'completed\' THEN providerFee END) as averageFee'
        ])
        .where('paymentProvider IS NOT NULL')
        .groupBy('paymentProvider')
        .getRawMany();

      return {
        success: true,
        data: stats.map(stat => ({
          provider: stat.paymentProvider,
          totalTransactions: parseInt(stat.totalTransactions),
          completedTransactions: parseInt(stat.completedTransactions || 0),
          failedTransactions: parseInt(stat.failedTransactions || 0),
          totalFees: parseFloat(stat.totalFees || 0),
          averageFee: parseFloat(stat.averageFee || 0),
          successRate: stat.totalTransactions > 0
            ? (stat.completedTransactions / stat.totalTransactions * 100).toFixed(2)
            : 0
        }))
      };
    } catch (error) {
      console.error('Error getting provider performance analytics:', error);
      throw error;
    }
  }

  /**
   * Get currency-specific analytics
   * @returns {Promise<Object>} - Currency analytics
   */
  async getCurrencyAnalytics() {
    try {
      const stats = await transactionRepository.repo.createQueryBuilder('transaction')
        .select([
          'originalCurrency',
          'COUNT(*) as transactionCount',
          'SUM(CASE WHEN status = \'completed\' THEN originalAmount ELSE 0 END) as totalRevenue',
          'SUM(CASE WHEN status = \'completed\' THEN usdAmount ELSE 0 END) as totalRevenueUsd',
          'AVG(CASE WHEN status = \'completed\' THEN exchangeRateUsed END) as averageExchangeRate'
        ])
        .groupBy('originalCurrency')
        .getRawMany();

      return {
        success: true,
        data: stats.map(stat => ({
          currency: stat.originalCurrency,
          transactionCount: parseInt(stat.transactionCount),
          totalRevenue: parseFloat(stat.totalRevenue || 0),
          totalRevenueUsd: parseFloat(stat.totalRevenueUsd || 0),
          averageExchangeRate: parseFloat(stat.averageExchangeRate || 0)
        }))
      };
    } catch (error) {
      console.error('Error getting currency analytics:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();
