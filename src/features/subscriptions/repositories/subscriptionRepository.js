// src/repositories/subscriptionRepository.js
const AppDataSource = require('../../../config/database');
const Subscription = require('../entities/Subscription');
const { LEGACY_TIER_MAPPING } = require('../utils/subscriptionConstants');

class SubscriptionRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(Subscription);
  }

  create(data) {
    return this.repo.create(data);
  }

  save(subscription) {
    return this.repo.save(subscription);
  }

  findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: ['user']
    });
  }

  findByUserId(userId) {
    return this.repo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' }
    });
  }

  findActiveByUserId(userId) {
    return this.repo.findOne({
      where: {
        userId,
        status: 'active'
      }
    });
  }

  /**
   * Get user subscription with backward compatibility
   */
  async findUserSubscriptionWithFallback(userId) {
    let subscription = await this.findActiveByUserId(userId);

    if (!subscription) {
      // Create default free subscription for users without one
      const user = await AppDataSource.getRepository('User').findOne({
        where: { id: userId }
      });

      if (user) {
        subscription = await this.createDefaultSubscription(user);
      }
    }

    // Handle legacy subscriptions
    if (subscription && !subscription.planType) {
      subscription = this.enhanceLegacySubscription(subscription);
    }

    return subscription;
  }

  /**
   * Create default subscription for new users
   */
  async createDefaultSubscription(user) {
    const isDoctor = user.role === 'doctor';

    const defaultSubscription = {
      userId: user.id,
      tier: 'free',
      planType: isDoctor ? 'doctor' : 'patient',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      price: 0.00,
      currency: 'USD',
      autoRenew: false,
      commissionRate: isDoctor ? 30.00 : null,
      features: this.getDefaultFeatures(isDoctor),
      monthlyLimits: this.getDefaultLimits(isDoctor),
      currentUsage: {},
      familyMembers: 1,
      billingCycle: 'monthly'
    };

    const subscription = this.create(defaultSubscription);
    return await this.save(subscription);
  }

  /**
   * Enhance legacy subscription with new fields
   */
  enhanceLegacySubscription(subscription) {
    const mapping = LEGACY_TIER_MAPPING[subscription.tier];

    if (mapping) {
      // Don't modify the original object, return enhanced version
      return {
        ...subscription,
        planType: mapping.planType,
        originalTier: subscription.tier, // Mark as legacy
        commissionRate: mapping.planType === 'doctor' ? this.getDefaultCommissionRate(subscription.tier) : null,
        features: this.getDefaultFeatures(mapping.planType === 'doctor'),
        monthlyLimits: this.getDefaultLimits(mapping.planType === 'doctor'),
        currentUsage: subscription.currentUsage || {},
        familyMembers: 1
      };
    }

    return subscription;
  }

  getDefaultFeatures(isDoctor) {
    if (isDoctor) {
      return [
        "chat_only",
        "regular_profile_listing",
        "standard_support"
      ];
    } else {
      return [
        "chat_only",
        "general_emergency_specialists",
        "shop_access",
        "standard_support"
      ];
    }
  }

  getDefaultLimits(isDoctor) {
    if (isDoctor) {
      return {
        maxPatients: 10,
        aiResponses: 50
      };
    } else {
      return {
        aiChatbotResponses: 10,
        aiDiagnosticRequests: 0
      };
    }
  }

  getDefaultCommissionRate(tier) {
    const rateMapping = {
      'basic': 20,
      'pro': 15,
      'enterprise': 10
    };
    return rateMapping[tier] || 30;
  }

  /**
   * Find subscriptions expiring soon
   */
  findExpiringSubscriptions(daysBefore = 7) {
    const expiryDate = new Date(Date.now() + daysBefore * 24 * 60 * 60 * 1000);

    return this.repo.find({
      where: {
        status: 'active',
        endDate: AppDataSource.createQueryBuilder()
          .select('endDate')
          .where('endDate <= :expiryDate', { expiryDate })
          .andWhere('endDate > :now', { now: new Date() })
      },
      relations: ['user']
    });
  }

  /**
   * Find subscriptions needing billing
   */
  findSubscriptionsForBilling() {
    return this.repo.find({
      where: {
        status: 'active',
        autoRenew: true,
        nextBillingDate: AppDataSource.createQueryBuilder()
          .select('nextBillingDate')
          .where('nextBillingDate <= :now', { now: new Date() })
      },
      relations: ['user']
    });
  }

  /**
   * Update subscription tier
   */
  async updateSubscriptionTier(userId, newTier, planType) {
    return this.repo.update(
      { userId, status: 'active' },
      {
        tier: newTier,
        planType,
        updatedAt: new Date()
      }
    );
  }

  /**
   * Update usage tracking
   */
  async updateUsage(subscriptionId, usageType, increment = 1) {
    const subscription = await this.findById(subscriptionId);

    if (subscription) {
      const currentUsage = subscription.currentUsage || {};
      currentUsage[usageType] = (currentUsage[usageType] || 0) + increment;

      return this.repo.update(subscriptionId, {
        currentUsage,
        updatedAt: new Date()
      });
    }
  }

  /**
   * Reset monthly usage (for background job)
   */
  async resetMonthlyUsage() {
    return this.repo.update(
      { status: 'active' },
      {
        currentUsage: {},
        updatedAt: new Date()
      }
    );
  }

  /**
 * Find subscriptions needing auto-billing
 */
  // findSubscriptionsForAutoBilling() {
  //   const today = new Date();
  //   return this.repo.find({
  //     where: {
  //       status: 'active',
  //       autoBillingEnabled: true,
  //       nextBillingDate: AppDataSource.createQueryBuilder()
  //         .select('nextBillingDate')
  //         .where('nextBillingDate <= :today', { today })
  //     },
  //     relations: ['user']
  //   });
  // }

  findSubscriptionsForAutoBilling() {
    const today = new Date();

    return this.repo.createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.user', 'user')
      .select([
        'subscription.id',
        'subscription.userId',
        'subscription.tier',
        'subscription.planType',
        'subscription.status',
        'subscription.nextBillingDate',
        'subscription.autoBillingEnabled',
        'subscription.preferredPaymentMethodId',
        'subscription.price',
        'subscription.currency',
        'subscription.billingCycle',
        'subscription.autoBillingFailureCount',
        'user.id',
        'user.email',
        'user.role'
        // Removed 'user.name' - it doesn't exist in your User entity
      ])
      .where('subscription.status = :status', { status: 'active' })
      .andWhere('subscription.autoBillingEnabled = :enabled', { enabled: true })
      .andWhere('subscription.nextBillingDate <= :today', { today })
      .getMany();
  }

  /**
   * Enable auto-billing for subscription
   */
  async enableAutoBilling(subscriptionId, paymentMethodId) {
    return this.repo.update(subscriptionId, {
      autoBillingEnabled: true,
      preferredPaymentMethodId: paymentMethodId,
      autoBillingFailureCount: 0,
      updatedAt: new Date()
    });
  }

  /**
   * Disable auto-billing for subscription
   */
  async disableAutoBilling(subscriptionId) {
    return this.repo.update(subscriptionId, {
      autoBillingEnabled: false,
      preferredPaymentMethodId: null,
      updatedAt: new Date()
    });
  }

  /**
   * Update auto-billing failure count
   */
  async updateAutoBillingFailure(subscriptionId) {
    return this.repo.increment(
      { id: subscriptionId },
      'autoBillingFailureCount',
      1
    ).then(() => {
      return this.repo.update(subscriptionId, {
        lastAutoBillingAttempt: new Date()
      });
    });
  }

  /**
   * Reset auto-billing failure count on success
   */
  async resetAutoBillingFailures(subscriptionId) {
    return this.repo.update(subscriptionId, {
      autoBillingFailureCount: 0,
      lastAutoBillingAttempt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId, reason = null) {
    return this.repo.update(
      { userId, status: 'active' },
      {
        status: 'canceled',
        canceledAt: new Date(),
        autoRenew: false,
        metadata: {
          cancelReason: reason
        }
      }
    );
  }
}

module.exports = new SubscriptionRepository();