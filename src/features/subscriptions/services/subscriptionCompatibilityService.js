// src/services/subscriptionCompatibilityService.js - CLEAN & ORGANIZED VERSION
const subscriptionRepository = require("../repositories/subscriptionRepository");
const {
  PLAN_DEFINITIONS,
  PROMO_EXPIRY,
  getTimeUntilExpiry,
} = require("../utils/subscriptionConstants");
const cache = require("../../../shared/utils/cache");

/**
 * Subscription Compatibility Service - Clean & Organized
 *
 * This service handles ALL subscription operations with proper organization:
 * ✅ User subscription retrieval (with multiple fallback strategies)
 * ✅ Real-time currency conversion for international users
 * ✅ Auto-billing management and settings
 * ✅ Feature access validation and usage tracking
 * ✅ Plan information and pricing (static and dynamic)
 * ✅ Cache management for performance
 * ✅ Promo expiry tracking and countdown
 *
 * Design: Never fail completely - always return usable data
 */
class SubscriptionCompatibilityService {
  // =============================================================================
  // PRIMARY SUBSCRIPTION RETRIEVAL METHODS
  // =============================================================================

  /**
   * Get user subscription with full enhancement, currency conversion, and caching
   * This is the MAIN method - handles all edge cases with proper fallbacks
   *
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Fully enhanced subscription with all features
   */
  static async getUserSubscription(userId) {
    try {
      console.log("🔍 Getting subscription for user:", userId);

      // Step 1: Check cache first with error handling
      const cached = await this._getCachedSubscription(userId);
      if (cached) {
        console.log("✅ Found cached subscription for user:", userId);
        return cached;
      }

      // Step 2: Try database with multiple fallback strategies
      const dbSubscription = await this._getSubscriptionFromDatabase(userId);
      if (dbSubscription) {
        console.log("✅ Found database subscription for user:", userId);
        const enhanced = this.enhanceSubscriptionData(dbSubscription);
        await this._cacheSubscription(userId, enhanced);
        return enhanced;
      }

      // Step 3: Check user table for tier information
      const userSubscription = await this._createSubscriptionFromUserData(
        userId
      );
      await this._cacheSubscription(userId, userSubscription);
      return userSubscription;
    } catch (error) {
      console.error("❌ Error getting user subscription:", error);
      console.error("❌ Stack trace:", error.stack);

      // Always return fallback - never fail completely
      console.log("🔄 Returning fallback free subscription for user:", userId);
      return this.createDefaultFreeSubscription(userId);
    }
  }

  /**
   * Get user subscription WITHOUT heavy processing (faster, lighter)
   * Use this for quick checks and performance-sensitive operations
   *
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Basic subscription data with essential features
   */
  static async getUserSubscriptionBasic(userId) {
    try {
      console.log("🔍 Getting basic subscription for user:", userId);

      // Check cache first with validation
      const cacheKey = `user:${userId}:subscription:basic`;
      const cached = await this._getFromCache(cacheKey);
      if (cached) {
        // Validate cache freshness and consistency
        if (await this._shouldValidateCache(cached)) {
          console.log("🔍 Validating cached subscription with database");
          const fresh = await this._getActiveSubscription(userId);
          if (fresh && !this._isCacheValid(cached, fresh)) {
            console.log("⚠️ Cache is stale, invalidating and using fresh data");
            await cache.del(cacheKey);
            const enhanced = this.enhanceBasicSubscriptionData(fresh);
            await this._setCache(cacheKey, enhanced, 900);
            return enhanced;
          }
        }
        console.log("✅ Found valid cached basic subscription");
        return cached;
      }

      // Get from database with simplified query
      const subscription = await this._getActiveSubscription(userId);

      if (subscription) {
        console.log("✅ Found active subscription for user:", userId);
        const enhanced = this.enhanceBasicSubscriptionData(subscription);
        await this._setCache(cacheKey, enhanced, 900); // 15 min cache with TTL
        return enhanced;
      }

      // Fallback to user data
      console.log("⚠️ No active subscription found, checking user tier");
      const fallback = await this._createBasicFromUserData(userId);
      await this._setCache(cacheKey, fallback, 900); // 15 min cache with TTL
      return fallback;
    } catch (error) {
      console.error("❌ Error getting basic user subscription:", error);
      // Always return a fallback - never fail
      console.log("🔄 Returning fallback free subscription");
      return this.createBasicFreeSubscription(userId);
    }
  }

  // =============================================================================
  // FEATURE ACCESS AND VALIDATION METHODS
  // =============================================================================

  /**
   * Check if user has access to a specific feature (with detailed response)
   *
   * @param {string} userId - User ID
   * @param {string} featureName - Feature to check (e.g., 'videoConsultation')
   * @returns {Promise<Object>} Detailed access information with usage data
   */
  static async hasFeatureAccess(userId, featureName) {
    try {
      const subscription = await this.getUserSubscriptionBasic(userId);

      // Check if feature exists in plan
      if (!subscription.features || !subscription.features[featureName]) {
        return {
          hasAccess: false,
          reason: "Feature not included in your plan",
          currentPlan: subscription.tier,
          planType: subscription.planType,
          upgradeRequired: true,
        };
      }

      // Check usage limits if applicable
      const usage = subscription.usagePercentage[featureName];
      if (usage && usage.isOverLimit) {
        return {
          hasAccess: false,
          reason: "Monthly limit exceeded",
          usage,
          currentPlan: subscription.tier,
          planType: subscription.planType,
          upgradeRequired: true,
        };
      }

      return {
        hasAccess: true,
        currentPlan: subscription.tier,
        planType: subscription.planType,
        usage: usage || null,
      };
    } catch (error) {
      console.error("❌ Error checking feature access:", error);
      return {
        hasAccess: false,
        reason: "Error checking feature access",
        upgradeRequired: false,
      };
    }
  }

  /**
   * Simple boolean check for feature access
   *
   * @param {string} userId - User ID
   * @param {string} featureName - Feature to check
   * @returns {Promise<boolean>} True if user has access
   */
  static async hasFeature(userId, featureName) {
    try {
      const subscription = await this.getUserSubscriptionBasic(userId);
      return !!(subscription.features && subscription.features[featureName]);
    } catch (error) {
      console.error("❌ Error checking feature access:", error);
      return false;
    }
  }

  /**
   * Check if user can use feature considering limits and restrictions
   *
   * @param {string} userId - User ID
   * @param {string} featureName - Feature to check
   * @returns {Promise<Object>} Usage allowance information
   */
  static async canUseFeature(userId, featureName) {
    try {
      const subscription = await this.getUserSubscriptionBasic(userId);

      // Check if feature exists
      if (!subscription.features || !subscription.features[featureName]) {
        return {
          allowed: false,
          reason: "Feature not included in your plan",
          upgradeRequired: true,
        };
      }

      // Check usage limits
      const usage = subscription.usagePercentage[featureName];
      if (usage && usage.isOverLimit) {
        return {
          allowed: false,
          reason: "Monthly limit exceeded",
          usage,
          upgradeRequired: true,
        };
      }

      return {
        allowed: true,
        usage: usage || null,
      };
    } catch (error) {
      console.error("❌ Error checking feature usage:", error);
      return {
        allowed: false,
        reason: "Error checking feature access",
        upgradeRequired: false,
      };
    }
  }

  // =============================================================================
  // PLAN INFORMATION AND PRICING METHODS (STATIC)
  // =============================================================================

  /**
   * Get available plans for a specific user type (basic currency support)
   *
   * @param {string} planType - 'doctor' or 'patient'
   * @param {string} currency - Currency code (optional, defaults to USD)
   * @returns {Object} Available plans with pricing in requested currency
   */
  static getAvailablePlans(planType, currency = "USD") {
    try {
      // Return both types if no specific type requested
      if (!planType) {
        return {
          doctor: this.getAvailablePlans("doctor", currency),
          patient: this.getAvailablePlans("patient", currency),
        };
      }

      const plans = PLAN_DEFINITIONS[planType];
      if (!plans) {
        throw new Error(`Invalid plan type: ${planType}`);
      }

      const availablePlans = {};

      // Process each plan tier
      for (const [tier, definition] of Object.entries(plans)) {
        availablePlans[tier] = {
          ...definition,
          tier,
          planType,
          // Get price in requested currency or fallback to USD
          price: currency
            ? definition.price[currency] || definition.price.USD
            : definition.price,
          originalPrice: currency
            ? definition.originalPrice?.[currency] ||
            definition.originalPrice?.USD
            : definition.originalPrice,
          currency,
          // Format features for display
          featureList: this.formatFeatureList(definition.features),

          // Convenience flags
          isFree: tier === "free",
          isPremium: tier !== "free",
          hasDiscount: definition.discountPercentage > 0,

          // Promo tracking
          promoExpiry: PROMO_EXPIRY,
          promoTimeLeft: getTimeUntilExpiry(),
          hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
        };
      }

      return availablePlans;
    } catch (error) {
      console.error("❌ Error getting available plans:", error);
      return {};
    }
  }

  /**
   * Get specific plan pricing and details (basic currency support)
   *
   * @param {string} planType - 'doctor' or 'patient'
   * @param {string} tier - Plan tier
   * @param {string} currency - Currency code
   * @returns {Object} Plan details with pricing
   */
  static getSubscriptionPricing(planType, tier, currency = "USD") {
    try {
      const plans = PLAN_DEFINITIONS[planType];
      if (!plans) {
        throw new Error(`Invalid plan type: ${planType}`);
      }

      const planDefinition = plans[tier];
      if (!planDefinition) {
        throw new Error(`Invalid tier: ${tier} for plan type: ${planType}`);
      }

      return {
        planType,
        tier,
        name: planDefinition.name,
        price: currency
          ? planDefinition.price[currency] || planDefinition.price.USD
          : planDefinition.price,
        originalPrice: currency
          ? planDefinition.originalPrice?.[currency] ||
          planDefinition.originalPrice?.USD
          : planDefinition.originalPrice,
        currency: currency || "USD",
        discountPercentage: planDefinition.discountPercentage || 0,
        commissionRate: planDefinition.commissionRate,
        features: planDefinition.features,
        featureList: this.formatFeatureList(planDefinition.features),
        monthlyLimits: planDefinition.monthlyLimits,
        familyMembers: planDefinition.familyMembers,

        // Convenience flags
        isFree: tier === "free",
        isPremium: tier !== "free",
        hasDiscount: planDefinition.discountPercentage > 0,

        // Promo tracking
        promoExpiry: PROMO_EXPIRY,
        promoTimeLeft: getTimeUntilExpiry(),
        hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
      };
    } catch (error) {
      console.error("❌ Error getting subscription pricing:", error);
      throw error;
    }
  }

  // =============================================================================
  // CURRENCY CONVERSION METHODS (DYNAMIC/REAL-TIME)
  // =============================================================================

  /**
   * Get available plans with real-time currency conversion for specific country
   *
   * @param {string} planType - 'doctor' or 'patient'
   * @param {string} countryCode - ISO country code (e.g., 'NG', 'GH')
   * @returns {Promise<Object>} Plans with real-time converted pricing
   */
  static async getAvailablePlansForCountry(planType, countryCode) {
    try {
      const CurrencyService = require("../../../shared/services/currencyService");

      const plans = PLAN_DEFINITIONS[planType];
      if (!plans) {
        throw new Error(`Invalid plan type: ${planType}`);
      }

      const availablePlans = {};

      // Get real-time pricing for each plan
      for (const [tier, definition] of Object.entries(plans)) {
        try {
          const pricing = await CurrencyService.getPlanPricingForCountry(
            definition,
            countryCode
          );

          // Ensure consistent currency across all plans for the same country
          const consistentCurrency = countryCode === 'NG' ? 'NGN' : 'USD';
          const discountAmount = countryCode === 'NG' ?
            (definition.discount?.NGN || 0) :
            (definition.discount?.USD || 0);

          // Use consistent currency for originalPrice too
          const consistentOriginalPrice = countryCode === 'NG' ?
            (definition.originalPrice?.NGN || definition.price.NGN) :
            (definition.originalPrice?.USD || definition.price.USD);

          availablePlans[tier] = {
            ...definition,
            price: pricing.amount,
            originalPrice: consistentOriginalPrice,
            currency: consistentCurrency,
            discount: { [consistentCurrency]: discountAmount },
            countryCode,
            conversionRate: pricing.rate,
            convertedAt: pricing.convertedAt,
            isPredefined: pricing.predefined || false,
            isFallback: pricing.fallback || false,
            tier,
            planType,
            featureList: this.formatFeatureList(definition.features),

            // Convenience flags
            isFree: tier === "free",
            isPremium: tier !== "free",
            hasDiscount: definition.discountPercentage > 0,

            // Promo tracking
            promoExpiry: PROMO_EXPIRY,
            promoTimeLeft: getTimeUntilExpiry(),
            hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
          };
        } catch (error) {
          console.error(`Error getting pricing for ${tier}:`, error);

          // Fallback pricing with consistent currency for country
          const fallbackCurrency = countryCode === 'NG' ? 'NGN' : 'USD';
          const fallbackPrice = countryCode === 'NG' ? definition.price.NGN : definition.price.USD;
          const fallbackOriginalPrice = countryCode === 'NG' ?
            (definition.originalPrice?.NGN || definition.price.NGN) :
            (definition.originalPrice?.USD || definition.price.USD);
          const fallbackDiscountAmount = countryCode === 'NG' ?
            (definition.discount?.NGN || 0) :
            (definition.discount?.USD || 0);

          availablePlans[tier] = {
            ...definition,
            price: fallbackPrice,
            originalPrice: fallbackOriginalPrice,
            currency: fallbackCurrency,
            discount: { [fallbackCurrency]: fallbackDiscountAmount },
            countryCode,
            isFallback: true,
            error: error.message,
            tier,
            planType,
            featureList: this.formatFeatureList(definition.features),

            // Promo tracking
            promoExpiry: PROMO_EXPIRY,
            promoTimeLeft: getTimeUntilExpiry(),
            hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
          };
        }
      }

      return availablePlans;
    } catch (error) {
      console.error("❌ Error getting available plans for country:", error);
      return {};
    }
  }

  /**
   * Get subscription pricing with real-time conversion for specific country
   *
   * @param {string} planType - 'doctor' or 'patient'
   * @param {string} tier - Plan tier
   * @param {string} countryCode - ISO country code
   * @returns {Promise<Object>} Plan pricing with real-time conversion
   */
  static async getSubscriptionPricingForCountry(planType, tier, countryCode) {
    try {
      const CurrencyService = require("../../../shared/services/currencyService");

      const plans = PLAN_DEFINITIONS[planType];
      if (!plans) {
        throw new Error(`Invalid plan type: ${planType}`);
      }

      const planDefinition = plans[tier];
      if (!planDefinition) {
        throw new Error(`Invalid tier: ${tier} for plan type: ${planType}`);
      }

      const pricing = await CurrencyService.getPlanPricingForCountry(
        planDefinition,
        countryCode
      );

      // Get discount information in the correct currency
      const targetCurrency = pricing.currency;
      const discountAmount = planDefinition.discount?.[targetCurrency] || 0;

      return {
        planType,
        tier,
        name: planDefinition.name,
        price: pricing.amount,
        originalPrice: pricing.originalAmount,
        discount: discountAmount,
        discountPercentage: planDefinition.discountPercentage || 0,
        currency: pricing.currency,
        countryCode,
        conversionRate: pricing.rate,
        convertedAt: pricing.convertedAt,
        isPredefined: pricing.predefined || false,
        isFallback: pricing.fallback || false,
        commissionRate: planDefinition.commissionRate,
        features: planDefinition.features,
        featureList: this.formatFeatureList(planDefinition.features),
        monthlyLimits: planDefinition.monthlyLimits,
        familyMembers: planDefinition.familyMembers,

        // Convenience flags
        isFree: tier === "free",
        isPremium: tier !== "free",
        hasDiscount: planDefinition.discountPercentage > 0,

        // Promo tracking
        promoExpiry: PROMO_EXPIRY,
        promoTimeLeft: getTimeUntilExpiry(),
        hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
      };
    } catch (error) {
      console.error(
        "❌ Error getting subscription pricing for country:",
        error
      );
      throw error;
    }
  }

  // =============================================================================
  // AUTO-BILLING MANAGEMENT METHODS
  // =============================================================================

  /**
   * Get user's auto-billing settings and capabilities
   *
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Complete auto-billing configuration
   */
  static async getAutoBillingSettings(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);

      if (!subscription.id) {
        return {
          autoBillingEnabled: false,
          preferredPaymentMethodId: null,
          canEnableAutoBilling: false,
          reason: "No active subscription found",
        };
      }

      // Get user's payment methods
      const userPaymentMethodRepository = require("../../transactions/repositories/userPaymentMethodRepository");
      let paymentMethods = [];
      try {
        paymentMethods = await userPaymentMethodRepository.findForAutoBilling(
          userId
        );
      } catch (error) {
        console.warn(
          "⚠️ Error fetching payment methods for auto-billing:",
          error
        );
      }

      return {
        autoBillingEnabled: subscription.autoBillingEnabled || false,
        preferredPaymentMethodId: subscription.preferredPaymentMethodId,
        autoBillingFailureCount: subscription.autoBillingFailureCount || 0,
        lastAutoBillingAttempt: subscription.lastAutoBillingAttempt,
        autoBillingGracePeriod: subscription.autoBillingGracePeriod || 7,
        canEnableAutoBilling:
          subscription.isPremium && paymentMethods.length > 0,
        availablePaymentMethods: paymentMethods,
        nextBillingDate: subscription.nextBillingDate,

        // Subscription context
        currentPlan: subscription.tier,
        planType: subscription.planType,
        subscriptionStatus: subscription.status,

        // Promo info for billing
        promoExpiry: PROMO_EXPIRY,
        promoTimeLeft: getTimeUntilExpiry(),
        hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
      };
    } catch (error) {
      console.error("❌ Error getting auto-billing settings:", error);
      throw error;
    }
  }

  // =============================================================================
  // SUBSCRIPTION CREATION AND ENHANCEMENT METHODS
  // =============================================================================

  /**
   * Create subscription from user tier information
   *
   * @param {string} userId - User ID
   * @param {string} tier - User's tier
   * @param {string} planType - 'doctor' or 'patient'
   * @returns {Object} Complete subscription object
   */
  static createSubscriptionFromUserTier(userId, tier, planType) {
    try {
      // Validate inputs
      if (!userId || !tier || !planType) {
        throw new Error(
          "Missing required parameters for subscription creation"
        );
      }

      // Check if plan definition exists
      if (!PLAN_DEFINITIONS[planType] || !PLAN_DEFINITIONS[planType][tier]) {
        console.warn(
          `⚠️ Plan definition not found for ${planType}/${tier}, using patient/free`
        );
        tier = "free";
        planType = "patient";
      }

      const planDefinition = PLAN_DEFINITIONS[planType][tier];
      const now = new Date();
      const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

      return {
        id: null,
        userId,
        tier: tier,
        planType: planType,
        status: "active",
        startDate: now,
        endDate: endDate,
        price: planDefinition.price?.USD || 0,
        currency: "USD",
        autoRenew: false,
        commissionRate: planDefinition.commissionRate || 0,
        features: planDefinition.features || {},
        monthlyLimits: planDefinition.monthlyLimits || {},
        currentUsage: {},
        familyMembers: planDefinition.familyMembers || 1,
        billingCycle: "monthly",
        metadata: { fromUserTier: true },
        createdAt: now,
        updatedAt: now,

        // Auto-billing fields
        autoBillingEnabled: false,
        preferredPaymentMethodId: null,
        autoBillingFailureCount: 0,
        lastAutoBillingAttempt: null,
        autoBillingGracePeriod: 7,

        // Enhanced fields
        planDefinition,
        featureList: this.formatFeatureList(planDefinition.features || {}),
        isActive: true,
        isExpired: false,
        isPremium: tier !== "free",
        daysRemaining: 365,
        usagePercentage: {},

        // Promo tracking
        promoExpiry: PROMO_EXPIRY,
        promoTimeLeft: getTimeUntilExpiry(),
        hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
      };
    } catch (error) {
      console.error("❌ Error creating subscription from user tier:", error);
      return this.createDefaultFreeSubscription(userId);
    }
  }

  /**
   * Create basic subscription from user tier (lightweight version)
   *
   * @param {string} userId - User ID
   * @param {string} tier - User's tier
   * @param {string} planType - 'doctor' or 'patient'
   * @param {Object} user - User object (optional)
   * @returns {Object} Basic subscription object
   */
  static createBasicSubscriptionFromUserTier(
    userId,
    tier,
    planType,
    user = null
  ) {
    try {
      // Validate plan exists for this user type
      if (!PLAN_DEFINITIONS[planType] || !PLAN_DEFINITIONS[planType][tier]) {
        console.warn(
          `⚠️ Plan ${planType}/${tier} not found, using free plan for ${planType}`
        );
        tier = "free";
      }

      const planDefinition = PLAN_DEFINITIONS[planType][tier];
      const now = new Date();

      console.log(`✅ Creating ${planType} subscription: ${tier} plan`);

      return {
        id: null,
        userId,
        tier: tier,
        planType: planType, // Correctly dynamic based on user role
        status: "active",
        startDate: now,
        endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),

        // Use stored prices only (no conversion)
        price: planDefinition.price?.USD || 0,
        currency: "USD",

        autoRenew: false,
        commissionRate: planDefinition.commissionRate || 0,
        features: planDefinition.features || {},
        monthlyLimits: planDefinition.monthlyLimits || {},
        currentUsage: {},
        familyMembers: planDefinition.familyMembers || 1,
        billingCycle: "monthly",
        metadata: {
          fromUserTier: true,
          basic: true,
          userRole: user?.role || "unknown",
          createdAt: now.toISOString(),
        },
        createdAt: now,
        updatedAt: now,

        // Enhanced fields
        planDefinition,
        featureList: this.formatFeatureList(planDefinition.features || {}),
        isActive: true,
        isExpired: false,
        isPremium: tier !== "free",
        daysRemaining: 365,
        usagePercentage: this.calculateUsagePercentage(
          {},
          planDefinition.monthlyLimits || {}
        ),

        // Promo tracking
        promoExpiry: PROMO_EXPIRY,
        promoTimeLeft: getTimeUntilExpiry(),
        hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
      };
    } catch (error) {
      console.error(
        "❌ Error creating basic subscription from user tier:",
        error
      );
      return this.createBasicFreeSubscription(userId, planType);
    }
  }

  /**
   * Create default free subscription (full version)
   *
   * @param {string} userId - User ID
   * @returns {Object} Complete free subscription object
   */
  static createDefaultFreeSubscription(userId) {
    try {
      const planDefinition = PLAN_DEFINITIONS.patient.free;
      const now = new Date();

      return {
        id: null,
        userId,
        tier: "free",
        planType: "patient",
        status: "active",
        startDate: now,
        endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
        price: 0,
        currency: "USD",
        autoRenew: false,
        commissionRate: planDefinition.commissionRate || 0,
        features: planDefinition.features || {},
        monthlyLimits: planDefinition.monthlyLimits || {},
        currentUsage: {},
        familyMembers: 1,
        billingCycle: "monthly",
        metadata: { isDefault: true },
        createdAt: now,
        updatedAt: now,

        // Auto-billing fields
        autoBillingEnabled: false,
        preferredPaymentMethodId: null,
        autoBillingFailureCount: 0,
        lastAutoBillingAttempt: null,
        autoBillingGracePeriod: 7,

        // Enhanced fields
        planDefinition,
        featureList: this.formatFeatureList(planDefinition.features || {}),
        isActive: true,
        isExpired: false,
        isPremium: false,
        daysRemaining: 365,
        usagePercentage: {},

        // Promo tracking
        promoExpiry: PROMO_EXPIRY,
        promoTimeLeft: getTimeUntilExpiry(),
        hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
      };
    } catch (error) {
      console.error("❌ Error creating default free subscription:", error);
      // Return minimal subscription if even this fails
      return this._createMinimalFallback(userId);
    }
  }

  /**
   * Create basic free subscription (lightweight version)
   *
   * @param {string} userId - User ID
   * @param {string} planType - Optional plan type override
   * @returns {Object} Basic free subscription object
   */
  static createBasicFreeSubscription(userId, planType = "patient") {
    try {
      const planDefinition =
        PLAN_DEFINITIONS[planType].free || PLAN_DEFINITIONS.patient.free;
      const now = new Date();

      return {
        id: null,
        userId,
        tier: "free",
        planType: planType,
        status: "active",
        startDate: now,
        endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        price: 0,
        currency: "USD",
        autoRenew: false,
        commissionRate: 0,
        features: planDefinition.features || {},
        monthlyLimits: planDefinition.monthlyLimits || {},
        currentUsage: {},
        familyMembers: 1,
        billingCycle: "monthly",
        metadata: { isDefault: true, basic: true },
        createdAt: now,
        updatedAt: now,

        // Enhanced fields
        planDefinition,
        featureList: this.formatFeatureList(planDefinition.features || {}),
        isActive: true,
        isExpired: false,
        isPremium: false,
        daysRemaining: 365,
        usagePercentage: {},

        // Promo tracking
        promoExpiry: PROMO_EXPIRY,
        promoTimeLeft: getTimeUntilExpiry(),
        hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
      };
    } catch (error) {
      console.error("❌ Error creating basic free subscription:", error);
      return this._createMinimalFallback(userId, planType);
    }
  }

  /**
   * Enhanced subscription data with all auto-billing info included
   *
   * @param {Object} subscription - Raw subscription from database
   * @returns {Object} Fully enhanced subscription object
   */
  static enhanceSubscriptionData(subscription) {
    try {
      const planType = subscription.planType || "patient";
      const tier = subscription.tier || "free";

      // Get plan definition with fallback
      let planDefinition;
      try {
        planDefinition =
          PLAN_DEFINITIONS[planType]?.[tier] || PLAN_DEFINITIONS.patient.free;
      } catch (error) {
        console.warn("⚠️ Error getting plan definition, using fallback");
        planDefinition = PLAN_DEFINITIONS.patient.free;
      }

      return {
        id: subscription.id,
        userId: subscription.userId,
        tier: subscription.tier,
        planType: subscription.planType,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        price: subscription.price,
        currency: subscription.currency,
        autoRenew: subscription.autoRenew,
        commissionRate:
          subscription.commissionRate || planDefinition.commissionRate,
        features: subscription.features || planDefinition.features,
        monthlyLimits:
          subscription.monthlyLimits || planDefinition.monthlyLimits,
        currentUsage: subscription.currentUsage || {},
        familyMembers:
          subscription.familyMembers || planDefinition.familyMembers || 1,
        billingCycle: subscription.billingCycle,
        metadata: subscription.metadata || {},
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,

        // Auto-billing fields
        autoBillingEnabled: subscription.autoBillingEnabled || false,
        preferredPaymentMethodId: subscription.preferredPaymentMethodId,
        autoBillingFailureCount: subscription.autoBillingFailureCount || 0,
        lastAutoBillingAttempt: subscription.lastAutoBillingAttempt,
        autoBillingGracePeriod: subscription.autoBillingGracePeriod || 7,
        nextBillingDate: subscription.nextBillingDate,

        // Enhanced fields
        planDefinition,
        featureList: this.formatFeatureList(
          subscription.features || planDefinition.features
        ),
        isActive: subscription.status === "active",
        isExpired: subscription.status === "expired",
        isPremium: tier !== "free",
        daysRemaining: this.calculateDaysRemaining(subscription.endDate),
        usagePercentage: this.calculateUsagePercentage(
          subscription.currentUsage || {},
          subscription.monthlyLimits || planDefinition.monthlyLimits
        ),

        // Promo tracking
        promoExpiry: PROMO_EXPIRY,
        promoTimeLeft: getTimeUntilExpiry(),
        hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
      };
    } catch (error) {
      console.error("❌ Error enhancing subscription data:", error);
      // Return basic subscription data if enhancement fails
      return {
        ...subscription,
        planDefinition: PLAN_DEFINITIONS.patient.free,
        featureList: [],
        isActive: subscription.status === "active",
        isExpired: subscription.status === "expired",
        isPremium: false,
        daysRemaining: 0,
        usagePercentage: {},
        promoExpiry: PROMO_EXPIRY,
        promoTimeLeft: getTimeUntilExpiry(),
        hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
      };
    }
  }

  /**
   * Enhanced subscription data with basic processing (lighter version)
   *
   * @param {Object} subscription - Raw subscription from database
   * @returns {Object} Enhanced subscription with basic fields
   */
  static enhanceBasicSubscriptionData(subscription) {
    try {
      const planType = subscription.planType || "patient";
      const tier = subscription.tier || "free";
      const planDefinition =
        PLAN_DEFINITIONS[planType]?.[tier] || PLAN_DEFINITIONS.patient.free;

      return {
        ...subscription,

        // Fill in missing data from plan definition
        commissionRate:
          subscription.commissionRate || planDefinition.commissionRate,
        features: subscription.features || planDefinition.features,
        monthlyLimits:
          subscription.monthlyLimits || planDefinition.monthlyLimits,
        currentUsage: subscription.currentUsage || {},
        familyMembers:
          subscription.familyMembers || planDefinition.familyMembers || 1,

        // Enhanced fields
        planDefinition,
        featureList: this.formatFeatureList(
          subscription.features || planDefinition.features
        ),
        isActive: subscription.status === "active",
        isExpired: subscription.status === "expired",
        isPremium: tier !== "free",
        daysRemaining: this.calculateDaysRemaining(subscription.endDate),
        usagePercentage: this.calculateUsagePercentage(
          subscription.currentUsage || {},
          subscription.monthlyLimits || planDefinition.monthlyLimits
        ),

        // Promo tracking
        promoExpiry: PROMO_EXPIRY,
        promoTimeLeft: getTimeUntilExpiry(),
        hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
      };
    } catch (error) {
      console.error("❌ Error enhancing basic subscription data:", error);
      return {
        ...subscription,
        planDefinition: {},
        featureList: [],
        isActive: subscription.status === "active",
        isExpired: subscription.status === "expired",
        isPremium: false,
        daysRemaining: 0,
        usagePercentage: {},
        promoExpiry: PROMO_EXPIRY,
        promoTimeLeft: getTimeUntilExpiry(),
        hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
      };
    }
  }

  // =============================================================================
  // SUBSCRIPTION RETRIEVAL BY ID AND CACHE MANAGEMENT
  // =============================================================================

  /**
   * Get subscription by ID with full enhancement
   *
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} Enhanced subscription
   */
  static async getSubscriptionById(subscriptionId) {
    try {
      const subscription = await subscriptionRepository.findById(
        subscriptionId
      );
      if (!subscription) {
        throw new Error("Subscription not found");
      }

      return this.enhanceSubscriptionData(subscription);
    } catch (error) {
      console.error("❌ Error getting subscription by ID:", error);
      throw error;
    }
  }

  /**
   * Clear user subscription cache - call this after subscription changes
   *
   * @param {string} userId - User ID
   */
  static async clearUserSubscriptionCache(userId) {
    try {
      await Promise.all([
        cache.del(`user:${userId}:subscription`),
        cache.del(`user:${userId}:subscription:basic`),
      ]);
      console.log(`✅ Cleared subscription cache for user: ${userId}`);
    } catch (error) {
      console.error("❌ Error clearing subscription cache:", error);
      // Don't throw - cache clearing is not critical
    }
  }

  /**
   * Invalidate cache when subscription is updated/created
   * Call this method after any subscription modification
   *
   * @param {string} userId - User ID
   * @param {string} operation - Operation type ('create', 'update', 'delete')
   */
  static async invalidateSubscriptionCache(userId, operation = 'update') {
    try {
      console.log(`🔄 Invalidating subscription cache for user: ${userId} (${operation})`);

      // Clear all subscription-related cache entries
      await Promise.all([
        cache.del(`user:${userId}:subscription`),
        cache.del(`user:${userId}:subscription:basic`),
        // Clear any additional subscription-related cache keys
        cache.del(`user:${userId}:features`),
        cache.del(`user:${userId}:auto-billing`),
      ]);

      console.log(`✅ Cache invalidated for user: ${userId}`);
    } catch (error) {
      console.error("❌ Error invalidating subscription cache:", error);
      // Don't throw - cache invalidation is not critical for functionality
    }
  }

  // =============================================================================
  // UTILITY AND FORMATTING METHODS
  // =============================================================================

  /**
   * Format features as readable list (updated for new structure)
   *
   * @param {Object|Array} features - Features object or array
   * @returns {Array<string>} Formatted feature names
   */
  static formatFeatureList(features) {
    try {
      if (!features) {
        return [];
      }

      // Handle array format (old structure)
      if (Array.isArray(features)) {
        return features.map((feature) => this.formatFeatureName(feature));
      }

      // Handle object format (new structure)
      if (typeof features === "object") {
        const featureList = [];

        for (const [key, value] of Object.entries(features)) {
          if (value === true) {
            featureList.push(this.formatFeatureName(key));
          } else if (typeof value === "number" && value > 0) {
            featureList.push(`${this.formatFeatureName(key)}: ${value}`);
          } else if (typeof value === "string") {
            featureList.push(`${this.formatFeatureName(key)}: ${value}`);
          }
        }

        return featureList;
      }

      return [];
    } catch (error) {
      console.error("❌ Error formatting feature list:", error);
      return [];
    }
  }

  /**
   * Format feature name for display (updated with new features)
   *
   * @param {string} featureName - Raw feature name
   * @returns {string} Formatted display name
   */
  static formatFeatureName(featureName) {
    const nameMap = {
      // Common features
      chatOnly: "Chat Only",
      voiceConsultation: "Voice Consultation",
      videoConsultation: "Video Consultation",

      // Patient features
      generalEmergencySpecialists: "General Emergency Specialists",
      allSpecialists: "All Specialists",
      labAccess: "Lab Access",
      pharmacy: "Pharmacy Access",
      shopAccess: "Shop Access",
      firstAidInstructions: "First Aid Instructions",
      familyPlan: "Family Plan",
      earlyAccessFeatures: "Early Access Features",
      betaAccess: "Beta Access",

      // Doctor features
      regularProfileListing: "Regular Profile Listing",
      topProfileListing: "Top Profile Listing",
      unlimitedPatients: "Unlimited Patients",
      unlimitedAI: "Unlimited AI",

      // Support
      standardSupport: "Standard Support",
      prioritySupport: "Priority Support",

      // Legacy mappings (for backward compatibility)
      "chat only": "Chat Only",
      "voice consultation": "Voice Consultation",
      "video consultation": "Video Consultation",
      "regular profile listing": "Regular Profile Listing",
      "top profile listing": "Top Profile Listing",
      "general emergency specialists": "General Emergency Specialists",
      "all specialists": "All Specialists",
      "lab access": "Lab Access",
      "shop access": "Shop Access",
      "first aid instructions": "First Aid Instructions",
      "family plan": "Family Plan",
      "standard support": "Standard Support",
      "priority support": "Priority Support",
      "early access features": "Early Access Features",
      beta_access: "Beta Access",
      "unlimited patients": "Unlimited Patients",
      "unlimited ai": "Unlimited AI",
    };

    return (
      nameMap[featureName] ||
      featureName
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
    );
  }

  /**
   * Calculate days remaining until subscription expiration
   *
   * @param {Date} endDate - Subscription end date
   * @returns {number} Days remaining (0 if expired)
   */
  static calculateDaysRemaining(endDate) {
    try {
      if (!endDate) return 0;

      const now = new Date();
      const end = new Date(endDate);
      const diffTime = end - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return Math.max(0, diffDays);
    } catch (error) {
      console.error("❌ Error calculating days remaining:", error);
      return 0;
    }
  }

  /**
   * Calculate usage percentage for monthly limits
   *
   * @param {Object} currentUsage - Current usage data
   * @param {Object} monthlyLimits - Monthly limit definitions
   * @returns {Object} Usage percentages with status
   */
  static calculateUsagePercentage(currentUsage, monthlyLimits) {
    try {
      const usagePercentage = {};

      if (!currentUsage || !monthlyLimits) {
        return usagePercentage;
      }

      for (const [key, limit] of Object.entries(monthlyLimits)) {
        if (typeof limit === "number" && limit > 0) {
          const used = currentUsage[key] || 0;
          usagePercentage[key] = {
            used,
            limit,
            percentage: Math.min(100, Math.round((used / limit) * 100)),
            remaining: Math.max(0, limit - used),
            isOverLimit: used > limit,
          };
        }
      }

      return usagePercentage;
    } catch (error) {
      console.error("❌ Error calculating usage percentage:", error);
      return {};
    }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Get subscription from cache with error handling
   */
  static async _getCachedSubscription(userId) {
    try {
      const cacheKey = `user:${userId}:subscription`;
      const cached = await cache.get(cacheKey);
      return cached; // Cache utility already parses JSON
    } catch (error) {
      console.warn("Cache get failed:", error.message);
      return null;
    }
  }

  /**
   * Get subscription from database with multiple fallback strategies
   */
  static async _getSubscriptionFromDatabase(userId) {
    try {
      // Strategy 1: Direct findOne method
      if (typeof subscriptionRepository.findOne === "function") {
        return await subscriptionRepository.findOne({
          where: { userId, status: "active" },
          order: { createdAt: "DESC" },
        });
      }

      // Strategy 2: Repository with findOne
      if (
        subscriptionRepository.repo &&
        typeof subscriptionRepository.repo.findOne === "function"
      ) {
        return await subscriptionRepository.repo.findOne({
          where: { userId, status: "active" },
          order: { createdAt: "DESC" },
        });
      }

      // Strategy 3: Query builder
      if (
        subscriptionRepository.repo &&
        typeof subscriptionRepository.repo.createQueryBuilder === "function"
      ) {
        return await subscriptionRepository.repo
          .createQueryBuilder("subscription")
          .where("subscription.userId = :userId", { userId })
          .andWhere("subscription.status = :status", { status: "active" })
          .orderBy("subscription.createdAt", "DESC")
          .getOne();
      }

      // Strategy 4: findByUserId method
      if (typeof subscriptionRepository.findByUserId === "function") {
        const subscriptions = await subscriptionRepository.findByUserId(userId);
        return subscriptions.find((sub) => sub.status === "active");
      }

      console.warn(
        "⚠️ Subscription repository method not found, using fallback"
      );
      return null;
    } catch (error) {
      console.error("❌ Database query failed:", error);
      return null;
    }
  }

  /**
   * Get active subscription with simple query
   */
  static async _getActiveSubscription(userId) {
    try {
      return await subscriptionRepository.repo.findOne({
        where: { userId, status: "active" },
        order: { createdAt: "DESC" },
      });
    } catch (error) {
      console.error("❌ Simple query failed:", error);
      return null;
    }
  }

  /**
   * Create subscription from user table data
   */
  static async _createSubscriptionFromUserData(userId) {
    try {
      const userRepository = require("../repositories/userRepository");
      let user;
      try {
        user = await userRepository.findById(userId);
      } catch (userError) {
        console.error("❌ Error fetching user:", userError);
        user = null;
      }

      if (user && user.tier && user.tier !== "free") {
        console.log("✅ Creating subscription from user tier:", user.tier);
        const planType = user.role === "doctor" ? "doctor" : "patient";
        return this.createSubscriptionFromUserTier(userId, user.tier, planType);
      }

      console.log("✅ Creating default free subscription for user:", userId);
      return this.createDefaultFreeSubscription(userId);
    } catch (error) {
      console.error("❌ Error creating subscription from user data:", error);
      return this.createDefaultFreeSubscription(userId);
    }
  }

  /**
   * Create basic subscription from user data (lightweight)
   */
  static async _createBasicFromUserData(userId) {
    try {
      const userRepository = require("../repositories/userRepository");
      let user;
      try {
        user = await userRepository.findById(userId);
      } catch (userError) {
        console.error("❌ Error fetching user:", userError);
        user = null;
      }

      if (user && user.tier && user.tier !== "free") {
        const planType = user.role === "doctor" ? "doctor" : "patient";
        return this.createBasicSubscriptionFromUserTier(
          userId,
          user.tier,
          planType,
          user
        );
      }

      return this.createBasicFreeSubscription(userId);
    } catch (error) {
      console.error("❌ Error creating basic subscription:", error);
      return this.createBasicFreeSubscription(userId);
    }
  }

  /**
   * Create absolute minimal fallback subscription (never fails)
   */
  static _createMinimalFallback(userId, planType = "patient") {
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
      features: {},
      monthlyLimits: {},
      currentUsage: {},
      familyMembers: 1,
      metadata: { fallback: true, minimal: true },
      isActive: true,
      isExpired: false,
      isPremium: false,
      daysRemaining: 365,
      usagePercentage: {},
      promoExpiry: PROMO_EXPIRY,
      promoTimeLeft: getTimeUntilExpiry(),
      hasActivePromo: new Date() < new Date(PROMO_EXPIRY),
    };
  }

  /**
   * Cache helper methods
   */
  static async _getFromCache(key) {
    try {
      const cached = await cache.get(key);
      return cached; // Cache utility already parses JSON
    } catch (error) {
      console.warn(`Cache get failed for ${key}:`, error.message);
      return null;
    }
  }

  static async _setCache(key, data, ttl = 300) {
    try {
      // Add timestamp for cache validation
      const dataWithTimestamp = {
        ...data,
        cachedAt: Date.now()
      };
      await cache.set(key, dataWithTimestamp, ttl); // Cache utility handles JSON.stringify
    } catch (error) {
      console.warn(`Cache set failed for ${key}:`, error.message);
    }
  }

  static async _cacheSubscription(userId, subscription) {
    try {
      const cacheKey = `user:${userId}:subscription`;
      // Add timestamp for cache validation
      const subscriptionWithTimestamp = {
        ...subscription,
        cachedAt: Date.now()
      };
      await cache.set(cacheKey, subscriptionWithTimestamp, 1800); // 30 min cache with TTL
    } catch (error) {
      console.warn(
        `Failed to cache subscription for user ${userId}:`,
        error.message
      );
    }
  }

  /**
   * Check if cached data should be validated against database
   * Validates based on cache age and randomized validation intervals
   *
   * @param {Object} cachedData - Cached subscription data
   * @returns {Promise<boolean>} True if validation is needed
   */
  static async _shouldValidateCache(cachedData) {
    try {
      // Don't validate if cache is very fresh (less than 5 minutes)
      const cacheAge = Date.now() - (cachedData.cachedAt || 0);
      if (cacheAge < 5 * 60 * 1000) {
        return false;
      }

      // Always validate for premium subscriptions older than 10 minutes
      if (cachedData.isPremium && cacheAge > 10 * 60 * 1000) {
        return true;
      }

      // Random validation for active subscriptions (10% chance)
      if (cachedData.status === 'active' && Math.random() < 0.1) {
        return true;
      }

      // Validate if cache is approaching expiry
      return cacheAge > 12 * 60 * 1000; // 12 minutes
    } catch (error) {
      console.warn("Error checking cache validation need:", error);
      return false;
    }
  }

  /**
   * Compare cached data with fresh database data for consistency
   *
   * @param {Object} cached - Cached subscription data
   * @param {Object} fresh - Fresh database data
   * @returns {boolean} True if cache is still valid
   */
  static _isCacheValid(cached, fresh) {
    try {
      // Key fields that must match
      const keyFields = ['status', 'tier', 'endDate', 'price'];

      for (const field of keyFields) {
        if (cached[field] !== fresh[field]) {
          console.log(`Cache validation failed: ${field} mismatch`);
          return false;
        }
      }

      // Check if subscription has been updated recently
      const cachedUpdatedAt = new Date(cached.updatedAt || cached.createdAt);
      const freshUpdatedAt = new Date(fresh.updatedAt || fresh.createdAt);

      if (freshUpdatedAt > cachedUpdatedAt) {
        console.log("Cache validation failed: database has newer data");
        return false;
      }

      return true;
    } catch (error) {
      console.warn("Error validating cache consistency:", error);
      return false; // Assume invalid on error
    }
  }
}

module.exports = SubscriptionCompatibilityService;
