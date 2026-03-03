// src/features/subscriptions/services/billingService.js
/**
 * BillingService - Handles all payment and billing operations
 *
 * Responsibilities:
 * - Create subscription payments
 * - Process payments after completion
 * - Handle auto-billing/renewals
 * - Manage billing settings
 *
 * This service delegates to the payment feature for actual payment processing.
 */

const { PLAN_DEFINITIONS } = require("../utils/subscriptionConstants");
const subscriptionRepository = require("../repositories/subscriptionRepository");
const userRepository = require("../../auth/repositories/userRepository");

const transactionRepository = require("../../payments/repositories/transactionRepository");
const cache = require("../../../shared/utils/cache");

class BillingService {
  // =============================================================================
  // PAYMENT CREATION
  // =============================================================================

  /**
   * Create a subscription payment
   * @param {Object} options - Payment options
   * @returns {Object} Payment result with redirect URL or auto-upgrade status
   */
  async createPayment({
    userId,
    planType,
    tier,
    countryCode = "US",
    paymentProvider = "auto",
    enableAutoBilling = false
  }) {
    // Validate inputs
    if (tier === "free") {
      throw new Error("Cannot create payment for free plan");
    }

    const plan = this._getPlanDefinition(planType, tier);
    const user = await userRepository.findById(userId);
    if (!user) throw new Error("User not found");

    // Get pricing
    const pricing = this._getPricing(plan, countryCode);

    // Auto-upgrade if price is 0
    if (pricing.amount <= 0) {
      return this._handleFreeUpgrade(userId, planType, tier, plan, pricing);
    }

    // Select payment provider
    const provider = this._selectProvider(paymentProvider, pricing.currency);

    // Create transaction
    const paymentServicePath = "../../payments/services/paymentService";
    const paymentService = require(paymentServicePath);
    const transaction = await paymentService.initiatePayment({
      patientId: userId,
      serviceType: "subscription",
      originalAmount: pricing.amount,
      originalCurrency: pricing.currency,
      paymentProvider: provider,
      description: `Upgrade to ${plan.name}`
    });

    // Store metadata
    await transactionRepository.repo.update(transaction.id, {
      metadata: {
        planType,
        newTier: tier,
        enableAutoBilling,
        countryCode,
        originalPrice: pricing.originalAmount,
        discountAmount: pricing.discount,
        discountPercentage: pricing.discountPercentage
      }
    });

    // Get redirect URL
    const redirectUrl = await this._getPaymentRedirectUrl(transaction, user, provider, plan);

    return {
      success: true,
      transactionId: transaction.id,
      redirectUrl,
      planType,
      tier,
      planName: plan.name,
      amount: pricing.amount,
      currency: pricing.currency,
      paymentProvider: provider
    };
  }

  /**
   * Process subscription upgrade after payment completion
   * @param {string} transactionId - Completed transaction ID
   */
  async processPaymentComplete(transactionId) {
    const transaction = await this._getCompletedTransaction(transactionId);
    const { planType, newTier, enableAutoBilling, countryCode } = transaction.metadata;

    const plan = this._getPlanDefinition(planType, newTier);
    const pricing = this._getPricing(plan, countryCode || "US");

    // Update subscription
    await this._activateSubscription({
      userId: transaction.patientId,
      tier: newTier,
      planType,
      plan,
      pricing,
      enableAutoBilling,
      transactionId
    });

    // Clear cache
    await this._clearCache(transaction.patientId);

    return {
      success: true,
      userId: transaction.patientId,
      tier: newTier,
      planType
    };
  }

  // =============================================================================
  // AUTO-BILLING
  // =============================================================================

  /**
   * Enable auto-billing for a subscription
   */
  async enableAutoBilling(userId, paymentMethodId) {
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub) throw new Error("No active subscription found");
    if (sub.tier === "free") throw new Error("Auto-billing not available for free tier");

    await subscriptionRepository.enableAutoBilling(sub.id, paymentMethodId);
    await this._clearCache(userId);

    return { success: true };
  }

  /**
   * Disable auto-billing
   */
  async disableAutoBilling(userId) {
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub) throw new Error("No active subscription found");

    await subscriptionRepository.disableAutoBilling(sub.id);
    await this._clearCache(userId);

    return { success: true };
  }

  /**
   * Get auto-billing settings
   */
  async getAutoBillingSettings(userId) {
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub) return { enabled: false };

    return {
      enabled: sub.autoBillingEnabled || false,
      autoRenew: sub.autoRenew || false,
      nextBillingDate: sub.nextBillingDate,
      paymentMethodId: sub.preferredPaymentMethodId,
      failureCount: sub.autoBillingFailureCount || 0
    };
  }

  /**
   * Process auto-renewals (called by cron job)
   */
  async processAutoRenewals() {
    const subscriptions = await subscriptionRepository.findSubscriptionsForAutoBilling();
    const results = { processed: 0, failed: 0 };

    for (const sub of subscriptions) {
      try {
        await this._processOneRenewal(sub);
        results.processed++;
      } catch (error) {
        console.error(`Auto-renewal failed for ${sub.id}:`, error.message);
        await this._handleRenewalFailure(sub);
        results.failed++;
      }
    }

    return results;
  }

  // =============================================================================
  // CANCELLATION
  // =============================================================================

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId, reason = null) {
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub) throw new Error("No active subscription to cancel");

    await subscriptionRepository.repo.update(sub.id, {
      status: "canceled",
      canceledAt: new Date(),
      autoRenew: false,
      autoBillingEnabled: false,
      metadata: { ...sub.metadata, cancelReason: reason }
    });

    await this._clearCache(userId);

    return { success: true, canceledAt: new Date() };
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  _getPlanDefinition(planType, tier) {
    const plan = PLAN_DEFINITIONS[planType]?.[tier];
    if (!plan) throw new Error(`Invalid plan: ${planType}:${tier}`);
    return plan;
  }

  _getPricing(plan, countryCode) {
    const currency = countryCode === "NG" ? "NGN" : "USD";
    const amount = plan.price[currency] || plan.price.USD;
    const originalAmount = plan.originalPrice?.[currency] || plan.originalPrice?.USD || amount;

    return {
      amount,
      originalAmount,
      discount: originalAmount - amount,
      discountPercentage: plan.discountPercentage || 0,
      currency
    };
  }

  _selectProvider(requested, currency) {
    if (requested !== "auto") return requested;
    return currency === "NGN" ? "paystack" : "flutterwave";
  }

  async _getPaymentRedirectUrl(transaction, user, provider, plan) {
    const userData = {
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      title: "Subscription Upgrade",
      description: `Upgrade to ${plan.name}`
    };

    const paymentServicePath = "../../payments/services/paymentService";
    const paymentService = require(paymentServicePath);
    const result = provider === "flutterwave"
      ? await paymentService.processFlutterwavePayment(transaction, userData)
      : await paymentService.processPaystackPayment(transaction, userData);

    if (!result.success || !result.authUrl) {
      throw new Error("Payment provider failed to generate redirect URL");
    }

    return result.authUrl;
  }

  async _handleFreeUpgrade(userId, planType, tier, plan, pricing) {
    // Directly upgrade without payment
    await this._activateSubscription({
      userId,
      tier,
      planType,
      plan,
      pricing,
      enableAutoBilling: false,
      transactionId: null
    });

    await this._clearCache(userId);

    return {
      success: true,
      autoUpgraded: true,
      transactionId: null,
      redirectUrl: null,
      planType,
      tier,
      planName: plan.name,
      amount: 0,
      message: `Upgraded to ${plan.name} at no cost!`
    };
  }

  async _getCompletedTransaction(transactionId) {
    const transaction = await transactionRepository.findById(transactionId);
    if (!transaction) throw new Error("Transaction not found");
    if (transaction.status !== "completed") throw new Error("Transaction not completed");
    return transaction;
  }

  async _activateSubscription({ userId, tier, planType, plan, pricing, enableAutoBilling, transactionId }) {
    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const data = {
      tier,
      planType,
      status: "active",
      startDate: now,
      endDate,
      nextBillingDate: endDate,
      price: pricing.amount,
      currency: pricing.currency,
      autoRenew: enableAutoBilling,
      autoBillingEnabled: enableAutoBilling,
      commissionRate: plan.commissionRate,
      features: plan.features,
      monthlyLimits: plan.monthlyLimits,
      currentUsage: {},
      familyMembers: plan.familyMembers || 1,
      billingCycle: "monthly",
      updatedAt: now,
      metadata: { transactionId, activatedAt: now.toISOString() }
    };

    let sub = await subscriptionRepository.findActiveByUserId(userId);
    if (sub) {
      await subscriptionRepository.repo.update(sub.id, data);
    } else {
      sub = subscriptionRepository.create({ userId, ...data });
      await subscriptionRepository.save(sub);
    }

    // Update user tier for backward compatibility
    await userRepository.repo.update(userId, { tier });
  }

  async _processOneRenewal(subscription) {
    // This would use saved payment tokens to charge
    // Simplified version - actual implementation would use payment tokens
    const newEndDate = this._calculateNextBillingDate(subscription.billingCycle);

    await subscriptionRepository.repo.update(subscription.id, {
      endDate: newEndDate,
      nextBillingDate: newEndDate,
      autoBillingFailureCount: 0,
      updatedAt: new Date(),
      metadata: { ...subscription.metadata, lastRenewal: new Date().toISOString() }
    });
  }

  async _handleRenewalFailure(subscription) {
    const failures = (subscription.autoBillingFailureCount || 0) + 1;

    await subscriptionRepository.repo.update(subscription.id, {
      autoBillingFailureCount: failures,
      lastAutoBillingAttempt: new Date()
    });

    // Disable after 3 failures
    if (failures >= 3) {
      await subscriptionRepository.disableAutoBilling(subscription.id);
    }
  }

  _calculateNextBillingDate(cycle = "monthly") {
    const date = new Date();
    switch (cycle) {
      case "quarterly": date.setMonth(date.getMonth() + 3); break;
      case "yearly": date.setFullYear(date.getFullYear() + 1); break;
      default: date.setMonth(date.getMonth() + 1);
    }
    return date;
  }

  async _clearCache(userId) {
    try {
      await cache.del(`user:${userId}:subscription`);
      await cache.del(`user:${userId}:subscription:basic`);
    } catch (e) {
      console.warn("Cache clear failed:", e.message);
    }
  }
}

module.exports = new BillingService();
