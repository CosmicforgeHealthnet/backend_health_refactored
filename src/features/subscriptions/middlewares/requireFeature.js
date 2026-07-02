// src/features/subscriptions/middlewares/requireFeature.js
/**
 * =============================================================================
 * FEATURE ACCESS MIDDLEWARE
 * =============================================================================
 *
 * PURPOSE:
 * Checks if user's subscription plan includes access to specific features.
 * Use this for boolean (on/off) features like video consultation, lab access, etc.
 *
 * WHAT IT DOES:
 * 1. Gets user's subscription and feature flags
 * 2. Checks if requested feature is enabled (true)
 * 3. Blocks with 403 if feature not in plan
 *
 * =============================================================================
 * AVAILABLE FEATURES
 * =============================================================================
 *
 * PATIENT FEATURES:
 * | Feature                     | Free | Basic | Standard | Medium | Premium | Gold Elite |
 * |-----------------------------|------|-------|----------|--------|---------|------------|
 * | chatAccess                  | No   | Yes   | Yes      | Yes    | Yes     | Yes        |
 * | voiceConsultation           | No   | Yes   | Yes      | Yes    | Yes     | Yes        |
 * | videoConsultation           | Yes  | Yes   | Yes      | Yes    | Yes     | Yes        |
 * | generalEmergencySpecialists | Yes  | Yes   | Yes      | Yes    | Yes     | Yes        |
 * | allSpecialists              | No   | Yes   | Yes      | Yes    | Yes     | Yes        |
 * | labAccess                   | No   | Yes   | Yes      | Yes    | Yes     | Yes        |
 * | pharmacy                    | No   | No    | Yes      | Yes    | Yes     | Yes        |
 * | shopAccess                  | Yes  | Yes   | Yes      | Yes    | Yes     | Yes        |
 * | firstAidInstructions        | No   | No    | Yes      | Yes    | Yes     | Yes        |
 * | familyPlan                  | No   | No    | No       | Yes    | Yes     | Yes        |
 * | standardSupport             | Yes  | Yes   | Yes      | Yes    | No      | No         |
 * | prioritySupport             | No   | No    | No       | No     | Yes     | Yes        |
 * | earlyAccessFeatures         | No   | No    | No       | No     | No      | Yes        |
 * | betaAccess                  | No   | No    | No       | No     | No      | Yes        |
 *
 * NOTE: Free plan has Video Consultation ONLY (no chat). Basic+ plans add Chat Access.
 *
 * DOCTOR FEATURES:
 * | Feature               | Free | Basic | Professional | Premium |
 * |-----------------------|------|-------|--------------|---------|
 * | chatAccess            | No   | Yes   | Yes          | Yes     |
 * | videoConsultation     | Yes  | Yes   | Yes          | Yes     |
 * | regularProfileListing | Yes  | Yes   | No           | No      |
 * | topProfileListing     | No   | No    | Yes          | Yes     |
 * | standardSupport       | Yes  | Yes   | No           | No      |
 * | prioritySupport       | No   | No    | Yes          | Yes     |
 * | unlimitedPatients     | No   | No    | No           | Yes     |
 * | unlimitedAI           | No   | No    | No           | Yes     |
 *
 * NOTE: Free plan has Video Consultation ONLY (no chat). Basic+ plans add Chat Access.
 *
 * =============================================================================
 * AVAILABLE METHODS
 * =============================================================================
 *
 * 1. requireFeature(featureName)
 *    - Checks single feature
 *    - Returns 403 if not enabled
 *
 * 2. requireFeature.all([feature1, feature2])
 *    - Requires ALL features to be enabled
 *    - Returns 403 if any missing
 *
 * 3. requireFeature.any([feature1, feature2])
 *    - Requires at least ONE feature
 *    - Returns 403 if none enabled
 *
 * 4. requireFeature.check(featureName)
 *    - Non-blocking check
 *    - Attaches result to req.featureCheck
 *    - Always calls next()
 *
 * =============================================================================
 * USAGE EXAMPLES
 * =============================================================================
 *
 * SINGLE FEATURE CHECK:
 * ---------------------
 * router.post('/video-call',
 *   authenticateJWT,
 *   requireFeature('videoConsultation'),
 *   videoController.startCall
 * );
 *
 * router.get('/lab-results',
 *   authenticateJWT,
 *   requireFeature('labAccess'),
 *   labController.getResults
 * );
 *
 * router.post('/pharmacy-order',
 *   authenticateJWT,
 *   requireFeature('pharmacy'),
 *   pharmacyController.createOrder
 * );
 *
 * MULTIPLE FEATURES (ALL REQUIRED):
 * ---------------------------------
 * router.post('/premium-lab-order',
 *   authenticateJWT,
 *   requireFeature.all(['labAccess', 'allSpecialists']),
 *   premiumLabController.order
 * );
 *
 * MULTIPLE FEATURES (ANY ONE):
 * ----------------------------
 * router.post('/consultation',
 *   authenticateJWT,
 *   requireFeature.any(['voiceConsultation', 'videoConsultation']),
 *   consultationController.start
 * );
 *
 * NON-BLOCKING CHECK:
 * -------------------
 * router.get('/dashboard',
 *   authenticateJWT,
 *   requireFeature.check('familyPlan'),
 *   (req, res) => {
 *     const canManageFamily = req.featureCheck.hasAccess;
 *     res.json({ showFamilySection: canManageFamily });
 *   }
 * );
 *
 * =============================================================================
 * REQUEST DATA
 * =============================================================================
 *
 * After requireFeature runs, these are attached to req:
 *
 * req.subscription = { ... }  // Full subscription data
 * req.featureAccess = {
 *   videoConsultation: true   // Map of checked features
 * }
 *
 * =============================================================================
 * RESPONSE CODES
 * =============================================================================
 *
 * 200 - Success (feature enabled)
 * 401 - No authentication
 * 403 - Feature not available in plan
 * 500 - Server error
 *
 * =============================================================================
 * ERROR RESPONSE FORMAT
 * =============================================================================
 *
 * {
 *   "success": false,
 *   "message": "Your plan does not include Video Consultation",
 *   "code": "FEATURE_NOT_AVAILABLE",
 *   "details": {
 *     "feature": "videoConsultation",
 *     "displayName": "Video Consultation",
 *     "currentTier": "free",
 *     "planType": "patient"
 *   },
 *   "upgradeUrl": "/dashboard/settings/billing/subscription-plans"
 * }
 *
 * =============================================================================
 */

const subscriptionCompatibilityService = require("../services/subscriptionCompatibilityService");

/**
 * Display names for features
 */
const FEATURE_DISPLAY_NAMES = {
  // Consultation types
  chatAccess: "Chat Access",
  voiceConsultation: "Voice Consultation",
  videoConsultation: "Video Consultation",

  // Specialist access
  generalEmergencySpecialists: "General & Emergency Specialists",
  allSpecialists: "All Specialists",

  // Services
  labAccess: "Lab Access",
  pharmacy: "Pharmacy Access",
  shopAccess: "Shop Access",
  firstAidInstructions: "First Aid Instructions",

  // Account features
  familyPlan: "Family Plan",

  // Support
  standardSupport: "Standard Support",
  prioritySupport: "Priority Support",

  // Premium
  earlyAccessFeatures: "Early Access Features",
  betaAccess: "Beta Access",

  // Doctor specific
  regularProfileListing: "Regular Profile Listing",
  topProfileListing: "Top Profile Listing",
  unlimitedPatients: "Unlimited Patients",
  unlimitedAI: "Unlimited AI Responses"
};

/**
 * Get user ID from request
 */
function getUserId(req) {
  return req.user?.sub || req.user?.id;
}

/**
 * Get display name for feature
 */
function getDisplayName(feature) {
  return FEATURE_DISPLAY_NAMES[feature] || feature.replace(/([A-Z])/g, " $1").trim();
}

/**
 * Main middleware - checks single feature
 *
 * @param {string} featureName - Feature to check
 */
function requireFeature(featureName) {
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

      // Get subscription with features
      const subscription = await subscriptionCompatibilityService.getUserSubscription(userId);

      // Check if feature is enabled
      const hasFeature = subscription.features?.[featureName] === true;

      if (!hasFeature) {
        return res.status(403).json({
          success: false,
          message: `Your plan does not include ${getDisplayName(featureName)}`,
          code: "FEATURE_NOT_AVAILABLE",
          details: {
            feature: featureName,
            displayName: getDisplayName(featureName),
            currentTier: subscription.tier,
            planType: subscription.planType,
            upgradeRequired: true
          },
          upgradeUrl: "/dashboard/settings/billing/subscription-plans"
        });
      }

      // Attach data for downstream use
      req.subscription = subscription;
      req.featureAccess = { [featureName]: true };

      next();
    } catch (error) {
      console.error("Feature check error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to check feature access",
        code: "FEATURE_CHECK_FAILED"
      });
    }
  };
}

/**
 * Require ALL specified features
 * Returns 403 if any feature is missing
 *
 * @param {string[]} featureNames - Array of feature names (all required)
 */
requireFeature.all = function(featureNames) {
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

      // Find missing features
      const missing = [];
      for (const feature of featureNames) {
        if (subscription.features?.[feature] !== true) {
          missing.push(feature);
        }
      }

      if (missing.length > 0) {
        return res.status(403).json({
          success: false,
          message: `Your plan is missing: ${missing.map(getDisplayName).join(", ")}`,
          code: "FEATURES_NOT_AVAILABLE",
          details: {
            requiredFeatures: featureNames,
            missingFeatures: missing,
            missingDisplay: missing.map(getDisplayName),
            currentTier: subscription.tier,
            planType: subscription.planType,
            upgradeRequired: true
          },
          upgradeUrl: "/dashboard/settings/billing/subscription-plans"
        });
      }

      // All features present
      req.subscription = subscription;
      req.featureAccess = featureNames.reduce((acc, f) => ({ ...acc, [f]: true }), {});

      next();
    } catch (error) {
      console.error("Feature.all check error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to check feature access",
        code: "FEATURE_CHECK_FAILED"
      });
    }
  };
};

/**
 * Require ANY of the specified features
 * Returns 403 if none are enabled
 *
 * @param {string[]} featureNames - Array of feature names (at least one required)
 */
requireFeature.any = function(featureNames) {
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

      // Find enabled features
      const enabled = [];
      for (const feature of featureNames) {
        if (subscription.features?.[feature] === true) {
          enabled.push(feature);
        }
      }

      if (enabled.length === 0) {
        return res.status(403).json({
          success: false,
          message: `Your plan requires one of: ${featureNames.map(getDisplayName).join(", ")}`,
          code: "FEATURE_NOT_AVAILABLE",
          details: {
            requiredFeatures: featureNames,
            requiredDisplay: featureNames.map(getDisplayName),
            currentTier: subscription.tier,
            planType: subscription.planType,
            upgradeRequired: true
          },
          upgradeUrl: "/dashboard/settings/billing/subscription-plans"
        });
      }

      // At least one feature enabled
      req.subscription = subscription;
      req.featureAccess = enabled.reduce((acc, f) => ({ ...acc, [f]: true }), {});

      next();
    } catch (error) {
      console.error("Feature.any check error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to check feature access",
        code: "FEATURE_CHECK_FAILED"
      });
    }
  };
};

/**
 * Non-blocking feature check
 * Attaches result to req.featureCheck, always calls next()
 *
 * @param {string} featureName - Feature to check
 */
requireFeature.check = function(featureName) {
  return async function(req, res, next) {
    try {
      const userId = getUserId(req);

      if (userId) {
        const subscription = await subscriptionCompatibilityService.getUserSubscription(userId);
        const hasFeature = subscription.features?.[featureName] === true;

        req.subscription = subscription;
        req.featureCheck = {
          feature: featureName,
          hasAccess: hasFeature,
          tier: subscription.tier,
          planType: subscription.planType
        };
      } else {
        req.featureCheck = {
          feature: featureName,
          hasAccess: false,
          reason: "Not authenticated"
        };
      }

      next();
    } catch (error) {
      console.warn("Feature check warning:", error.message);
      req.featureCheck = {
        feature: featureName,
        hasAccess: false,
        error: error.message
      };
      next();
    }
  };
};

module.exports = requireFeature;
