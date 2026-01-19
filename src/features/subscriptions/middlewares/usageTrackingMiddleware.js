// src/middleware/usageTrackingMiddleware.js

const subscriptionCompatibilityService = require("../services/subscriptionCompatibilityService");
const subscriptionRepository = require("../repositories/subscriptionRepository");
const cache = require("../../../shared/utils/cache");

class UsageTrackingMiddleware {
  /**
   * Track usage for different activity types
   * Usage Types:
   * - aiChatbotResponses: AI chatbot interactions
   * - aiDiagnosticRequests: AI diagnostic requests
   * - consultations: Video/voice consultations
   * - maxPatients: Doctor patient limit (for doctors)
   * - aiResponses: Doctor AI responses (for doctors)
   */
  static async trackUsage(userId, usageType, increment = 1) {
    try {
      console.log(
        `📊 Tracking usage: ${usageType} +${increment} for user ${userId}`
      );

      // Get user's subscription
      const subscription =
        await subscriptionCompatibilityService.getUserSubscriptionBasic(userId);

      if (!subscription || !subscription.id) {
        console.log("⚠️ No subscription found, cannot track usage");
        return { success: false, reason: "No subscription found" };
      }

      // Get current usage
      const currentUsage = subscription.currentUsage || {};
      const monthlyLimits = subscription.monthlyLimits || {};

      // Check if this usage type has a limit
      const limit = monthlyLimits[usageType];
      if (limit === undefined || limit === null || limit === -1) {
        console.log(`✅ ${usageType} has no limit, allowing usage`);
        return { success: true, unlimited: true };
      }

      // Handle zero limit (not allowed)
      if (limit === 0) {
        console.log(`❌ ${usageType} has zero limit, blocking usage`);
        return {
          success: false,
          limitExceeded: true,
          current: currentUsage[usageType] || 0,
          limit: 0,
          attempted: increment,
        };
      }

      // Calculate new usage
      const currentCount = currentUsage[usageType] || 0;
      const newCount = currentCount + increment;

      // Check if would exceed limit
      if (newCount > limit) {
        console.log(
          `❌ Usage limit exceeded: ${newCount} > ${limit} for ${usageType}`
        );
        return {
          success: false,
          limitExceeded: true,
          current: currentCount,
          limit: limit,
          attempted: newCount,
        };
      }

      // Update usage in database
      await this.updateSubscriptionUsage(subscription.id, usageType, increment);

      // Clear cache so next request gets fresh data
      await this.clearSubscriptionCache(userId);

      console.log(
        `✅ Usage tracked: ${usageType} ${currentCount} -> ${newCount} (limit: ${limit})`
      );

      return {
        success: true,
        usageType,
        previousCount: currentCount,
        newCount: newCount,
        limit: limit,
        remaining: limit - newCount,
        percentageUsed: Math.round((newCount / limit) * 100),
      };
    } catch (error) {
      console.error("❌ Error tracking usage:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user can perform an action (before doing it)
   */
  static async canPerformAction(userId, usageType, requestedAmount = 1) {
    try {
      console.log(
        `🔍 Checking if user ${userId} can perform ${usageType} (${requestedAmount})`
      );

      const subscription =
        await subscriptionCompatibilityService.getUserSubscriptionBasic(userId);

      if (!subscription) {
        return { allowed: false, reason: "No subscription found" };
      }

      const currentUsage = subscription.currentUsage || {};
      const monthlyLimits = subscription.monthlyLimits || {};

      const limit = monthlyLimits[usageType];

      // No limit = unlimited usage
      if (limit === undefined || limit === null || limit === -1) {
        return {
          allowed: true,
          unlimited: true,
          usageType,
          subscription: subscription.tier,
        };
      }

      // Zero limit = not allowed
      if (limit === 0) {
        return {
          allowed: false,
          limitExceeded: true,
          current: currentUsage[usageType] || 0,
          limit: 0,
          requested: requestedAmount,
          usageType,
          subscription: subscription.tier,
        };
      }

      const currentCount = currentUsage[usageType] || 0;
      const wouldUse = currentCount + requestedAmount;

      if (wouldUse > limit) {
        return {
          allowed: false,
          limitExceeded: true,
          current: currentCount,
          limit: limit,
          requested: requestedAmount,
          wouldTotal: wouldUse,
          remaining: Math.max(0, limit - currentCount),
          usageType,
          subscription: subscription.tier,
        };
      }

      return {
        allowed: true,
        current: currentCount,
        limit: limit,
        remaining: limit - wouldUse,
        percentageUsed: Math.round((wouldUse / limit) * 100),
        usageType,
        subscription: subscription.tier,
      };
    } catch (error) {
      console.error("❌ Error checking action permission:", error);
      return { allowed: false, error: error.message };
    }
  }

  /**
   * Express middleware to check usage before API calls
   * Usage: app.use('/api/ai-chat', usageMiddleware('aiChatbotResponses'))
   */
  static usageMiddleware(usageType, incrementAmount = 1) {
    return async (req, res, next) => {
      try {
        const userId = req.user?.sub || req.user?.id;

        if (!userId) {
          return res.status(401).json({
            success: false,
            error: "User not authenticated",
          });
        }

        // Check if user can perform this action
        const canPerform = await this.canPerformAction(
          userId,
          usageType,
          incrementAmount
        );

        if (!canPerform.allowed) {
          return res.status(429).json({
            success: false,
            error: "Usage limit exceeded",
            details: {
              usageType,
              current: canPerform.current,
              limit: canPerform.limit,
              subscription: canPerform.subscription,
              upgradeRequired: true,
            },
          });
        }

        // Store usage info in request for later tracking
        req.usageTracking = {
          userId,
          usageType,
          increment: incrementAmount,
          canPerform,
        };

        next();
      } catch (error) {
        console.error("❌ Usage middleware error:", error);
        return res.status(500).json({
          success: false,
          error: "Usage tracking failed",
        });
      }
    };
  }

  /**
   * Express middleware to track usage AFTER successful API calls
   * Call this after your main logic succeeds
   */
  static async trackUsageAfterSuccess(req, res, next) {
    try {
      if (req.usageTracking) {
        const { userId, usageType, increment } = req.usageTracking;

        // Track the usage (don't await to avoid slowing response)
        this.trackUsage(userId, usageType, increment).catch((error) => {
          console.error("❌ Post-success usage tracking failed:", error);
        });
      }

      next();
    } catch (error) {
      console.error("❌ Post-success tracking middleware error:", error);
      next(); // Don't fail the request for tracking issues
    }
  }

  /**
   * Update subscription usage in database with atomic operation
   */
  static async updateSubscriptionUsage(subscriptionId, usageType, increment) {
    try {
      // Use the repository's updateUsage method
      const result = await subscriptionRepository.updateUsage(
        subscriptionId,
        usageType,
        increment
      );

      if (result) {
        // Fetch updated subscription to return current usage
        const subscription = await subscriptionRepository.findById(subscriptionId);
        return subscription?.currentUsage || {};
      }

      return result;
    } catch (error) {
      console.error("❌ Error updating subscription usage:", error);
      throw error;
    }
  }

  /**
   * Clear subscription cache after usage update
   */
  static async clearSubscriptionCache(userId) {
    try {
      await Promise.all([
        cache.del(`user:${userId}:subscription`),
        cache.del(`user:${userId}:subscription:basic`),
      ]);
    } catch (error) {
      console.warn("Cache clear failed:", error.message);
    }
  }

  /**
   * Bulk track multiple usage types at once
   */
  static async trackMultipleUsage(userId, usageMap) {
    try {
      const results = {};

      for (const [usageType, increment] of Object.entries(usageMap)) {
        results[usageType] = await this.trackUsage(
          userId,
          usageType,
          increment
        );
      }

      return results;
    } catch (error) {
      console.error("❌ Error tracking multiple usage:", error);
      throw error;
    }
  }

  /**
   * Reset monthly usage counters (called by cron job)
   */
  static async resetMonthlyUsage() {
    try {
      console.log("🔄 Resetting monthly usage counters...");

      // Get all active subscriptions
      const subscriptions =
        await subscriptionRepository.findActiveSubscriptions();

      let resetCount = 0;
      for (const subscription of subscriptions) {
        try {
          await subscriptionRepository.update(subscription.id, {
            currentUsage: {}, // Reset all usage to 0
            lastResetDate: new Date(),
            updatedAt: new Date(),
          });

          // Clear cache for this user
          if (subscription.userId) {
            await this.clearSubscriptionCache(subscription.userId);
          }

          resetCount++;
        } catch (error) {
          console.error(
            `❌ Failed to reset usage for subscription ${subscription.id}:`,
            error
          );
        }
      }

      console.log(`✅ Reset monthly usage for ${resetCount} subscriptions`);
      return { success: true, resetCount };
    } catch (error) {
      console.error("❌ Error resetting monthly usage:", error);
      throw error;
    }
  }

  /**
   * Get usage summary for user
   */
  static async getUsageSummary(userId) {
    try {
      const subscription =
        await subscriptionCompatibilityService.getUserSubscriptionBasic(userId);

      if (!subscription) {
        return { error: "No subscription found" };
      }

      const currentUsage = subscription.currentUsage || {};
      const monthlyLimits = subscription.monthlyLimits || {};
      const summary = {};

      for (const [limitType, limit] of Object.entries(monthlyLimits)) {
        const used = currentUsage[limitType] || 0;

        summary[limitType] = {
          used,
          limit: limit === -1 ? "Unlimited" : limit,
          remaining: limit === -1 ? "Unlimited" : Math.max(0, limit - used),
          percentage: limit === -1 ? 0 : Math.round((used / limit) * 100),
          isOverLimit: limit !== -1 && used > limit,
          isNearLimit: limit !== -1 && used / limit >= 0.8,
        };
      }

      return {
        subscription: {
          tier: subscription.tier,
          planType: subscription.planType,
          status: subscription.status,
        },
        usage: summary,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error("❌ Error getting usage summary:", error);
      throw error;
    }
  }
}

module.exports = UsageTrackingMiddleware;
