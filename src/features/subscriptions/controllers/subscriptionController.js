// src/features/subscriptions/controllers/subscriptionController.js
/**
 * SubscriptionController
 *
 * Handles subscription-related HTTP endpoints.
 * Controllers are THIN - business logic is in services.
 *
 * ENDPOINTS:
 * PUBLIC (no auth):
 *   GET /public/plans           - Get all plans for landing page
 *   GET /public/plans/:type/:tier - Get specific plan pricing
 *
 * AUTHENTICATED:
 *   GET /current                - Get user's current subscription
 *   GET /plans                  - Get available plans for user type
 *   GET /plans/:type/:tier/pricing - Get specific plan pricing
 *   POST /create-payment        - Create payment for upgrade
 *   POST /upgrade               - Direct upgrade (free plans)
 *   POST /cancel                - Cancel subscription
 *   GET /usage                  - Get usage info
 *   GET /usage-summary          - Get detailed usage summary
 *   GET /features/:name         - Check feature access
 *   GET /auto-billing           - Get auto-billing settings
 *   POST /auto-billing/enable   - Enable auto-billing
 *   POST /auto-billing/disable  - Disable auto-billing
 *   GET /analytics              - Get analytics (admin only)
 */

const SubscriptionCompatibilityService = require("../services/subscriptionCompatibilityService");
const SubscriptionService = require("../services/subscriptionService");
const BillingService = require("../services/billingService");
const UsageService = require("../services/usageService");
const { PLAN_DEFINITIONS } = require("../utils/subscriptionConstants");

class SubscriptionController {

  // ===========================================================================
  // PUBLIC ENDPOINTS (No Auth Required)
  // ===========================================================================

  /**
   * Get available subscription plans (PUBLIC - for landing page)
   * Returns both doctor and patient plans, or specific type if requested
   * If authenticated, returns plans for user's role
   *
   * GET /api/subscription/public/plans
   * Query: planType, countryCode, withDiscount
   */
  static async getPublicPlans(req, res, next) {
    try {
      const countryCode = req.query.countryCode || req.headers["x-country-code"] || "US";
      const withDiscount = req.query.withDiscount !== "false";

      // Use authenticated user's role if available
      let planType = req.query.planType || null;
      if (req.user && !planType) {
        planType = req.user.role === "doctor" ? "doctor" : "patient";
      }

      const plansData = SubscriptionCompatibilityService.getAvailablePlans(
        planType,
        countryCode,
        withDiscount
      );

      res.json({
        success: true,
        message: "Subscription plans retrieved successfully",
        data: {
          ...plansData,
          userContext: req.user
            ? { isAuthenticated: true, role: req.user.role }
            : { isAuthenticated: false }
        }
      });
    } catch (error) {
      console.error("Error getting public plans:", error.message);
      next(error);
    }
  }

  /**
   * Get specific plan pricing (PUBLIC)
   *
   * GET /api/subscription/public/plans/:planType/:tier
   * Query: countryCode, withDiscount
   */
  static async getPublicPlanPricing(req, res, next) {
    try {
      const { planType, tier } = req.params;
      const countryCode = req.query.countryCode || "US";
      const withDiscount = req.query.withDiscount !== "false";

      if (!planType || !tier) {
        return res.status(400).json({
          success: false,
          error: "planType and tier are required"
        });
      }

      const pricing = SubscriptionCompatibilityService.getPlanPricing(
        planType,
        tier,
        countryCode,
        withDiscount
      );

      res.json({
        success: true,
        message: "Plan pricing retrieved successfully",
        data: pricing
      });
    } catch (error) {
      console.error("Error getting plan pricing:", error.message);
      if (error.message.includes("Invalid")) {
        return res.status(404).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  // ===========================================================================
  // SUBSCRIPTION INFO ENDPOINTS
  // ===========================================================================

  /**
   * Get current user's subscription
   *
   * GET /api/subscription/current
   * Query: countryCode
   */
  static async getCurrentSubscription(req, res, next) {
    try {
      const userId = req.user.sub;
      const countryCode = req.query.countryCode || req.headers["x-country-code"] || "US";

      const subscription = await SubscriptionCompatibilityService.getUserSubscription(userId);

      // Get pricing for user's country
      let pricing = null;
      if (subscription.tier !== "free") {
        try {
          pricing = SubscriptionCompatibilityService.getPlanPricing(
            subscription.planType,
            subscription.tier,
            countryCode,
            true
          );
        } catch (e) {
          console.warn("Failed to get dynamic pricing:", e.message);
        }
      }

      res.json({
        success: true,
        message: "Current subscription retrieved successfully",
        data: {
          // Core info
          id: subscription.id,
          tier: subscription.tier,
          planType: subscription.planType,
          status: subscription.status,

          // Pricing
          price: pricing?.price || subscription.price,
          originalPrice: pricing?.originalPrice,
          currency: pricing?.currency || subscription.currency,
          countryCode,

          // Features & limits
          features: subscription.featureList,
          monthlyLimits: subscription.monthlyLimits,
          currentUsage: subscription.currentUsage,
          usagePercentage: subscription.usagePercentage,
          familyMembers: subscription.familyMembers,
          commissionRate: subscription.commissionRate,

          // Dates
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          daysRemaining: subscription.daysRemaining,

          // Billing
          autoRenew: subscription.autoRenew,
          autoBillingEnabled: subscription.autoBillingEnabled,

          // Flags
          isActive: subscription.isActive,
          isExpired: subscription.isExpired,
          isPremium: subscription.isPremium
        }
      });
    } catch (error) {
      console.error("Error getting current subscription:", error.message);
      next(error);
    }
  }

  /**
   * Get available plans for authenticated user
   *
   * GET /api/subscription/plans
   * Query: countryCode, withDiscount
   */
  static async getAvailablePlans(req, res, next) {
    try {
      const planType = req.user.role === "doctor" ? "doctor" : "patient";
      const countryCode = req.query.countryCode || req.headers["x-country-code"] || "US";
      const withDiscount = req.query.withDiscount !== "false";

      const plansData = SubscriptionCompatibilityService.getAvailablePlans(
        planType,
        countryCode,
        withDiscount
      );

      res.json({
        success: true,
        message: "Available plans retrieved successfully",
        data: {
          userType: planType,
          countryCode,
          ...plansData
        }
      });
    } catch (error) {
      console.error("Error getting available plans:", error.message);
      next(error);
    }
  }

  /**
   * Get specific plan pricing
   *
   * GET /api/subscription/plans/:planType/:tier/pricing
   */
  static async getPlanPricing(req, res, next) {
    try {
      const { planType, tier } = req.params;
      const countryCode = req.query.countryCode || "US";
      const withDiscount = req.query.withDiscount !== "false";

      const pricing = SubscriptionCompatibilityService.getPlanPricing(
        planType,
        tier,
        countryCode,
        withDiscount
      );

      res.json({
        success: true,
        message: "Plan pricing retrieved successfully",
        data: pricing
      });
    } catch (error) {
      console.error("Error getting plan pricing:", error.message);
      if (error.message.includes("Invalid")) {
        return res.status(404).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  // ===========================================================================
  // SUBSCRIPTION MANAGEMENT ENDPOINTS
  // ===========================================================================

  /**
   * Create subscription payment
   *
   * POST /api/subscription/create-payment
   * Body: planType, tier, countryCode, paymentProvider, enableAutoBilling
   */
  static async createSubscriptionPayment(req, res, next) {
    try {
      const userId = req.user.sub;
      const {
        planType,
        tier,
        countryCode = "US",
        paymentProvider = "auto",
        enableAutoBilling = false
      } = req.body;

      if (!planType || !tier) {
        return res.status(400).json({
          success: false,
          error: "planType and tier are required"
        });
      }

      const result = await BillingService.createPayment({
        userId,
        planType,
        tier,
        countryCode,
        paymentProvider,
        enableAutoBilling
      });

      res.json({
        success: true,
        message: result.autoUpgraded
          ? "Subscription upgraded successfully (free plan)"
          : "Payment created successfully",
        data: result
      });
    } catch (error) {
      console.error("Error creating subscription payment:", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Process upgrade after payment (webhook callback)
   *
   * POST /api/subscription/process-upgrade-after-payment
   * Body: transactionId
   */
  static async processUpgradeAfterPayment(req, res, next) {
    try {
      const { transactionId } = req.body;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: "transactionId is required"
        });
      }

      const result = await SubscriptionService.processSubscriptionUpgradeAfterPayment(transactionId);

      res.json({
        success: true,
        message: "Subscription upgraded successfully",
        data: result
      });
    } catch (error) {
      console.error("Error processing upgrade:", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Direct upgrade (for free plans or admin use)
   *
   * POST /api/subscription/upgrade
   * Body: newTier, planType
   */
  static async upgradeSubscription(req, res, next) {
    try {
      const userId = req.user.sub;
      const { newTier, planType } = req.body;

      if (!newTier) {
        return res.status(400).json({
          success: false,
          error: "newTier is required"
        });
      }

      const targetPlanType = planType || (req.user.role === "doctor" ? "doctor" : "patient");

      // Validate plan exists
      if (!PLAN_DEFINITIONS[targetPlanType]?.[newTier]) {
        return res.status(400).json({
          success: false,
          error: `Invalid plan: ${targetPlanType}/${newTier}`
        });
      }

      const result = await SubscriptionService.upgradeSubscription(userId, newTier, targetPlanType);

      res.json({
        success: true,
        message: "Subscription upgraded successfully",
        data: {
          tier: result.tier,
          planType: result.planType,
          features: result.featureList
        }
      });
    } catch (error) {
      console.error("Error upgrading subscription:", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Cancel subscription
   *
   * POST /api/subscription/cancel
   * Body: reason (optional)
   */
  static async cancelSubscription(req, res, next) {
    try {
      const userId = req.user.sub;
      const { reason } = req.body;

      await SubscriptionService.cancelSubscription(userId, reason);

      res.json({
        success: true,
        message: "Subscription cancelled successfully",
        data: { cancelledAt: new Date(), reason }
      });
    } catch (error) {
      console.error("Error cancelling subscription:", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // ===========================================================================
  // USAGE ENDPOINT (Single comprehensive endpoint)
  // ===========================================================================

  /**
   * Get comprehensive usage summary
   * Returns all subscription usage data, limits, features, and health status
   *
   * GET /api/subscription/usage
   */
  static async getUsageSummary(req, res, next) {
    try {
      const userId = req.user.sub;
      const summary = await UsageService.getUsageSummary(userId);

      res.json({
        success: true,
        message: "Usage summary retrieved successfully",
        data: summary
      });
    } catch (error) {
      console.error("Error getting usage summary:", error.message);
      next(error);
    }
  }

  // ===========================================================================
  // FEATURE ACCESS ENDPOINTS
  // ===========================================================================

  /**
   * Check feature access
   *
   * GET /api/subscription/features/:featureName
   */
  static async checkFeatureAccess(req, res, next) {
    try {
      const userId = req.user.sub;
      const { featureName } = req.params;

      const access = await SubscriptionCompatibilityService.hasFeatureAccess(userId, featureName);

      res.json({
        success: true,
        message: "Feature access checked successfully",
        data: {
          feature: featureName,
          ...access
        }
      });
    } catch (error) {
      console.error("Error checking feature access:", error.message);
      next(error);
    }
  }

  // ===========================================================================
  // AUTO-BILLING ENDPOINTS
  // ===========================================================================

  /**
   * Get auto-billing settings
   *
   * GET /api/subscription/auto-billing
   */
  static async getAutoBillingSettings(req, res, next) {
    try {
      const userId = req.user.sub;
      const settings = await BillingService.getAutoBillingSettings(userId);

      res.json({
        success: true,
        message: "Auto-billing settings retrieved successfully",
        data: settings
      });
    } catch (error) {
      console.error("Error getting auto-billing settings:", error.message);
      next(error);
    }
  }

  /**
   * Enable auto-billing
   *
   * POST /api/subscription/auto-billing/enable
   * Body: paymentMethodId
   */
  static async enableAutoBilling(req, res, next) {
    try {
      const userId = req.user.sub;
      const { paymentMethodId } = req.body;

      if (!paymentMethodId) {
        return res.status(400).json({
          success: false,
          error: "paymentMethodId is required"
        });
      }

      await BillingService.enableAutoBilling(userId, paymentMethodId);

      res.json({
        success: true,
        message: "Auto-billing enabled successfully",
        data: { autoBillingEnabled: true, enabledAt: new Date() }
      });
    } catch (error) {
      console.error("Error enabling auto-billing:", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Disable auto-billing
   *
   * POST /api/subscription/auto-billing/disable
   */
  static async disableAutoBilling(req, res, next) {
    try {
      const userId = req.user.sub;

      await BillingService.disableAutoBilling(userId);

      res.json({
        success: true,
        message: "Auto-billing disabled successfully",
        data: { autoBillingEnabled: false, disabledAt: new Date() }
      });
    } catch (error) {
      console.error("Error disabling auto-billing:", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // ===========================================================================
  // ADMIN ENDPOINTS
  // ===========================================================================

  /**
   * Get subscription analytics (Admin only)
   *
   * GET /api/subscription/analytics
   */
  static async getSubscriptionAnalytics(req, res, next) {
    try {
      if (!["admin", "super_admin"].includes(req.user.role)) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const analytics = await SubscriptionService.getSubscriptionAnalytics();

      res.json({
        success: true,
        message: "Analytics retrieved successfully",
        data: analytics
      });
    } catch (error) {
      console.error("Error getting analytics:", error.message);
      next(error);
    }
  }

  // ===========================================================================
  // TEST ENDPOINT (Development only)
  // ===========================================================================

  /**
   * Test subscription upgrade (DEV ONLY)
   */
  static async testSubscriptionUpgrade(req, res) {
    try {
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ success: false, error: "Not allowed in production" });
      }

      const { transactionId } = req.params;
      const { planType = "patient", tier = "premium" } = req.body;

      const result = await SubscriptionService.testSubscriptionUpgrade(transactionId, planType, tier);

      res.json(result);
    } catch (error) {
      console.error("Test upgrade error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = SubscriptionController;
