// src/services/usageSummaryService.js

const subscriptionCompatibilityService = require("./subscriptionCompatibilityService");
const cache = require("../../../shared/utils/cache");

class UsageSummaryService {
  /**
   * Get comprehensive usage summary for user
   */
  static async getUserUsageSummary(userId) {
    try {
      console.log(`📊 Getting usage summary for user: ${userId}`);

      // Check cache first (cache for 2 minutes since usage changes frequently)
      const cacheKey = `user:${userId}:usage_summary`;
      try {
        const cached = await cache.get(cacheKey);
        if (cached) {
          console.log("✅ Found cached usage summary");
          return JSON.parse(cached);
        }
      } catch (cacheError) {
        console.warn("Cache get failed:", cacheError.message);
      }

      // Get user subscription
      const subscription =
        await subscriptionCompatibilityService.getUserSubscriptionBasic(userId);

      if (!subscription) {
        throw new Error("No subscription found for user");
      }

      const currentUsage = subscription.currentUsage || {};
      const monthlyLimits = subscription.monthlyLimits || {};

      // Build comprehensive summary
      const summary = {
        // Subscription info
        subscription: {
          tier: subscription.tier,
          planType: subscription.planType,
          planName: subscription.planDefinition?.name || subscription.tier,
          status: subscription.status,
          isActive: subscription.isActive,
          isPremium: subscription.isPremium,
          daysRemaining: subscription.daysRemaining,
        },

        // Usage breakdown
        usage: {},

        // Overall stats
        stats: {
          totalLimits: 0,
          limitsWithUsage: 0,
          overLimitCount: 0,
          nearLimitCount: 0,
          unlimitedFeatures: 0,
        },

        // Quick status
        status: {
          healthy: true,
          warnings: [],
          errors: [],
        },

        // Metadata
        lastUpdated: new Date(),
        resetDate: this.getNextResetDate(),
      };

      // Process each limit type
      for (const [limitType, limit] of Object.entries(monthlyLimits)) {
        const used = currentUsage[limitType] || 0;
        const isUnlimited = limit === -1;

        summary.usage[limitType] = {
          // Basic numbers
          used,
          limit: isUnlimited ? "Unlimited" : limit,
          remaining: isUnlimited ? "Unlimited" : Math.max(0, limit - used),

          // Percentages
          percentage: isUnlimited ? 0 : Math.round((used / limit) * 100),

          // Status flags
          isUnlimited,
          isOverLimit: !isUnlimited && used > limit,
          isNearLimit: !isUnlimited && used / limit >= 0.8,
          isWarning: !isUnlimited && used / limit >= 0.9,

          // Display info
          displayName: this.getDisplayName(limitType),
          description: this.getUsageDescription(limitType),
          icon: this.getUsageIcon(limitType),
          color: this.getUsageColor(used, limit, isUnlimited),
        };

        // Update stats
        summary.stats.totalLimits++;
        if (used > 0) summary.stats.limitsWithUsage++;
        if (!isUnlimited && used > limit) summary.stats.overLimitCount++;
        if (!isUnlimited && used / limit >= 0.8) summary.stats.nearLimitCount++;
        if (isUnlimited) summary.stats.unlimitedFeatures++;
      }

      // Determine overall health status
      summary.status = this.calculateHealthStatus(summary.usage, summary.stats);

      // Cache for 2 minutes
      try {
        await cache.set(cacheKey, JSON.stringify(summary), 120);
      } catch (cacheError) {
        console.warn("Cache set failed:", cacheError.message);
      }

      console.log(`✅ Generated usage summary for user ${userId}`);
      return summary;
    } catch (error) {
      console.error("❌ Error getting usage summary:", error);
      throw error;
    }
  }

  /**
   * Get quick usage status (lightweight version)
   */
  static async getQuickUsageStatus(userId) {
    try {
      const subscription =
        await subscriptionCompatibilityService.getUserSubscriptionBasic(userId);

      if (!subscription) {
        return { error: "No subscription found" };
      }

      const currentUsage = subscription.currentUsage || {};
      const monthlyLimits = subscription.monthlyLimits || {};

      let overLimit = 0;
      let nearLimit = 0;
      let totalLimits = 0;

      for (const [limitType, limit] of Object.entries(monthlyLimits)) {
        if (limit === -1) continue; // Skip unlimited

        totalLimits++;
        const used = currentUsage[limitType] || 0;
        const percentage = used / limit;

        if (used > limit) overLimit++;
        else if (percentage >= 0.8) nearLimit++;
      }

      return {
        tier: subscription.tier,
        planType: subscription.planType,
        status: subscription.status,
        overLimit,
        nearLimit,
        totalLimits,
        healthy: overLimit === 0,
        needsAttention: overLimit > 0 || nearLimit > 0,
      };
    } catch (error) {
      console.error("❌ Error getting quick usage status:", error);
      return { error: error.message };
    }
  }

  /**
   * Get usage for specific feature
   */
  static async getFeatureUsage(userId, featureType) {
    try {
      const subscription =
        await subscriptionCompatibilityService.getUserSubscriptionBasic(userId);

      if (!subscription) {
        throw new Error("No subscription found");
      }

      const currentUsage = subscription.currentUsage || {};
      const monthlyLimits = subscription.monthlyLimits || {};

      const used = currentUsage[featureType] || 0;
      const limit = monthlyLimits[featureType];
      const isUnlimited = limit === -1;

      return {
        featureType,
        displayName: this.getDisplayName(featureType),
        used,
        limit: isUnlimited ? "Unlimited" : limit,
        remaining: isUnlimited ? "Unlimited" : Math.max(0, limit - used),
        percentage: isUnlimited ? 0 : Math.round((used / limit) * 100),
        isUnlimited,
        canUse: isUnlimited || used < limit,
        isOverLimit: !isUnlimited && used > limit,
        isNearLimit: !isUnlimited && used / limit >= 0.8,
      };
    } catch (error) {
      console.error("❌ Error getting feature usage:", error);
      throw error;
    }
  }

  /**
   * Get usage trends (if you track historical data)
   */
  static async getUsageTrends(userId, days = 7) {
    // This would require storing historical usage data
    // For now, return placeholder structure
    return {
      period: `${days} days`,
      trends: {
        // Could show daily usage patterns
        // aiChatbotResponses: [2, 5, 3, 8, 6, 4, 7],
        // aiDiagnosticRequests: [1, 2, 0, 3, 1, 2, 1]
      },
      message: "Historical usage tracking not implemented yet",
    };
  }

  // Helper methods for display formatting

  static getDisplayName(limitType) {
    const names = {
      aiChatbotResponses: "AI Chat Messages",
      aiDiagnosticRequests: "AI Diagnostic Requests",
      consultations: "Consultations",
      maxPatients: "Max Patients",
      aiResponses: "AI Responses",
    };
    return (
      names[limitType] ||
      limitType
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
    );
  }

  static getUsageDescription(limitType) {
    const descriptions = {
      aiChatbotResponses: "Monthly AI chatbot interactions",
      aiDiagnosticRequests: "AI-powered diagnostic requests per month",
      consultations: "Video/voice consultation sessions",
      maxPatients: "Maximum patients you can treat",
      aiResponses: "AI assistance responses for doctors",
    };
    return descriptions[limitType] || "Monthly usage limit";
  }

  static getUsageIcon(limitType) {
    const icons = {
      aiChatbotResponses: "💬",
      aiDiagnosticRequests: "🔬",
      consultations: "📹",
      maxPatients: "👥",
      aiResponses: "🤖",
    };
    return icons[limitType] || "📊";
  }

  static getUsageColor(used, limit, isUnlimited) {
    if (isUnlimited) return "green";

    const percentage = used / limit;
    if (used > limit) return "red";
    if (percentage >= 0.9) return "orange";
    if (percentage >= 0.8) return "yellow";
    return "green";
  }

  static calculateHealthStatus(usage, stats) {
    const status = {
      healthy: true,
      warnings: [],
      errors: [],
    };

    // Check for over-limit usage
    if (stats.overLimitCount > 0) {
      status.healthy = false;
      status.errors.push(`${stats.overLimitCount} feature(s) over limit`);
    }

    // Check for near-limit usage
    if (stats.nearLimitCount > 0) {
      status.warnings.push(
        `${stats.nearLimitCount} feature(s) approaching limit`
      );
    }

    // Add specific feature warnings
    for (const [featureType, data] of Object.entries(usage)) {
      if (data.isOverLimit) {
        status.errors.push(
          `${data.displayName}: ${data.used}/${data.limit} (over limit)`
        );
      } else if (data.isWarning) {
        status.warnings.push(`${data.displayName}: ${data.percentage}% used`);
      }
    }

    return status;
  }

  static getNextResetDate() {
    // Assuming monthly reset on the 1st of each month
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  }

  /**
   * Clear usage summary cache (call after usage updates)
   */
  static async clearUsageSummaryCache(userId) {
    try {
      await cache.del(`user:${userId}:usage_summary`);
    } catch (error) {
      console.warn("Failed to clear usage summary cache:", error.message);
    }
  }
}

module.exports = UsageSummaryService;
