const subscriptionCompatibilityService = require("../services/subscriptionCompatibilityService");
const SubscriptionService = require("../services/subscriptionService");
const UsageSummaryService = require("../services/usageSummaryService");
const { PLAN_DEFINITIONS, SUBSCRIPTION_PLANS, SUBSCRIPTION_TIERS } = require('../utils/subscriptionConstants');
// const { PLAN_DEFINITIONS } = require("../utils/subscriptionConstants");

class SubscriptionController {

  /**
 * Get current subscription with dynamic pricing based on country
 */
  static async getCurrentSubscription(req, res, next) {
    try {
      const userId = req.user.sub;
      const countryCode = req.query.countryCode || req.headers['x-country-code'] || 'US';

      const subscription = await subscriptionCompatibilityService.getUserSubscriptionBasic(userId);

      // Get real-time pricing for current plan if country code is provided
      const CurrencyService = require('../../../shared/services/currencyService');
      const planDefinition = PLAN_DEFINITIONS[subscription.planType]?.[subscription.tier];
      let dynamicPricing = null;

      if (planDefinition) {
        try {
          // Force currency based on country code
          const targetCurrency = countryCode === "NG" ? "NGN" : "USD";
          dynamicPricing = await CurrencyService.getPlanPricingForCountry(
            planDefinition,
            countryCode
          );

          // Override currency to ensure it matches country expectation
          if (dynamicPricing) {
            dynamicPricing.currency = targetCurrency;
          }
        } catch (error) {
          console.warn('Failed to get dynamic pricing:', error.message);
          // Continue without dynamic pricing
        }
      }

      res.json({
        success: true,
        message: 'Current subscription retrieved successfully',
        data: {
          id: subscription.id,
          tier: subscription.tier,
          planType: subscription.planType,
          status: subscription.status,

          // Dynamic pricing based on country
          price: dynamicPricing?.amount || subscription.price,
          originalPrice: dynamicPricing?.originalAmount,
          currency: dynamicPricing?.currency || subscription.currency,

          // Currency conversion info
          countryCode,
          conversionRate: dynamicPricing?.rate,
          convertedAt: dynamicPricing?.convertedAt,
          isPredefined: dynamicPricing?.predefined || false,
          isFallback: dynamicPricing?.fallback || false,

          // Original subscription data
          storedPrice: subscription.price,
          storedCurrency: subscription.currency,

          // Rest of subscription data
          commissionRate: subscription.commissionRate,
          features: subscription.featureList,
          monthlyLimits: subscription.monthlyLimits,
          currentUsage: subscription.currentUsage,
          familyMembers: subscription.familyMembers,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          autoRenew: subscription.autoRenew,
          autoBillingEnabled: subscription.autoBillingEnabled || false,

          // Enhanced fields
          isActive: subscription.isActive,
          isExpired: subscription.isExpired,
          isPremium: subscription.isPremium,
          daysRemaining: subscription.daysRemaining
        }
      });
    } catch (error) {
      console.error('Error getting current subscription:', error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get available plans with real-time currency conversion
   */
  static async getAvailablePlans(req, res, next) {
    try {
      const userRole = req.user.role;
      const countryCode =
        req.query.countryCode || req.headers["x-country-code"] || "US";

      // Get plans with real-time pricing
      const plans =
        await subscriptionCompatibilityService.getAvailablePlansForCountry(
          userRole,
          countryCode
        );

      // Get supported currencies for this country
      const CurrencyService = require("../../../shared/services/currencyService");
      const supportedCurrencies =
        await CurrencyService.getAllSupportedCurrencies();

      res.json({
        success: true,
        message: "Available plans retrieved successfully",
        data: {
          userType: userRole,
          countryCode,
          currency: CurrencyService.getCurrencyForCountry(countryCode),
          timestamp: new Date(),
          plans,
          supportedCurrencies: {
            paystack: supportedCurrencies.paystack,
            flutterwave: supportedCurrencies.flutterwave,
            recommended: await CurrencyService.getBestProviderForCurrency(
              CurrencyService.getCurrencyForCountry(countryCode)
            ),
          },
        },
      });
    } catch (error) {
      console.error("Error getting available plans:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get subscription pricing for specific plan
   * GET /api/subscription/plans/:planType/:tier/pricing
   */
  static async getPlanPricing(req, res, next) {
    try {
      const { planType, tier } = req.params;
      const countryCode =
        req.query.countryCode || req.headers["x-country-code"] || "US";
      const currency = req.query.currency; // Optional override

      // Use the country-aware pricing method
      let pricing;

      if (currency) {
        // If specific currency requested, use the basic method then convert
        const planDefinition =
          subscriptionCompatibilityService.getSubscriptionPricing(
            planType,
            tier,
            currency
          );
        if (!planDefinition) {
          return res.status(404).json({
            success: false,
            error: "Plan not found",
          });
        }
        pricing = {
          ...planDefinition,
          countryCode,
          convertedAt: new Date(),
        };
      } else {
        // Use country-based pricing (this handles currency automatically)
        pricing =
          await subscriptionCompatibilityService.getSubscriptionPricingForCountry(
            planType,
            tier,
            countryCode
          );
        if (!pricing) {
          return res.status(404).json({
            success: false,
            error: "Plan not found",
          });
        }
      }

      res.json({
        success: true,
        message: "Plan pricing retrieved successfully",
        data: pricing,
      });
    } catch (error) {
      console.error("Error getting plan pricing:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Upgrade/Change subscription plan
   * POST /api/subscription/upgrade
   */
  static async upgradeSubscription(req, res, next) {
    try {
      const userId = req.user.sub;
      const { newTier, planType } = req.body;

      if (!newTier) {
        return res.status(400).json({
          success: false,
          error: "New tier is required",
        });
      }

      // Determine plan type if not provided
      const targetPlanType =
        planType || (req.user.role === "doctor" ? "doctor" : "patient");

      // Validate the plan exists
      const planDefinition = PLAN_DEFINITIONS[targetPlanType]?.[newTier];
      if (!planDefinition) {
        return res.status(400).json({
          success: false,
          error: `Invalid plan: ${targetPlanType}:${newTier}`,
        });
      }

      const updatedSubscription = await SubscriptionService.upgradeSubscription(
        userId,
        newTier,
        targetPlanType
      );

      res.json({
        success: true,
        message: "Subscription upgraded successfully",
        data: {
          id: updatedSubscription.id,
          previousTier: updatedSubscription.originalData?.tier,
          newTier: updatedSubscription.tier,
          planType: updatedSubscription.planType,
          price: updatedSubscription.priceInfo,
          commissionRate: updatedSubscription.commissionRate,
          features: updatedSubscription.featureList,
          limits: updatedSubscription.limits,
        },
      });
    } catch (error) {
      console.error("Error upgrading subscription:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Cancel subscription
   * POST /api/subscription/cancel
   */
  static async cancelSubscription(req, res, next) {
    try {
      const userId = req.user.sub;
      const { reason } = req.body;

      await SubscriptionService.cancelSubscription(userId, reason);

      res.json({
        success: true,
        message: "Subscription cancelled successfully",
        data: {
          cancelledAt: new Date(),
          reason: reason || null,
        },
      });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  // Update the controller method
  static async testSubscriptionUpgrade(req, res) {
    try {
      const { transactionId } = req.params;
      const { planType = "patient", tier = "premium" } = req.body;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID is required",
        });
      }

      // Call the service method with parameters
      const result = await SubscriptionService.testSubscriptionUpgrade(
        transactionId,
        planType,
        tier
      );

      res.status(200).json(result);
    } catch (error) {
      console.error("❌ Controller error in test upgrade:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to test subscription upgrade",
      });
    }
  }

  /**
   * Create subscription payment with dynamic currency
   */
  static async createSubscriptionPayment(req, res, next) {
    try {
      const userId = req.user.sub;
      const {
        planType,
        tier,
        countryCode = "US",
        paymentProvider = "flutterwave",
        enableAutoBilling = false,
        serviceType,
      } = req.body;

      if (!planType || !tier || !serviceType) {
        return res.status(400).json({
          success: false,
          error: "planType, tier, and serviceType are required",
        });
      }

      // Validate country code and get currency
      const CurrencyService = require("../../../shared/services/currencyService");
      const targetCurrency = CurrencyService.getCurrencyForCountry(countryCode);

      console.log(
        `💰 Creating payment for ${countryCode} -> ${targetCurrency}`
      );

      const result = await SubscriptionService.createSubscriptionPayment(
        userId,
        planType,
        tier,
        countryCode,
        paymentProvider,
        enableAutoBilling,
        serviceType
      );

      res.json({
        success: true,
        message: "Subscription payment created successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error creating subscription payment:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Upgrade subscription with saved payment method
   * POST /api/subscription/upgrade-with-saved-method
   */
  static async upgradeWithSavedMethod(req, res, next) {
    try {
      const userId = req.user.sub;
      const { planType, tier, paymentMethodId, currency = "USD" } = req.body;

      if (!planType || !tier || !paymentMethodId) {
        return res.status(400).json({
          success: false,
          error: "planType, tier, and paymentMethodId are required",
        });
      }

      const result =
        await SubscriptionService.processSubscriptionPaymentWithSavedMethod(
          userId,
          planType,
          tier,
          paymentMethodId,
          currency
        );

      if (result.success) {
        res.json({
          success: true,
          message:
            "Subscription upgraded successfully with saved payment method",
          data: {
            transactionId: result.transaction.id,
            planType,
            tier,
            upgradedAt: new Date(),
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Payment failed",
          details: result.paymentResult,
        });
      }
    } catch (error) {
      console.error("Error upgrading with saved method:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Process subscription upgrade after successful payment (webhook/callback)
   * POST /api/subscription/process-upgrade-after-payment
   */
  static async processUpgradeAfterPayment(req, res, next) {
    try {
      const { transactionId } = req.body;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: "transactionId is required",
        });
      }

      const result =
        await SubscriptionService.processSubscriptionUpgradeAfterPayment(
          transactionId
        );

      if (result.success) {
        res.json({
          success: true,
          message: "Subscription upgraded successfully after payment",
          data: {
            subscription: result.subscription,
            transactionId: result.transaction.id,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Failed to process upgrade after payment",
        });
      }
    } catch (error) {
      console.error("Error processing upgrade after payment:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get auto-billing settings
   * GET /api/subscription/auto-billing
   */
  static async getAutoBillingSettings(req, res, next) {
    try {
      const userId = req.user.sub;
      const settings =
        await subscriptionCompatibilityService.getAutoBillingSettings(userId);

      res.json({
        success: true,
        message: "Auto-billing settings retrieved successfully",
        data: settings,
      });
    } catch (error) {
      console.error("Error getting auto-billing settings:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Enable auto-billing
   * POST /api/subscription/auto-billing/enable
   */
  static async enableAutoBilling(req, res, next) {
    try {
      const userId = req.user.sub;
      const { paymentMethodId } = req.body;

      if (!paymentMethodId) {
        return res.status(400).json({
          success: false,
          error: "Payment method ID is required",
        });
      }

      await SubscriptionService.enableAutoBilling(userId, paymentMethodId);

      res.json({
        success: true,
        message: "Auto-billing enabled successfully",
        data: {
          autoBillingEnabled: true,
          paymentMethodId,
          enabledAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Error enabling auto-billing:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Disable auto-billing
   * POST /api/subscription/auto-billing/disable
   */
  static async disableAutoBilling(req, res, next) {
    try {
      const userId = req.user.sub;

      await SubscriptionService.disableAutoBilling(userId);

      res.json({
        success: true,
        message: "Auto-billing disabled successfully",
        data: {
          autoBillingEnabled: false,
          disabledAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Error disabling auto-billing:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Check feature access
   * GET /api/subscription/features/:featureName
   */
  static async checkFeatureAccess(req, res, next) {
    try {
      const userId = req.user.sub;
      const { featureName } = req.params;

      const hasAccess = await subscriptionCompatibilityService.hasFeatureAccess(
        userId,
        featureName
      );

      res.json({
        success: true,
        message: "Feature access checked successfully",
        data: {
          feature: featureName,
          hasAccess,
          userId,
        },
      });
    } catch (error) {
      console.error("Error checking feature access:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get user usage summary
   * GET /api/subscription/usage-summary
   */
  static async getUsageSummary(req, res, next) {
    try {
      const userId = req.user.sub;
      const summary = await UsageSummaryService.getUserUsageSummary(userId);

      res.json({
        success: true,
        message: "Usage summary retrieved successfully",
        data: summary,
      });
    } catch (error) {
      console.error("Error getting usage summary:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get quick usage status
   * GET /api/subscription/usage-status
   */
  static async getUsageStatus(req, res, next) {
    try {
      const userId = req.user.sub;
      const status = await UsageSummaryService.getQuickUsageStatus(userId);

      res.json({
        success: true,
        message: "Usage status retrieved successfully",
        data: status,
      });
    } catch (error) {
      console.error("Error getting usage status:", error);
      next(error);
    }
  }

  /**
   * Get usage limits and current usage
   * GET /api/subscription/usage
   */
  static async getUsageInfo(req, res, next) {
    try {
      const userId = req.user.sub;
      const subscription =
        await subscriptionCompatibilityService.getUserSubscription(userId);

      const usageInfo = {};
      const limits = subscription.limits || {};

      // Check each limit type
      for (const [limitType, limit] of Object.entries(limits)) {
        const usage = await subscriptionCompatibilityService.checkUsageLimit(
          userId,
          limitType
        );
        usageInfo[limitType] = usage;
      }

      res.json({
        success: true,
        message: "Usage information retrieved successfully",
        data: {
          subscriptionTier: subscription.tier,
          planType: subscription.planType,
          usage: usageInfo,
        },
      });
    } catch (error) {
      console.error("Error getting usage info:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get subscription analytics (Admin only)
   * GET /api/subscription/analytics
   */
  static async getSubscriptionAnalytics(req, res, next) {
    try {
      if (!["admin", "super_admin"].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      const analytics = await SubscriptionService.getSubscriptionAnalytics();

      res.json({
        success: true,
        message: "Subscription analytics retrieved successfully",
        data: analytics,
      });
    } catch (error) {
      console.error("Error getting subscription analytics:", error);
      if (error.message) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }
}

module.exports = SubscriptionController;
