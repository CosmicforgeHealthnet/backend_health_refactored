// src/features/subscriptions/services/subscriptionService.js
/**
 * SubscriptionService - Subscription lifecycle management
 *
 * This service handles:
 * - Subscription processing (expiry, downgrade)
 * - Upgrade/downgrade operations
 * - Doctor-specific handling
 *
 * Payment operations are delegated to BillingService
 * Notifications are delegated to SubscriptionNotificationService
 */

const { PLAN_DEFINITIONS } = require("../utils/subscriptionConstants");
const subscriptionRepository = require("../repositories/subscriptionRepository");
const subscriptionCompatibilityService = require("./subscriptionCompatibilityService");
const userRepository = require("../../auth/repositories/userRepository");
const doctorWalletRepository = require("../../payments/repositories/doctorWalletRepository");
const cache = require("../../../shared/utils/cache");

// Delegate services
const BillingService = require("./billingService");
const NotificationService = require("./subscriptionNotificationService");

class SubscriptionService {
  // =============================================================================
  // PAYMENT OPERATIONS (Delegated to BillingService)
  // =============================================================================

  static async createSubscriptionPayment(userId, planType, newTier, countryCode, paymentProvider, enableAutoBilling) {
    return BillingService.createPayment({
      userId,
      planType,
      tier: newTier,
      countryCode,
      paymentProvider,
      enableAutoBilling
    });
  }

  static async processSubscriptionUpgradeAfterPayment(transactionId) {
    const result = await BillingService.processPaymentComplete(transactionId);

    // Send notification
    const user = await userRepository.findById(result.userId);
    if (user) {
      const plan = PLAN_DEFINITIONS[result.planType]?.[result.tier];
      await NotificationService.sendUpgradeSuccess(user, plan?.name || result.tier, result.tier);
    }

    // Handle doctor commission
    if (result.planType === "doctor") {
      const plan = PLAN_DEFINITIONS.doctor[result.tier];
      await this.handleDoctorUpgrade(result.userId, plan?.commissionRate || 30);
    }

    return result;
  }

  static async cancelSubscription(userId, reason = null) {
    const result = await BillingService.cancelSubscription(userId, reason);

    const user = await userRepository.findById(userId);
    if (user) {
      await NotificationService.sendCancellationConfirmation(user, reason);
    }

    return result;
  }

  // =============================================================================
  // AUTO-BILLING (Delegated to BillingService)
  // =============================================================================

  static async enableAutoBilling(userId, paymentMethodId) {
    return BillingService.enableAutoBilling(userId, paymentMethodId);
  }

  static async disableAutoBilling(userId) {
    return BillingService.disableAutoBilling(userId);
  }

  static async processAutoRenewals() {
    return BillingService.processAutoRenewals();
  }

  // =============================================================================
  // SUBSCRIPTION LIFECYCLE
  // =============================================================================

  /**
   * Process subscription (check expiry, reset usage)
   */
  static async processSubscription(subscription) {
    const daysRemaining = this._getDaysRemaining(subscription.endDate);

    // Send expiration notifications at key intervals
    if ([30, 14, 7, 3, 1, 0].includes(daysRemaining)) {
      const user = subscription.user || await userRepository.findById(subscription.userId);
      if (user) {
        await NotificationService.sendExpirationWarning(user, subscription, daysRemaining);
      }
    }

    // Downgrade if expired
    if (daysRemaining < 0) {
      await this.downgradeExpiredSubscription(subscription);
    }

    // Check and reset monthly usage
    await this._checkAndResetUsage(subscription);
  }

  /**
   * Upgrade subscription directly (without payment - for free upgrades or internal use)
   */
  static async upgradeSubscription(userId, newTier, planType = null, countryCode = "US") {
    const currentSub = await subscriptionCompatibilityService.getUserSubscription(userId);
    planType = planType || currentSub.planType || "patient";

    const plan = PLAN_DEFINITIONS[planType]?.[newTier];
    if (!plan) throw new Error(`Invalid plan: ${planType}:${newTier}`);

    const currency = countryCode === "NG" ? "NGN" : "USD";
    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const updateData = {
      tier: newTier,
      planType,
      commissionRate: plan.commissionRate,
      features: plan.features,
      monthlyLimits: plan.monthlyLimits,
      familyMembers: plan.familyMembers || 1,
      price: plan.price[currency] || plan.price.USD,
      currency,
      endDate,
      nextBillingDate: endDate,
      billingCycle: "monthly",
      updatedAt: now,
      metadata: {
        ...currentSub.metadata,
        upgradedAt: now.toISOString(),
        previousTier: currentSub.tier,
        countryCode
      }
    };

    if (currentSub.id) {
      await subscriptionRepository.repo.update(currentSub.id, updateData);
    } else {
      const newSub = subscriptionRepository.create({
        userId,
        ...updateData,
        status: "active",
        startDate: now
      });
      await subscriptionRepository.save(newSub);
    }

    // Update user tier
    await userRepository.repo.update(userId, { tier: newTier });

    // Handle doctor upgrade
    if (planType === "doctor") {
      await this.handleDoctorUpgrade(userId, plan.commissionRate);
    }

    await this._clearCache(userId);

    return await subscriptionCompatibilityService.getUserSubscription(userId);
  }

  /**
   * Downgrade expired subscription to free tier
   */
  static async downgradeExpiredSubscription(subscription) {
    const userId = subscription.user?.id || subscription.userId;
    const isDoctor = subscription.planType === "doctor";
    const countryCode = subscription.metadata?.countryCode || "US";

    // Mark as expired
    await subscriptionRepository.repo.update(subscription.id, {
      status: "expired",
      canceledAt: new Date(),
      metadata: {
        ...subscription.metadata,
        downgradedAt: new Date().toISOString(),
        previousTier: subscription.tier
      }
    });

    // Update user tier
    await userRepository.repo.update(userId, { tier: "free" });

    // Create new free subscription
    await this._createFreeSubscription(userId, isDoctor ? "doctor" : "patient", countryCode);

    // Handle doctor downgrade
    if (isDoctor) {
      await this.handleDoctorDowngrade(userId, subscription.commissionRate);
    }

    await this._clearCache(userId);

    // Notify
    const user = subscription.user || await userRepository.findById(userId);
    if (user) {
      await NotificationService.sendDowngradeNotice(user, subscription.tier, isDoctor);
    }
  }

  // =============================================================================
  // DOCTOR HANDLING
  // =============================================================================

  static async handleDoctorUpgrade(doctorId, newCommissionRate) {
    try {
      const wallet = await doctorWalletRepository.findByDoctorId(doctorId);
      if (wallet) {
        await doctorWalletRepository.repo.update(wallet.id, {
          metadata: {
            ...wallet.metadata,
            commissionRate: newCommissionRate,
            upgradedAt: new Date().toISOString()
          },
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error("Error updating doctor commission:", error);
    }
  }

  static async handleDoctorDowngrade(doctorId, previousCommissionRate) {
    try {
      const wallet = await doctorWalletRepository.findByDoctorId(doctorId);
      if (wallet) {
        await doctorWalletRepository.repo.update(wallet.id, {
          metadata: {
            ...wallet.metadata,
            commissionRate: 30, // Free tier rate
            subscriptionTier: "free",
            downgradedAt: new Date().toISOString(),
            previousCommissionRate
          },
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error("Error updating doctor commission on downgrade:", error);
    }
  }

  // =============================================================================
  // BATCH OPERATIONS (for cron jobs)
  // =============================================================================

  static async batchProcessSubscriptions() {
    const subscriptions = await subscriptionRepository.repo.find({
      where: { status: "active" },
      relations: ["user"]
    });

    let processed = 0, errors = 0;

    for (const sub of subscriptions) {
      try {
        await this.processSubscription(sub);
        processed++;
      } catch (error) {
        console.error(`Error processing subscription ${sub.id}:`, error);
        errors++;
      }
    }

    return { processed, errors };
  }

  static async resetMonthlyUsageForAll() {
    const result = await subscriptionRepository.resetMonthlyUsage();
    return { success: true };
  }

  static async sendUsageLimitWarnings() {
    const subscriptions = await subscriptionRepository.repo.find({
      where: { status: "active" },
      relations: ["user"]
    });

    let warnings = 0;

    for (const sub of subscriptions) {
      const limits = sub.monthlyLimits || {};
      const usage = sub.currentUsage || {};

      for (const [feature, limit] of Object.entries(limits)) {
        if (limit <= 0) continue;
        const used = usage[feature] || 0;
        const percentage = Math.round((used / limit) * 100);

        if (percentage >= 80 && percentage < 100 && sub.user) {
          await NotificationService.sendUsageWarning(sub.user, feature, percentage);
          warnings++;
        }
      }
    }

    return { warnings };
  }

  // =============================================================================
  // ANALYTICS
  // =============================================================================

  static async getSubscriptionAnalytics() {
    const stats = await subscriptionRepository.repo
      .createQueryBuilder("s")
      .select([
        "COUNT(*) as total",
        "COUNT(CASE WHEN status = 'active' THEN 1 END) as active",
        "COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired",
        "COUNT(CASE WHEN \"planType\" = 'doctor' THEN 1 END) as doctors",
        "COUNT(CASE WHEN \"planType\" = 'patient' THEN 1 END) as patients",
        "SUM(CASE WHEN status = 'active' THEN price ELSE 0 END) as revenue"
      ])
      .getRawOne();

    return {
      totalSubscriptions: parseInt(stats.total) || 0,
      activeSubscriptions: parseInt(stats.active) || 0,
      expiredSubscriptions: parseInt(stats.expired) || 0,
      doctorSubscriptions: parseInt(stats.doctors) || 0,
      patientSubscriptions: parseInt(stats.patients) || 0,
      monthlyRevenue: parseFloat(stats.revenue) || 0
    };
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  static _getDaysRemaining(endDate) {
    if (!endDate) return 0;
    const diff = new Date(endDate) - new Date();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  static async _checkAndResetUsage(subscription) {
    const lastReset = subscription.metadata?.lastUsageReset
      ? new Date(subscription.metadata.lastUsageReset)
      : new Date(subscription.startDate);

    const daysSinceReset = (Date.now() - lastReset.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceReset >= 30) {
      await subscriptionRepository.repo.update(subscription.id, {
        currentUsage: {},
        metadata: {
          ...subscription.metadata,
          lastUsageReset: new Date().toISOString()
        },
        updatedAt: new Date()
      });
    }
  }

  static async _createFreeSubscription(userId, planType, countryCode = "US") {
    const plan = PLAN_DEFINITIONS[planType].free;
    const currency = countryCode === "NG" ? "NGN" : "USD";

    const sub = subscriptionRepository.create({
      userId,
      tier: "free",
      planType,
      status: "active",
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      price: 0,
      currency,
      autoRenew: false,
      commissionRate: planType === "doctor" ? 30 : null,
      features: plan.features,
      monthlyLimits: plan.monthlyLimits,
      currentUsage: {},
      familyMembers: 1,
      billingCycle: "monthly",
      metadata: { createdOnDowngrade: true, countryCode }
    });

    await subscriptionRepository.save(sub);
  }

  static async _clearCache(userId) {
    try {
      await cache.del(`user:${userId}:subscription`);
      await cache.del(`user:${userId}:subscription:basic`);
    } catch (e) {
      console.warn("Cache clear failed:", e.message);
    }
  }

  // =============================================================================
  // DEPRECATED - kept for backward compatibility
  // =============================================================================

  static getFreeFeatures(planType) {
    return PLAN_DEFINITIONS[planType].free.features;
  }

  static getFreeLimits(planType) {
    return PLAN_DEFINITIONS[planType].free.monthlyLimits;
  }

  static async testSubscriptionUpgrade(transactionId, planType = "patient", newTier = "premium") {
    console.warn("testSubscriptionUpgrade is deprecated - use for testing only");
    // Simplified test upgrade
    const transactionRepository = require("../../payments/repositories/transactionRepository");
    await transactionRepository.repo.update(transactionId, {
      status: "completed",
      metadata: { planType, newTier, enableAutoBilling: false }
    });
    return this.processSubscriptionUpgradeAfterPayment(transactionId);
  }
}

module.exports = SubscriptionService;
