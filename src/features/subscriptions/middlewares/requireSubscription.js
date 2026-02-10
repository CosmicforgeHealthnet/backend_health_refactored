// src/features/subscriptions/middlewares/requireSubscription.js
/**
 * =============================================================================
 * SUBSCRIPTION TIER MIDDLEWARE
 * =============================================================================
 *
 * PURPOSE:
 * Checks user's subscription tier/status and attaches subscription data to request.
 * Use this when you need to restrict access based on subscription level.
 *
 * WHAT IT DOES:
 * 1. Gets user's current subscription from database (with caching)
 * 2. Attaches subscription data to req.subscription for downstream use
 * 3. Optionally blocks access if tier requirements not met
 *
 * SUBSCRIPTION DATA ATTACHED (req.subscription):
 * {
 *   id: "uuid",                    // Subscription ID
 *   tier: "free|basic|premium",    // Current tier
 *   planType: "patient|doctor",    // User type
 *   status: "active|expired",      // Subscription status
 *   features: { ... },             // Boolean feature flags
 *   monthlyLimits: { ... },        // Usage limits
 *   currentUsage: { ... },         // Current usage counts
 *   isActive: true,                // Is subscription active
 *   isPremium: false,              // Is non-free tier
 *   daysRemaining: 25              // Days until expiry
 * }
 *
 * =============================================================================
 * AVAILABLE METHODS
 * =============================================================================
 *
 * 1. requireSubscription (default)
 *    - Attaches subscription to request
 *    - Always succeeds (falls back to free tier)
 *    - Use when you need subscription data but don't want to block
 *
 * 2. requireSubscription.premium
 *    - Requires non-free subscription
 *    - Returns 403 if user is on free tier
 *
 * 3. requireSubscription.tier(['tier1', 'tier2'])
 *    - Requires specific tier(s)
 *    - Returns 403 if user's tier not in allowed list
 *
 * 4. requireSubscription.active
 *    - Requires active (non-expired) subscription
 *    - Returns 403 if subscription expired
 *
 * =============================================================================
 * USAGE EXAMPLES
 * =============================================================================
 *
 * // Just attach subscription data (never blocks)
 * router.get('/dashboard',
 *   authenticateJWT,
 *   requireSubscription,
 *   dashboardController.get
 * );
 *
 * // Require paid subscription
 * router.get('/premium-content',
 *   authenticateJWT,
 *   requireSubscription.premium,
 *   premiumController.get
 * );
 *
 * // Require specific tier(s)
 * router.get('/gold-features',
 *   authenticateJWT,
 *   requireSubscription.tier(['premium', 'gold_elite']),
 *   goldController.get
 * );
 *
 * // Access subscription data in controller
 * async function myController(req, res) {
 *   const { tier, features, monthlyLimits } = req.subscription;
 *   // Use subscription data...
 * }
 *
 * =============================================================================
 * RESPONSE CODES
 * =============================================================================
 *
 * 200 - Success (subscription attached, access granted)
 * 401 - No authentication (user not logged in)
 * 403 - Subscription requirement not met (wrong tier, expired, etc.)
 * 500 - Server error during subscription check
 *
 * =============================================================================
 */

const subscriptionCompatibilityService = require("../services/subscriptionCompatibilityService");

/**
 * Get user ID from request object
 * Supports both req.user.sub (JWT) and req.user.id formats
 */
function getUserId(req) {
  return req.user?.sub || req.user?.id;
}

/**
 * Default middleware - attaches subscription, never blocks
 * Falls back to free tier if no subscription found
 */
async function requireSubscription(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "AUTH_REQUIRED"
      });
    }

    // Get subscription (automatically falls back to free tier if none exists)
    const subscription = await subscriptionCompatibilityService.getUserSubscription(userId);

    // Attach to request for downstream use
    req.subscription = subscription;

    next();
  } catch (error) {
    console.error("Subscription middleware error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to verify subscription",
      code: "SUBSCRIPTION_CHECK_FAILED"
    });
  }
}

/**
 * Require premium (non-free) subscription
 * Blocks free tier users
 */
requireSubscription.premium = async function(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "AUTH_REQUIRED"
      });
    }

    const subscription = await subscriptionCompatibilityService.getUserSubscription(userId);

    // Check if user is on a paid plan
    if (!subscription.isPremium) {
      return res.status(403).json({
        success: false,
        message: "Premium subscription required",
        code: "PREMIUM_REQUIRED",
        details: {
          currentTier: subscription.tier,
          planType: subscription.planType,
          upgradeRequired: true
        },
        upgradeUrl: "/dashboard/settings/billing/subscription-plans"
      });
    }

    req.subscription = subscription;
    next();
  } catch (error) {
    console.error("Premium subscription check error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to verify subscription",
      code: "SUBSCRIPTION_CHECK_FAILED"
    });
  }
};

/**
 * Require specific tier(s)
 * @param {string[]} allowedTiers - Array of allowed tier names
 *
 * PATIENT TIERS: free, basic, standard, medium, premium, gold_elite
 * DOCTOR TIERS: free, basic, professional, premium
 */
requireSubscription.tier = function(allowedTiers) {
  return async function(req, res, next) {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          code: "AUTH_REQUIRED"
        });
      }

      const subscription = await subscriptionCompatibilityService.getUserSubscription(userId);

      // Check if user's tier is in allowed list
      if (!allowedTiers.includes(subscription.tier)) {
        return res.status(403).json({
          success: false,
          message: `Subscription tier required: ${allowedTiers.join(" or ")}`,
          code: "TIER_REQUIRED",
          details: {
            requiredTiers: allowedTiers,
            currentTier: subscription.tier,
            planType: subscription.planType,
            upgradeRequired: true
          },
          upgradeUrl: "/dashboard/settings/billing/subscription-plans"
        });
      }

      req.subscription = subscription;
      next();
    } catch (error) {
      console.error("Tier subscription check error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to verify subscription",
        code: "SUBSCRIPTION_CHECK_FAILED"
      });
    }
  };
};

/**
 * Require active (non-expired) subscription
 * Blocks users with expired subscriptions
 */
requireSubscription.active = async function(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "AUTH_REQUIRED"
      });
    }

    const subscription = await subscriptionCompatibilityService.getUserSubscription(userId);

    // Check if subscription is active
    if (!subscription.isActive) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required",
        code: "ACTIVE_SUBSCRIPTION_REQUIRED",
        details: {
          status: subscription.status,
          tier: subscription.tier,
          expiredAt: subscription.endDate
        },
        upgradeUrl: "/dashboard/settings/billing/subscription-plans"
      });
    }

    req.subscription = subscription;
    next();
  } catch (error) {
    console.error("Active subscription check error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to verify subscription",
      code: "SUBSCRIPTION_CHECK_FAILED"
    });
  }
};

module.exports = requireSubscription;
