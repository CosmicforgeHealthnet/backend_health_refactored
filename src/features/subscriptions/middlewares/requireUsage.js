// src/features/subscriptions/middlewares/requireUsage.js
/**
 * =============================================================================
 * USAGE LIMIT MIDDLEWARE
 * =============================================================================
 *
 * PURPOSE:
 * Enforces monthly usage limits based on user's subscription plan.
 * Checks limits BEFORE request, tracks usage AFTER successful response.
 *
 * WHAT IT DOES:
 * 1. Checks if user has remaining quota for the requested feature
 * 2. Blocks request with 429 if limit exceeded
 * 3. Tracks usage after successful response (auto or manual)
 *
 * =============================================================================
 * USAGE TYPES
 * =============================================================================
 *
 * PATIENT USAGE TYPES:
 * | Type                  | Description                    | Free | Basic | Standard | Premium |
 * |-----------------------|--------------------------------|------|-------|----------|---------|
 * | aiChatbotResponses    | AI chatbot messages per month  | 10   | 30    | 80       | Unlimited |
 * | aiDiagnosticRequests  | AI diagnostic requests         | 0    | 20    | 50       | Unlimited |
 *
 * DOCTOR USAGE TYPES:
 * | Type         | Description                      | Free | Basic | Professional | Premium   |
 * |--------------|----------------------------------|------|-------|--------------|-----------|
 * | maxPatients  | Patient consultations per month  | 10   | 40    | 100          | Unlimited |
 * | aiResponses  | AI-assisted responses per month  | 50   | 200   | 400          | Unlimited |
 *
 * LIMIT VALUES:
 * - Positive number: Monthly limit (e.g., 50)
 * - -1 or null: Unlimited
 * - 0: Feature not available (blocked)
 *
 * =============================================================================
 * AVAILABLE METHODS
 * =============================================================================
 *
 * 1. requireUsage(usageType, amount)
 *    - Checks limit before request
 *    - Stores tracking info in req.usageTracking
 *    - Use with trackAfterSuccess for post-request tracking
 *
 * 2. requireUsage.trackAfterSuccess
 *    - Tracks usage after successful response
 *    - Place as LAST middleware in chain
 *    - Runs asynchronously (doesn't slow response)
 *
 * 3. requireUsage.consumeNow(usageType, amount)
 *    - Checks AND consumes immediately (blocking)
 *    - Use when you need to guarantee consumption before response
 *
 * 4. requireUsage.check(usageType, amount)
 *    - Only checks limit, doesn't track
 *    - Use for pre-validation without consumption
 *
 * =============================================================================
 * USAGE EXAMPLES
 * =============================================================================
 *
 * PATTERN 1: Check before, track after (RECOMMENDED)
 * --------------------------------------------------
 * router.post('/ai-chat',
 *   authenticateJWT,
 *   requireUsage('aiChatbotResponses'),      // Check limit
 *   chatController.sendMessage,               // Process request
 *   requireUsage.trackAfterSuccess            // Track usage (runs async)
 * );
 *
 * PATTERN 2: Consume immediately (blocking)
 * -----------------------------------------
 * router.post('/diagnosis',
 *   authenticateJWT,
 *   requireUsage.consumeNow('aiDiagnosticRequests'),  // Check + consume
 *   diagnosisController.analyze
 * );
 *
 * PATTERN 3: Check only (no tracking)
 * -----------------------------------
 * router.get('/can-use-ai',
 *   authenticateJWT,
 *   requireUsage.check('aiChatbotResponses'),
 *   (req, res) => res.json({ canUse: true, remaining: req.usageCheck.remaining })
 * );
 *
 * PATTERN 4: Custom amount
 * ------------------------
 * router.post('/bulk-diagnosis',
 *   authenticateJWT,
 *   requireUsage('aiDiagnosticRequests', 5),  // Check for 5 uses
 *   bulkController.analyze,
 *   requireUsage.trackAfterSuccess
 * );
 *
 * =============================================================================
 * REQUEST DATA
 * =============================================================================
 *
 * After requireUsage runs, these are attached to req:
 *
 * req.usageTracking = {
 *   userId: "uuid",
 *   usageType: "aiChatbotResponses",
 *   amount: 1,
 *   check: {
 *     allowed: true,
 *     used: 5,
 *     limit: 50,
 *     remaining: 45,
 *     percentageUsed: 10,
 *     tier: "basic"
 *   }
 * }
 *
 * =============================================================================
 * RESPONSE CODES
 * =============================================================================
 *
 * 200 - Success (within limits)
 * 401 - No authentication
 * 429 - Usage limit exceeded (includes upgrade URL)
 * 500 - Server error during usage check
 *
 * =============================================================================
 * ERROR RESPONSE FORMAT
 * =============================================================================
 *
 * {
 *   "success": false,
 *   "message": "AI Chat Messages limit exceeded",
 *   "code": "USAGE_LIMIT_EXCEEDED",
 *   "details": {
 *     "usageType": "aiChatbotResponses",
 *     "displayName": "AI Chat Messages",
 *     "used": 50,
 *     "limit": 50,
 *     "remaining": 0,
 *     "tier": "basic",
 *     "planType": "patient"
 *   },
 *   "upgradeUrl": "/dashboard/settings/billing/subscription-plans"
 * }
 *
 * =============================================================================
 */

const usageService = require("../services/usageService");

/**
 * Display names for usage types
 */
const USAGE_DISPLAY_NAMES = {
  aiChatbotResponses: "AI Chat Messages",
  aiDiagnosticRequests: "AI Diagnostic Requests",
  maxPatients: "Patient Consultations",
  aiResponses: "AI Responses"
};

/**
 * Get user ID from request
 */
function getUserId(req) {
  return req.user?.sub || req.user?.id;
}

/**
 * Get display name for usage type
 */
function getDisplayName(usageType) {
  return USAGE_DISPLAY_NAMES[usageType] || usageType;
}

/**
 * Main middleware - checks usage limit before request
 * Use with trackAfterSuccess for post-request tracking
 *
 * @param {string} usageType - Usage type to check
 * @param {number} amount - Amount to consume (default: 1)
 */
function requireUsage(usageType, amount = 1) {
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

      // Check if user can consume this usage
      const check = await usageService.canConsumeDetailed(userId, usageType, amount);

      if (!check.allowed) {
        return res.status(429).json({
          success: false,
          message: check.reason || `${getDisplayName(usageType)} limit exceeded`,
          code: "USAGE_LIMIT_EXCEEDED",
          details: {
            usageType,
            displayName: getDisplayName(usageType),
            used: check.used || 0,
            limit: check.limit || 0,
            remaining: 0,
            tier: check.tier,
            planType: check.planType,
            upgradeRequired: check.upgradeRequired
          },
          upgradeUrl: "/dashboard/settings/billing/subscription-plans"
        });
      }

      // Store tracking info for post-success tracking
      req.usageTracking = {
        userId,
        usageType,
        amount,
        check
      };

      next();
    } catch (error) {
      console.error("Usage check error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to check usage limits",
        code: "USAGE_CHECK_FAILED"
      });
    }
  };
}

/**
 * Track usage after successful response
 * Place as LAST middleware in route chain
 * Runs asynchronously to not slow down response
 */
requireUsage.trackAfterSuccess = async function(req, res, next) {
  try {
    // Only track if we have tracking info and response was successful
    if (req.usageTracking && res.statusCode < 400) {
      const { userId, usageType, amount } = req.usageTracking;

      // Track asynchronously - don't await
      usageService.consume(userId, usageType, amount).catch(error => {
        console.error("Usage tracking failed:", error.message);
      });
    }

    next();
  } catch (error) {
    console.warn("Usage tracking warning:", error.message);
    next(); // Don't fail request for tracking issues
  }
};

/**
 * Check AND consume immediately (blocking)
 * Use when you need to guarantee consumption before response
 *
 * @param {string} usageType - Usage type to check and consume
 * @param {number} amount - Amount to consume (default: 1)
 */
requireUsage.consumeNow = function(usageType, amount = 1) {
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

      // Check if user can consume
      const check = await usageService.canConsumeDetailed(userId, usageType, amount);

      if (!check.allowed) {
        return res.status(429).json({
          success: false,
          message: check.reason || `${getDisplayName(usageType)} limit exceeded`,
          code: "USAGE_LIMIT_EXCEEDED",
          details: {
            usageType,
            displayName: getDisplayName(usageType),
            used: check.used || 0,
            limit: check.limit || 0,
            remaining: 0,
            tier: check.tier,
            planType: check.planType
          },
          upgradeUrl: "/dashboard/settings/billing/subscription-plans"
        });
      }

      // Consume immediately
      const result = await usageService.consume(userId, usageType, amount);

      // Attach result for controller use
      req.usageResult = result;

      next();
    } catch (error) {
      console.error("Usage consume error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to process usage",
        code: "USAGE_CONSUME_FAILED"
      });
    }
  };
};

/**
 * Check usage only (no tracking)
 * Use for pre-validation without consumption
 *
 * @param {string} usageType - Usage type to check
 * @param {number} amount - Amount to check (default: 1)
 */
requireUsage.check = function(usageType, amount = 1) {
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

      const check = await usageService.canConsumeDetailed(userId, usageType, amount);

      if (!check.allowed) {
        return res.status(429).json({
          success: false,
          message: check.reason || `${getDisplayName(usageType)} limit exceeded`,
          code: "USAGE_LIMIT_EXCEEDED",
          details: {
            usageType,
            displayName: getDisplayName(usageType),
            used: check.used || 0,
            limit: check.limit || 0,
            tier: check.tier
          },
          upgradeUrl: "/dashboard/settings/billing/subscription-plans"
        });
      }

      // Attach check result for controller use
      req.usageCheck = {
        usageType,
        ...check
      };

      next();
    } catch (error) {
      console.error("Usage check error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to check usage",
        code: "USAGE_CHECK_FAILED"
      });
    }
  };
};

module.exports = requireUsage;
