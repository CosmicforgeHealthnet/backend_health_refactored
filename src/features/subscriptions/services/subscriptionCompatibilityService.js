// src/features/subscriptions/services/subscriptionCompatibilityService.js
/**
 * SubscriptionCompatibilityService
 *
 * Provides subscription data retrieval with enhancements for the application.
 * Handles both doctor and patient subscriptions with proper fallbacks.
 *
 * KEY RESPONSIBILITIES:
 * - Get user subscription (with caching and fallback to free tier)
 * - Get available plans (public - for landing page)
 * - Get pricing (with/without discount for easy plugin)
 * - Check feature access and usage limits
 *
 * DESIGN PRINCIPLE: Never fail completely - always return usable data
 */

const subscriptionRepository = require("../repositories/subscriptionRepository");
const { PLAN_DEFINITIONS, PROMO_EXPIRY, getTimeUntilExpiry, FAMILY_PLAN_CONFIG } = require("../utils/subscriptionConstants");
const cache = require("../../../shared/utils/cache");

// Cache TTL constants
const CACHE_TTL = {
  FULL: 1800,    // 30 min for full subscription
  BASIC: 900,    // 15 min for basic subscription
  PLANS: 3600    // 1 hour for plan definitions
};

class SubscriptionCompatibilityService {

  // ===========================================================================
  // USER SUBSCRIPTION RETRIEVAL
  // ===========================================================================

  /**
   * Get user's full subscription with all enhancements
   * Use this for detailed subscription views
   *
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Enhanced subscription object
   */
  static async getUserSubscription(userId) {
    try {
      // Check cache first
      const cached = await this._getCache(`user:${userId}:subscription`);
      if (cached) return cached;

      // Get from database
      const subscription = await subscriptionRepository.findActiveByUserId(userId);

      if (subscription) {
        const enhanced = this._enhance(subscription);
        await this._setCache(`user:${userId}:subscription`, enhanced, CACHE_TTL.FULL);
        return enhanced;
      }

      // Fallback: create from user tier or default free
      return await this._createFromUserOrDefault(userId);
    } catch (error) {
      console.error("Error getting user subscription:", error.message);
      return this._createFallback(userId);
    }
  }

  /**
   * Get user's basic subscription (lightweight - for quick checks)
   * Use this for feature checks and middleware
   *
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Basic subscription object
   */
  static async getUserSubscriptionBasic(userId) {
    try {
      const cached = await this._getCache(`user:${userId}:subscription:basic`);
      if (cached) return cached;

      const subscription = await subscriptionRepository.findActiveByUserId(userId);

      if (subscription) {
        const enhanced = this._enhanceBasic(subscription);
        await this._setCache(`user:${userId}:subscription:basic`, enhanced, CACHE_TTL.BASIC);
        return enhanced;
      }

      return await this._createFromUserOrDefault(userId, true);
    } catch (error) {
      console.error("Error getting basic subscription:", error.message);
      return this._createFallback(userId);
    }
  }

  // ===========================================================================
  // PROMO STATUS CHECK
  // ===========================================================================

  /**
   * Check if promo is currently active based on PROMO_EXPIRY
   * This is the single source of truth for discount status
   * @returns {boolean} true if promo is active (PROMO_EXPIRY is in the future)
   */
  static _isPromoActive() {
    return new Date() < new Date(PROMO_EXPIRY);
  }

  // ===========================================================================
  // PLAN RETRIEVAL (PUBLIC - No Auth Required)
  // ===========================================================================

  /**
   * Get available plans for display
   * Works for landing page (no auth) and authenticated users
   * Discount is automatically applied based on PROMO_EXPIRY
   *
   * @param {string|null} planType - 'doctor', 'patient', or null for both
   * @param {string} countryCode - Country code for currency ('US', 'NG')
   * @returns {Object} Available plans
   */
  static getAvailablePlans(planType = null, countryCode = "US") {
    const currency = countryCode === "NG" ? "NGN" : "USD";
    const isPromoActive = this._isPromoActive();

    // Return both types if not specified
    if (!planType) {
      return {
        doctor: this._formatPlans("doctor", currency),
        patient: this._formatPlans("patient", currency),
        currency,
        countryCode,
        withDiscount: isPromoActive,
        // Only include promo info if promo is active
        ...(isPromoActive ? this._getPromoInfo() : {})
      };
    }

    return {
      plans: this._formatPlans(planType, currency),
      planType,
      currency,
      countryCode,
      withDiscount: isPromoActive,
      // Only include promo info if promo is active
      ...(isPromoActive ? this._getPromoInfo() : {})
    };
  }

  /**
   * Get specific plan pricing
   * Discount is automatically applied based on PROMO_EXPIRY
   *
   * @param {string} planType - 'doctor' or 'patient'
   * @param {string} tier - Plan tier (free, premium, etc.)
   * @param {string} countryCode - Country code
   * @returns {Object} Plan pricing details
   */
  static getPlanPricing(planType, tier, countryCode = "US") {
    const plan = PLAN_DEFINITIONS[planType]?.[tier];
    if (!plan) throw new Error(`Invalid plan: ${planType}/${tier}`);

    const currency = countryCode === "NG" ? "NGN" : "USD";
    const isPromoActive = this._isPromoActive();

    return {
      planType,
      tier,
      name: plan.name,
      currency,
      countryCode,

      // Pricing - automatically applies discount if promo is active
      ...this._getPricing(plan, currency),

      // Plan details
      commissionRate: plan.commissionRate,
      features: plan.features,
      featureList: this._formatFeatures(plan.features),
      displayFeatures: plan.displayFeatures || [], // Human-readable feature list from documentation
      monthlyLimits: plan.monthlyLimits,
      familyMembers: plan.familyMembers,
      familyConfig: planType === "patient" ? FAMILY_PLAN_CONFIG[tier] : null,

      // Flags
      isFree: tier === "free",
      isPremium: tier !== "free",

      // Only include promo info if promo is active
      ...(isPromoActive ? this._getPromoInfo() : {})
    };
  }

  // ===========================================================================
  // PRICING HELPERS
  // ===========================================================================

  /**
   * Get pricing object - automatically handles discount based on PROMO_EXPIRY
   *
   * Logic:
   * - If PROMO_EXPIRY is in the future AND plan has discount config → apply discount
   * - If PROMO_EXPIRY is in the past OR no discount config → regular pricing
   *
   * Output:
   * - price: The MAIN/BASE price (what user would pay without discount)
   * - discountPrice: The price AFTER discount (what user actually pays during promo)
   * - discount: The amount saved
   * - discountPercentage: The percentage off
   * - hasDiscount: Whether a discount is currently active
   *
   * @param {Object} plan - Plan definition
   * @param {string} currency - Currency code
   * @returns {Object} Pricing details
   */
  static _getPricing(plan, currency) {
    // Get the main/base price from plan.price
    const basePrice = plan.price?.[currency] || plan.price?.USD || 0;

    // Check if promo is active based on PROMO_EXPIRY
    const isPromoActive = this._isPromoActive();

    // If promo is not active, return regular pricing immediately
    if (!isPromoActive) {
      return {
        price: basePrice,
        discountPrice: basePrice,
        discount: 0,
        discountPercentage: 0,
        hasDiscount: false
      };
    }

    // Promo is active - check if plan has promotional pricing defined
    const hasPromoConfig = plan.discountPrice && plan.discountPercentage > 0;

    if (hasPromoConfig) {
      const discountPrice = plan.discountPrice[currency] || plan.discountPrice.USD || basePrice;
      const discountAmount = basePrice - discountPrice;
      const discountPercentage = plan.discountPercentage || 0;

      return {
        price: basePrice,
        discountPrice,
        discount: discountAmount,
        discountPercentage,
        hasDiscount: true
      };
    }

    // Promo active but plan has no discount config (e.g., free plan)
    return {
      price: basePrice,
      discountPrice: basePrice,
      discount: 0,
      discountPercentage: 0,
      hasDiscount: false
    };
  }

  // ===========================================================================
  // FEATURE & USAGE CHECKS
  // ===========================================================================

  /**
   * Check if user has access to a feature
   *
   * @param {string} userId - User ID
   * @param {string} featureName - Feature to check
   * @returns {Promise<Object>} Access details
   */
  static async hasFeatureAccess(userId, featureName) {
    try {
      const sub = await this.getUserSubscriptionBasic(userId);

      if (!sub.features?.[featureName]) {
        return {
          hasAccess: false,
          reason: "Feature not included in your plan",
          currentPlan: sub.tier,
          planType: sub.planType,
          upgradeRequired: true
        };
      }

      // Check usage limits
      const usage = sub.usagePercentage?.[featureName];
      if (usage?.isOverLimit) {
        return {
          hasAccess: false,
          reason: "Monthly limit exceeded",
          usage,
          currentPlan: sub.tier,
          upgradeRequired: true
        };
      }

      return {
        hasAccess: true,
        currentPlan: sub.tier,
        planType: sub.planType,
        usage
      };
    } catch (error) {
      console.error("Error checking feature access:", error.message);
      return { hasAccess: false, reason: "Error checking access" };
    }
  }

  /**
   * Simple boolean check for feature
   */
  static async hasFeature(userId, featureName) {
    const result = await this.hasFeatureAccess(userId, featureName);
    return result.hasAccess;
  }

  // ===========================================================================
  // CACHE MANAGEMENT
  // ===========================================================================

  /**
   * Clear user's subscription cache
   * Call after subscription changes
   */
  static async clearUserCache(userId) {
    try {
      await Promise.all([
        cache.del(`user:${userId}:subscription`),
        cache.del(`user:${userId}:subscription:basic`)
      ]);
    } catch (error) {
      console.warn("Cache clear failed:", error.message);
    }
  }

  // ===========================================================================
  // SUBSCRIPTION ENHANCEMENT
  // ===========================================================================

  /**
   * Enhance subscription with computed fields (full version)
   */
  static _enhance(subscription) {
    const planType = subscription.planType || "patient";
    const tier = subscription.tier || "free";
    const plan = PLAN_DEFINITIONS[planType]?.[tier] || PLAN_DEFINITIONS.patient.free;

    // Always use plan features based on tier to ensure consistency
    // This prevents issues with stale or missing features in stored subscriptions
    const features = plan.features;

    return {
      // Core fields
      id: subscription.id,
      userId: subscription.userId,
      tier,
      planType,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,

      // Pricing
      price: subscription.price,
      currency: subscription.currency,

      // Features & limits - always use plan features to ensure free tier gets generalEmergencySpecialists
      commissionRate: subscription.commissionRate ?? plan.commissionRate,
      features,
      monthlyLimits: subscription.monthlyLimits || plan.monthlyLimits,
      currentUsage: subscription.currentUsage || {},
      familyMembers: subscription.familyMembers || plan.familyMembers || 1,

      // Billing
      autoRenew: subscription.autoRenew,
      billingCycle: subscription.billingCycle,
      nextBillingDate: subscription.nextBillingDate,
      autoBillingEnabled: subscription.autoBillingEnabled || false,

      // Metadata
      metadata: subscription.metadata || {},
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,

      // Computed fields
      planDefinition: plan,
      featureList: this._formatFeatures(features),
      displayFeatures: plan.displayFeatures || [], // Human-readable feature list
      isActive: subscription.status === "active",
      isExpired: subscription.status === "expired",
      isPremium: tier !== "free",
      daysRemaining: this._daysRemaining(subscription.endDate),
      usagePercentage: this._calcUsage(
        subscription.currentUsage || {},
        subscription.monthlyLimits || plan.monthlyLimits
      ),

      // Promo - only include if promo is active
      ...(this._isPromoActive() ? this._getPromoInfo() : {})
    };
  }

  /**
   * Enhance subscription (lightweight version)
   */
  static _enhanceBasic(subscription) {
    const planType = subscription.planType || "patient";
    const tier = subscription.tier || "free";
    const plan = PLAN_DEFINITIONS[planType]?.[tier] || PLAN_DEFINITIONS.patient.free;

    // Always use plan features based on tier to ensure consistency
    // This prevents issues with stale or missing features in stored subscriptions
    const features = plan.features;

    return {
      id: subscription.id,
      userId: subscription.userId,
      tier,
      planType,
      status: subscription.status,

      // Essentials - always use plan features to ensure free tier gets generalEmergencySpecialists
      features,
      monthlyLimits: subscription.monthlyLimits || plan.monthlyLimits,
      currentUsage: subscription.currentUsage || {},
      commissionRate: subscription.commissionRate ?? plan.commissionRate,

      // Computed
      featureList: this._formatFeatures(features),
      displayFeatures: plan.displayFeatures || [], // Human-readable feature list
      isActive: subscription.status === "active",
      isPremium: tier !== "free",
      daysRemaining: this._daysRemaining(subscription.endDate),
      usagePercentage: this._calcUsage(
        subscription.currentUsage || {},
        subscription.monthlyLimits || plan.monthlyLimits
      ),

      // Promo - only include if promo is active
      ...(this._isPromoActive() ? this._getPromoInfo() : {})
    };
  }

  // ===========================================================================
  // FALLBACK CREATORS
  // ===========================================================================

  /**
   * Create subscription from user data or default free
   */
  static async _createFromUserOrDefault(userId, basic = false) {
    try {
      const userRepository = require("../../auth/repositories/userRepository");
      const user = await userRepository.findById(userId);

      if (user?.tier && user.tier !== "free") {
        const planType = user.role === "doctor" ? "doctor" : "patient";
        return this._createFromTier(userId, user.tier, planType, basic);
      }

      return this._createFallback(userId, user?.role === "doctor" ? "doctor" : "patient");
    } catch (error) {
      console.error("Error creating subscription from user:", error.message);
      return this._createFallback(userId);
    }
  }

  /**
   * Create subscription from tier info
   */
  static _createFromTier(userId, tier, planType, basic = false) {
    const plan = PLAN_DEFINITIONS[planType]?.[tier] || PLAN_DEFINITIONS.patient.free;
    const now = new Date();
    const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const sub = {
      id: null,
      userId,
      tier,
      planType,
      status: "active",
      startDate: now,
      endDate,
      price: plan.price?.USD || 0,
      currency: "USD",
      features: plan.features,
      monthlyLimits: plan.monthlyLimits,
      currentUsage: {},
      commissionRate: plan.commissionRate,
      familyMembers: plan.familyMembers || 1,
      metadata: { fromUserTier: true }
    };

    return basic ? this._enhanceBasic(sub) : this._enhance(sub);
  }

  /**
   * Create fallback free subscription (never fails)
   */
  static _createFallback(userId, planType = "patient") {
    const plan = PLAN_DEFINITIONS[planType]?.free || PLAN_DEFINITIONS.patient.free;
    const now = new Date();

    return {
      id: null,
      userId,
      tier: "free",
      planType,
      status: "active",
      startDate: now,
      endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      price: 0,
      currency: "USD",
      features: plan.features || {},
      monthlyLimits: plan.monthlyLimits || {},
      currentUsage: {},
      commissionRate: plan.commissionRate || 0,
      familyMembers: 1,
      featureList: this._formatFeatures(plan.features || {}),
      displayFeatures: plan.displayFeatures || [], // Human-readable feature list
      isActive: true,
      isExpired: false,
      isPremium: false,
      daysRemaining: 365,
      usagePercentage: {},
      metadata: { isFallback: true },
      // Promo - only include if promo is active
      ...(this._isPromoActive() ? this._getPromoInfo() : {})
    };
  }

  // Backward compatibility aliases
  static createDefaultFreeSubscription(userId) {
    return this._createFallback(userId, "patient");
  }

  static createBasicFreeSubscription(userId, planType = "patient") {
    return this._createFallback(userId, planType);
  }

  static enhanceSubscriptionData(subscription) {
    return this._enhance(subscription);
  }

  static enhanceBasicSubscriptionData(subscription) {
    return this._enhanceBasic(subscription);
  }

  // ===========================================================================
  // UTILITY HELPERS
  // ===========================================================================

  /**
   * Format plans for response
   * Pricing automatically determined by PROMO_EXPIRY
   */
  static _formatPlans(planType, currency) {
    const plans = PLAN_DEFINITIONS[planType];
    if (!plans) return {};

    const result = {};
    for (const [tier, plan] of Object.entries(plans)) {
      result[tier] = {
        tier,
        planType,
        name: plan.name,
        currency,
        ...this._getPricing(plan, currency),
        commissionRate: plan.commissionRate,
        features: plan.features,
        featureList: this._formatFeatures(plan.features),
        displayFeatures: plan.displayFeatures || [], // Human-readable feature list from documentation
        monthlyLimits: plan.monthlyLimits,
        familyMembers: plan.familyMembers,
        familyConfig: planType === "patient" ? FAMILY_PLAN_CONFIG[tier] : null,
        isFree: tier === "free",
        isPremium: tier !== "free"
      };
    }
    return result;
  }

  /**
   * Format features as readable list
   */
  static _formatFeatures(features) {
    if (!features) return [];

    const names = {
      // Common features
      chatAccess: "Chat Access",
      voiceConsultation: "Voice Consultation",
      videoConsultation: "Video Consultation",
      standardSupport: "Standard Support",
      prioritySupport: "Priority Support",

      // Patient-specific features
      generalEmergencySpecialists: "General & Emergency Specialists",
      allSpecialists: "All Specialists",
      labAccess: "Lab Access",
      pharmacy: "Pharmacy Access",
      shopAccess: "Shop Access",
      firstAidInstructions: "First Aid Instructions",
      familyPlan: "Family Plan",
      earlyAccessFeatures: "Early Access Features",
      betaAccess: "Beta Access",

      // Doctor-specific features
      regularProfileListing: "Regular Profile Listing",
      topProfileListing: "Top Profile Listing",
      unlimitedPatients: "Unlimited Patients",
      unlimitedAI: "Unlimited AI Responses"
    };

    return Object.entries(features)
      .filter(([, v]) => v === true)
      .map(([k]) => names[k] || k.replace(/([A-Z])/g, " $1").trim());
  }

  // Backward compatibility
  static formatFeatureList(features) {
    return this._formatFeatures(features);
  }

  static formatFeatureName(name) {
    const names = {
      chatAccess: "Chat Access",
      voiceConsultation: "Voice Consultation",
      videoConsultation: "Video Consultation",
      generalEmergencySpecialists: "General & Emergency Specialists",
      allSpecialists: "All Specialists",
      labAccess: "Lab Access",
      pharmacy: "Pharmacy Access",
      shopAccess: "Shop Access",
      firstAidInstructions: "First Aid Instructions",
      familyPlan: "Family Plan",
      standardSupport: "Standard Support",
      prioritySupport: "Priority Support",
      earlyAccessFeatures: "Early Access Features",
      betaAccess: "Beta Access"
    };
    return names[name] || name.replace(/([A-Z])/g, " $1").trim();
  }

  /**
   * Calculate days remaining
   */
  static _daysRemaining(endDate) {
    if (!endDate) return 0;
    const diff = new Date(endDate) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  static calculateDaysRemaining(endDate) {
    return this._daysRemaining(endDate);
  }

  /**
   * Calculate usage percentages
   */
  static _calcUsage(usage, limits) {
    if (!usage || !limits) return {};

    const result = {};
    for (const [key, limit] of Object.entries(limits)) {
      if (typeof limit === "number" && limit > 0) {
        const used = usage[key] || 0;
        result[key] = {
          used,
          limit,
          percentage: Math.min(100, Math.round((used / limit) * 100)),
          remaining: Math.max(0, limit - used),
          isOverLimit: used > limit
        };
      }
    }
    return result;
  }

  static calculateUsagePercentage(usage, limits) {
    return this._calcUsage(usage, limits);
  }

  /**
   * Get promo info
   * Only called when promo is active (checked before calling this method)
   */
  static _getPromoInfo() {
    return {
      promoExpiry: PROMO_EXPIRY,
      promoTimeLeft: getTimeUntilExpiry(),
      hasActivePromo: true
    };
  }

  /**
   * Cache helpers
   */
  static async _getCache(key) {
    try {
      return await cache.get(key);
    } catch {
      return null;
    }
  }

  static async _setCache(key, data, ttl) {
    try {
      await cache.set(key, { ...data, cachedAt: Date.now() }, ttl);
    } catch (e) {
      console.warn("Cache set failed:", e.message);
    }
  }

  // Backward compatibility
  static async clearUserSubscriptionCache(userId) {
    return this.clearUserCache(userId);
  }

  static async invalidateSubscriptionCache(userId) {
    return this.clearUserCache(userId);
  }
}

module.exports = SubscriptionCompatibilityService;
