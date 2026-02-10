// src/features/subscriptions/services/usageService.js
/**
 * UsageService - Central service for usage tracking and enforcement
 *
 * This is the SINGLE SOURCE OF TRUTH for all usage-related operations.
 * Use this service (or its middleware wrapper requireUsage) for all usage checks.
 *
 * USAGE TYPES:
 *   Patient:
 *   - aiChatbotResponses: AI chatbot messages per month
 *   - aiDiagnosticRequests: AI diagnostic requests per month
 *
 *   Doctor:
 *   - maxPatients: Maximum patient consultations per month
 *   - aiResponses: AI-assisted responses per month
 *
 * LIMIT VALUES:
 *   - null/-1: Unlimited (premium plans)
 *   - 0: Feature not available (blocked)
 *   - positive number: Monthly limit
 *
 * METHODS:
 *   canConsume(userId, feature, amount)        - Quick boolean check
 *   canConsumeDetailed(userId, feature, amount) - Detailed check with usage info
 *   consume(userId, feature, amount)           - Record usage after action
 *   consumeMultiple(userId, usageMap)          - Batch consumption
 *   getUsageSummary(userId)                    - Complete usage dashboard
 *   resetMonthlyUsage()                        - Cron job to reset counters
 *
 * ARCHITECTURE:
 *   Routes → requireUsage middleware → UsageService → SubscriptionRepository
 */

const subscriptionCompatibilityService = require("./subscriptionCompatibilityService");
const subscriptionRepository = require("../repositories/subscriptionRepository");
const { PLAN_DEFINITIONS, FAMILY_PLAN_CONFIG } = require("../utils/subscriptionConstants");
const cache = require("../../../shared/utils/cache");

// Feature display metadata
const FEATURE_META = {
  // Patient usage limits
  aiChatbotResponses: {
    displayName: "AI Chatbot Messages",
    description: "Monthly AI chatbot interactions",
    icon: "chat",
    category: "ai"
  },
  aiDiagnosticRequests: {
    displayName: "AI Diagnostic Requests",
    description: "AI-powered health diagnostic requests per month",
    icon: "diagnostic",
    category: "ai"
  },

  // Doctor usage limits
  maxPatients: {
    displayName: "Patient Consultations",
    description: "Maximum patients you can consult per month",
    icon: "patients",
    category: "consultations"
  },
  aiResponses: {
    displayName: "AI Responses",
    description: "AI-assisted responses for consultations",
    icon: "ai",
    category: "ai"
  },

  // Feature access (boolean features)
  chatOnly: {
    displayName: "Chat Consultations",
    description: "Text-based consultations with doctors",
    icon: "chat",
    category: "consultations"
  },
  voiceConsultation: {
    displayName: "Voice Consultations",
    description: "Voice call consultations with doctors",
    icon: "phone",
    category: "consultations"
  },
  videoConsultation: {
    displayName: "Video Consultations",
    description: "Video call consultations with doctors",
    icon: "video",
    category: "consultations"
  },
  generalEmergencySpecialists: {
    displayName: "General & Emergency Specialists",
    description: "Access to general and emergency doctors",
    icon: "doctor",
    category: "specialists"
  },
  allSpecialists: {
    displayName: "All Specialists",
    description: "Access to all medical specialists",
    icon: "specialists",
    category: "specialists"
  },
  labAccess: {
    displayName: "Lab Access",
    description: "Order and view lab tests",
    icon: "lab",
    category: "services"
  },
  pharmacy: {
    displayName: "Pharmacy Access",
    description: "Order medications from pharmacy",
    icon: "pharmacy",
    category: "services"
  },
  shopAccess: {
    displayName: "Shop Access",
    description: "Access to health products shop",
    icon: "shop",
    category: "services"
  },
  firstAidInstructions: {
    displayName: "First Aid Instructions",
    description: "Access to first aid guides and instructions",
    icon: "firstaid",
    category: "services"
  },
  familyPlan: {
    displayName: "Family Plan",
    description: "Add family members to your plan",
    icon: "family",
    category: "account"
  },
  standardSupport: {
    displayName: "Standard Support",
    description: "Email and chat support",
    icon: "support",
    category: "support"
  },
  prioritySupport: {
    displayName: "Priority Support",
    description: "Priority customer support",
    icon: "priority",
    category: "support"
  },
  earlyAccessFeatures: {
    displayName: "Early Access Features",
    description: "Access to new features before public release",
    icon: "early",
    category: "exclusive"
  },
  betaAccess: {
    displayName: "Beta Access",
    description: "Access to beta products and features",
    icon: "beta",
    category: "exclusive"
  },

  // Doctor features
  regularProfileListing: {
    displayName: "Regular Profile Listing",
    description: "Standard visibility in doctor search",
    icon: "profile",
    category: "visibility"
  },
  topProfileListing: {
    displayName: "Top Profile Listing",
    description: "Premium visibility in doctor search",
    icon: "top",
    category: "visibility"
  },
  unlimitedPatients: {
    displayName: "Unlimited Patients",
    description: "No limit on patient consultations",
    icon: "unlimited",
    category: "consultations"
  },
  unlimitedAI: {
    displayName: "Unlimited AI Responses",
    description: "No limit on AI-assisted responses",
    icon: "unlimited",
    category: "ai"
  }
};

class UsageService {
  // =============================================================================
  // USAGE CHECKING
  // =============================================================================

  /**
   * Check if user can consume a resource
   * @param {string} userId - User ID
   * @param {string} feature - Feature/usage type to check
   * @param {number} amount - Amount to consume (default: 1)
   * @returns {Promise<boolean>} True if within limits
   */
  async canConsume(userId, feature, amount = 1) {
    const sub = await subscriptionCompatibilityService.getUserSubscription(userId);
    const limit = this._getLimit(sub, feature);

    // null/-1 = unlimited
    if (limit === null || limit === -1) return true;

    // 0 = blocked
    if (limit === 0) return false;

    const used = this._getCurrentUsage(sub, feature);
    return used + amount <= limit;
  }

  /**
   * Check if user can consume with detailed response
   */
  async canConsumeDetailed(userId, feature, amount = 1) {
    const sub = await subscriptionCompatibilityService.getUserSubscription(userId);
    const limit = this._getLimit(sub, feature);
    const used = this._getCurrentUsage(sub, feature);
    const meta = FEATURE_META[feature] || { displayName: feature, description: "" };

    // Unlimited
    if (limit === null || limit === -1) {
      return {
        allowed: true,
        unlimited: true,
        feature,
        displayName: meta.displayName,
        tier: sub.tier,
        planType: sub.planType
      };
    }

    // Blocked (zero limit)
    if (limit === 0) {
      return {
        allowed: false,
        reason: "Feature not available in your plan",
        feature,
        displayName: meta.displayName,
        limit: 0,
        used: 0,
        tier: sub.tier,
        planType: sub.planType,
        upgradeRequired: true
      };
    }

    const wouldUse = used + amount;
    const allowed = wouldUse <= limit;

    return {
      allowed,
      feature,
      displayName: meta.displayName,
      used,
      limit,
      requested: amount,
      remaining: Math.max(0, limit - used),
      percentageUsed: Math.round((used / limit) * 100),
      tier: sub.tier,
      planType: sub.planType,
      ...(allowed ? {} : {
        reason: "Monthly limit exceeded",
        upgradeRequired: true
      })
    };
  }

  // =============================================================================
  // USAGE CONSUMPTION
  // =============================================================================

  /**
   * Consume a resource (increment usage counter)
   */
  async consume(userId, feature, amount = 1) {
    const sub = await subscriptionCompatibilityService.getUserSubscription(userId);

    if (!sub.id) {
      console.warn(`Cannot track usage for user ${userId}: no subscription ID`);
      return { success: false, reason: "No subscription found" };
    }

    const used = this._getCurrentUsage(sub, feature);

    await subscriptionRepository.updateUsage(sub.id, feature, amount);

    // Clear cache to ensure fresh data on next request
    await this._clearUserCache(userId);

    console.log(`Usage tracked: ${feature} ${used} -> ${used + amount} for user ${userId}`);

    return {
      success: true,
      feature,
      previousCount: used,
      newCount: used + amount,
      limit: this._getLimit(sub, feature),
      remaining: this._calculateRemaining(sub, feature, used + amount)
    };
  }

  /**
   * Consume multiple resources at once
   */
  async consumeMultiple(userId, usageMap) {
    const results = {};
    for (const [feature, amount] of Object.entries(usageMap)) {
      results[feature] = await this.consume(userId, feature, amount);
    }
    return results;
  }

  // =============================================================================
  // COMPREHENSIVE USAGE SUMMARY
  // =============================================================================

  /**
   * Get comprehensive usage summary with all features and limits
   * This is the single source of truth for subscription usage
   *
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Complete usage summary
   */
  async getUsageSummary(userId) {
    const sub = await subscriptionCompatibilityService.getUserSubscription(userId);
    const planDef = PLAN_DEFINITIONS[sub.planType]?.[sub.tier] || {};
    const familyConfig = FAMILY_PLAN_CONFIG[sub.tier] || { total: 1, description: "Individual only" };

    const limits = sub.monthlyLimits || {};
    const usage = sub.currentUsage || {};
    const features = sub.features || planDef.features || {};

    // Build usage limits summary
    const usageLimits = {};
    let totalLimits = 0;
    let limitsUsed = 0;
    let limitsNearLimit = 0;
    let limitsExceeded = 0;

    for (const [key, limit] of Object.entries(limits)) {
      const used = usage[key] || 0;
      const meta = FEATURE_META[key] || { displayName: key, description: "", icon: "default", category: "other" };
      const isUnlimited = limit === -1;
      const isBlocked = limit === 0;

      let status = "ok";
      let percentage = 0;
      let remaining = isUnlimited ? "Unlimited" : Math.max(0, limit - used);

      if (!isUnlimited && !isBlocked && limit > 0) {
        percentage = Math.round((used / limit) * 100);
        if (percentage >= 100) {
          status = "exceeded";
          limitsExceeded++;
        } else if (percentage >= 80) {
          status = "warning";
          limitsNearLimit++;
        }
        limitsUsed++;
      }

      totalLimits++;

      usageLimits[key] = {
        displayName: meta.displayName,
        description: meta.description,
        icon: meta.icon,
        category: meta.category,
        used,
        limit: isUnlimited ? -1 : limit,
        limitDisplay: isUnlimited ? "Unlimited" : (isBlocked ? "Not Available" : limit),
        remaining,
        percentage,
        isUnlimited,
        isBlocked,
        status
      };
    }

    // Build feature access summary
    const featureAccess = {};
    const enabledFeatures = [];
    const disabledFeatures = [];

    for (const [key, enabled] of Object.entries(features)) {
      const meta = FEATURE_META[key] || { displayName: key, description: "", icon: "default", category: "other" };

      featureAccess[key] = {
        displayName: meta.displayName,
        description: meta.description,
        icon: meta.icon,
        category: meta.category,
        enabled: !!enabled
      };

      if (enabled) {
        enabledFeatures.push(meta.displayName);
      } else {
        disabledFeatures.push(meta.displayName);
      }
    }

    // Calculate next reset date (1st of next month)
    const now = new Date();
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysUntilReset = Math.ceil((nextReset - now) / (1000 * 60 * 60 * 24));

    // Overall health status
    let healthStatus = "healthy";
    let healthMessage = "All usage within limits";

    if (limitsExceeded > 0) {
      healthStatus = "critical";
      healthMessage = `${limitsExceeded} limit(s) exceeded - upgrade recommended`;
    } else if (limitsNearLimit > 0) {
      healthStatus = "warning";
      healthMessage = `${limitsNearLimit} limit(s) approaching capacity`;
    }

    return {
      // Subscription info
      subscription: {
        id: sub.id,
        tier: sub.tier,
        tierDisplay: planDef.name || sub.tier,
        planType: sub.planType,
        status: sub.status,
        isActive: sub.isActive,
        isPremium: sub.isPremium,
        startDate: sub.startDate,
        endDate: sub.endDate,
        daysRemaining: sub.daysRemaining,
        autoRenew: sub.autoRenew
      },

      // Usage limits (countable features)
      usageLimits,

      // Feature access (boolean features)
      featureAccess,

      // Family plan info
      familyPlan: {
        enabled: features.familyPlan || false,
        currentMembers: sub.familyMembers || 1,
        maxMembers: familyConfig.total === -1 ? "Unlimited" : familyConfig.total,
        description: familyConfig.description,
        adults: familyConfig.adults,
        children: familyConfig.children
      },

      // Commission (for doctors only)
      commission: sub.planType === "doctor" ? {
        rate: sub.commissionRate || planDef.commissionRate || 30,
        description: `${sub.commissionRate || planDef.commissionRate || 30}% per consultation`
      } : null,

      // Summary stats
      stats: {
        totalLimits,
        limitsUsed,
        limitsNearLimit,
        limitsExceeded,
        enabledFeaturesCount: enabledFeatures.length,
        disabledFeaturesCount: disabledFeatures.length
      },

      // Health status
      health: {
        status: healthStatus,
        message: healthMessage,
        needsAttention: healthStatus !== "healthy"
      },

      // Quick feature lists
      enabledFeatures,
      disabledFeatures,

      // Reset info
      resetInfo: {
        nextResetDate: nextReset.toISOString(),
        daysUntilReset,
        resetMessage: `Usage resets in ${daysUntilReset} day${daysUntilReset !== 1 ? 's' : ''}`
      },

      // Metadata
      lastUpdated: new Date().toISOString(),
      cachedAt: sub.cachedAt || null
    };
  }

  // =============================================================================
  // USAGE RESET (for cron jobs)
  // =============================================================================

  /**
   * Reset monthly usage for all active subscriptions
   */
  async resetMonthlyUsage() {
    console.log("Resetting monthly usage counters...");

    const result = await subscriptionRepository.resetMonthlyUsage();

    console.log(`Monthly usage reset completed`);
    return { success: true };
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  /**
   * Get limit for a feature from subscription
   * @returns {number|null} null = unlimited, 0 = blocked, positive = limit
   */
  _getLimit(subscription, feature) {
    const limit = subscription.monthlyLimits?.[feature];
    if (limit === undefined || limit === -1) return null; // unlimited
    return limit;
  }

  /**
   * Get current usage for a feature from subscription
   */
  _getCurrentUsage(subscription, feature) {
    return subscription.currentUsage?.[feature] || 0;
  }

  _calculateRemaining(subscription, feature, currentUsed) {
    const limit = this._getLimit(subscription, feature);
    if (limit === null) return "Unlimited";
    return Math.max(0, limit - currentUsed);
  }

  async _clearUserCache(userId) {
    try {
      await Promise.all([
        cache.del(`user:${userId}:subscription`),
        cache.del(`user:${userId}:subscription:basic`)
      ]);
    } catch (error) {
      console.warn("Cache clear failed:", error.message);
    }
  }
}

module.exports = new UsageService();
