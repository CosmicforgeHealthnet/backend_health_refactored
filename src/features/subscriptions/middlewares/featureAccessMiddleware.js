// src/middlewares/featureAccessMiddleware.js

/**
 * DYNAMIC FEATURE ACCESS MIDDLEWARE
 * =================================
 * 
 * This middleware provides dynamic access control for any subscription feature.
 * It can check access to any feature defined in subscriptionConstants.js
 * 
 * SUPPORTED FEATURES:
 * 
 * Patient Features:
 * - chatOnly, voiceConsultation, videoConsultation
 * - generalEmergencySpecialists, allSpecialists  
 * - labAccess, pharmacy, shopAccess
 * - firstAidInstructions, familyPlan
 * - standardSupport, prioritySupport
 * - earlyAccessFeatures, betaAccess
 * 
 * Doctor Features:
 * - chatOnly, videoConsultation
 * - regularProfileListing, topProfileListing
 * - standardSupport, prioritySupport
 * - unlimitedPatients, unlimitedAI
 * 
 * USAGE:
 * Use this middleware to protect any route that requires specific subscription features
 */

const SubscriptionCompatibilityService = require("../services/subscriptionCompatibilityService");

class FeatureAccessMiddleware {

  /**
   * Main middleware factory function - creates middleware for specific features
   * 
   * @param {string|string[]} requiredFeatures - Feature name(s) to check
   * @param {Object} options - Additional options
   * @param {boolean} options.requireAll - If true, user must have ALL features (default: false)
   * @param {string} options.userIdSource - Where to get user ID from ('user.sub', 'user.id', 'params.userId', 'body.userId')
   * @returns {Function} Express middleware function
   */
  static requireFeature(requiredFeatures, options = {}) {
    // Normalize to array for consistent processing
    const features = Array.isArray(requiredFeatures) ? requiredFeatures : [requiredFeatures];
    const { requireAll = false, userIdSource = 'user.sub' } = options;

    return async (req, res, next) => {
      try {
        // STEP 1: Extract user ID from request
        const userId = this.extractUserId(req, userIdSource);

        if (!userId) {
          return res.status(401).json({
            success: false,
            message: "User authentication required",
            errorCode: "USER_NOT_AUTHENTICATED"
          });
        }

        console.log(`🔐 Checking feature access for user ${userId}:`, features);

        // STEP 2: Check access for each required feature
        const accessResults = [];

        for (const featureName of features) {
          try {
            const accessResult = await SubscriptionCompatibilityService.hasFeatureAccess(userId, featureName);
            accessResults.push({
              feature: featureName,
              hasAccess: accessResult.hasAccess,
              reason: accessResult.reason,
              usage: accessResult.usage,
              currentPlan: accessResult.currentPlan,
              planType: accessResult.planType,
              upgradeRequired: accessResult.upgradeRequired
            });
          } catch (error) {
            console.error(`❌ Error checking feature access for ${featureName}:`, error);
            accessResults.push({
              feature: featureName,
              hasAccess: false,
              reason: 'Error checking feature access',
              error: error.message
            });
          }
        }

        // STEP 3: Apply access logic based on requirements
        const hasAccess = this.evaluateAccess(accessResults, requireAll);
        const deniedFeatures = accessResults.filter(result => !result.hasAccess);

        // STEP 4: Handle access denied
        if (!hasAccess) {
          const firstDenied = deniedFeatures[0];

          return res.status(403).json({
            success: false,
            message: this.buildAccessDeniedMessage(features, requireAll, deniedFeatures),
            errorCode: "FEATURE_ACCESS_REQUIRED",
            details: {
              requiredFeatures: features,
              requireAll,
              deniedFeatures: deniedFeatures.map(f => ({
                feature: f.feature,
                reason: f.reason,
                usage: f.usage
              })),
              currentPlan: firstDenied.currentPlan,
              planType: firstDenied.planType,
              upgradeRequired: firstDenied.upgradeRequired
            }
          });
        }

        // STEP 5: Access granted - add info to request for potential use
        req.featureAccess = {
          checkedFeatures: features,
          accessResults,
          userId
        };

        console.log(`✅ Feature access granted for user ${userId}:`, features);
        next();

      } catch (error) {
        console.error("❌ Error in feature access middleware:", error);
        return res.status(500).json({
          success: false,
          message: "Feature access check failed. Please try again.",
          errorCode: "FEATURE_ACCESS_CHECK_ERROR"
        });
      }
    };
  }

  /**
   * Utility middleware to check single feature access (most common use case)
   * 
   * @param {string} featureName - Single feature to check
   * @param {Object} options - Additional options
   * @returns {Function} Express middleware function
   */
  static requireSingleFeature(featureName, options = {}) {
    return this.requireFeature(featureName, options);
  }

  /**
   * Utility middleware to check multiple features (user must have ALL)
   * 
   * @param {string[]} features - Array of features to check
   * @param {Object} options - Additional options
   * @returns {Function} Express middleware function
   */
  static requireAllFeatures(features, options = {}) {
    return this.requireFeature(features, { ...options, requireAll: true });
  }

  /**
   * Utility middleware to check multiple features (user needs ANY ONE)
   * 
   * @param {string[]} features - Array of features to check
   * @param {Object} options - Additional options
   * @returns {Function} Express middleware function
   */
  static requireAnyFeature(features, options = {}) {
    return this.requireFeature(features, { ...options, requireAll: false });
  }

  /**
   * Express middleware for checking feature access info (doesn't block, just adds info)
   * Useful for conditional UI features
   */
  static checkFeatureInfo(features, options = {}) {
    const featureList = Array.isArray(features) ? features : [features];
    const { userIdSource = 'user.sub' } = options;

    return async (req, res, next) => {
      try {
        const userId = this.extractUserId(req, userIdSource);

        if (!userId) {
          req.featureInfo = { error: "User not authenticated" };
          return next();
        }

        const featureInfo = {};

        for (const featureName of featureList) {
          try {
            const accessResult = await SubscriptionCompatibilityService.hasFeatureAccess(userId, featureName);
            featureInfo[featureName] = {
              hasAccess: accessResult.hasAccess,
              reason: accessResult.reason,
              usage: accessResult.usage,
              upgradeRequired: accessResult.upgradeRequired
            };
          } catch (error) {
            featureInfo[featureName] = {
              hasAccess: false,
              error: error.message
            };
          }
        }

        req.featureInfo = featureInfo;
        next();

      } catch (error) {
        console.error("❌ Error in feature info middleware:", error);
        req.featureInfo = { error: "Feature check failed" };
        next();
      }
    };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Extract user ID from request based on source configuration
   */
  static extractUserId(req, userIdSource) {
    const sourceParts = userIdSource.split('.');
    let value = req;

    for (const part of sourceParts) {
      value = value?.[part];
      if (value === undefined) break;
    }

    return value;
  }

  /**
   * Evaluate if user has required access based on access results
   */
  static evaluateAccess(accessResults, requireAll) {
    if (requireAll) {
      // User must have access to ALL features
      return accessResults.every(result => result.hasAccess);
    } else {
      // User needs access to at least ONE feature
      return accessResults.some(result => result.hasAccess);
    }
  }

  /**
   * Build appropriate access denied message
   */
  static buildAccessDeniedMessage(features, requireAll, deniedFeatures) {
    const featureNames = features.join(', ');

    if (features.length === 1) {
      return `Your current subscription plan doesn't include access to ${featureNames}. Please upgrade to access this feature.`;
    }

    if (requireAll) {
      return `Your current subscription plan doesn't include all required features (${featureNames}). Please upgrade to access these features.`;
    } else {
      return `Your current subscription plan doesn't include any of the required features (${featureNames}). Please upgrade to access these features.`;
    }
  }

  /**
   * Get detailed feature access information for user (utility method)
   * Useful for API endpoints that return feature access status
   */
  static async getFeatureAccessInfo(userId, features) {
    try {
      const featureList = Array.isArray(features) ? features : [features];
      const accessInfo = {};

      for (const featureName of featureList) {
        const accessResult = await SubscriptionCompatibilityService.hasFeatureAccess(userId, featureName);
        accessInfo[featureName] = {
          hasAccess: accessResult.hasAccess,
          reason: accessResult.reason,
          usage: accessResult.usage,
          currentPlan: accessResult.currentPlan,
          planType: accessResult.planType,
          upgradeRequired: accessResult.upgradeRequired
        };
      }

      return {
        success: true,
        userId,
        features: accessInfo,
        timestamp: new Date()
      };

    } catch (error) {
      console.error("❌ Error getting feature access info:", error);
      return {
        success: false,
        error: error.message,
        userId,
        timestamp: new Date()
      };
    }
  }
}

module.exports = FeatureAccessMiddleware;

/**
 * ========================================
 * HOW TO USE FEATURE ACCESS MIDDLEWARE
 * ========================================
 * 
 * BASIC USAGE EXAMPLES:
 * =====================
 * 
 * // Import the middleware
 * const FeatureAccessMiddleware = require('../middlewares/featureAccessMiddleware');
 * const { requireFeature, requireSingleFeature, requireAllFeatures, requireAnyFeature } = FeatureAccessMiddleware;
 * 
 * 
 * EXAMPLE 1: Single Feature Check
 * -------------------------------
 * 
 * // Video consultation route - requires videoConsultation feature
 * router.post('/consultations/video',
 *   authenticateJWT,
 *   requireSingleFeature('videoConsultation'),
 *   consultationController.createVideoConsultation
 * );
 * 
 * // Lab access route - requires labAccess feature
 * router.get('/lab/reports',
 *   authenticateJWT,
 *   requireSingleFeature('labAccess'),
 *   labController.getReports
 * );
 * 
 * // Pharmacy route - requires pharmacy feature
 * router.post('/pharmacy/order',
 *   authenticateJWT,
 *   requireSingleFeature('pharmacy'),
 *   pharmacyController.createOrder
 * );
 * 
 * 
 * EXAMPLE 2: Multiple Features (User needs ANY ONE)
 * ------------------------------------------------
 * 
 * // Support route - user needs either standard OR priority support
 * router.post('/support/ticket',
 *   authenticateJWT,
 *   requireAnyFeature(['standardSupport', 'prioritySupport']),
 *   supportController.createTicket
 * );
 * 
 * // Consultation route - user can use voice OR video consultation
 * router.post('/consultations',
 *   authenticateJWT,
 *   requireAnyFeature(['voiceConsultation', 'videoConsultation']),
 *   consultationController.createConsultation
 * );
 * 
 * 
 * EXAMPLE 3: Multiple Features (User needs ALL)
 * --------------------------------------------
 * 
 * // Premium consultation - needs video + all specialists + priority support
 * router.post('/consultations/premium',
 *   authenticateJWT,
 *   requireAllFeatures(['videoConsultation', 'allSpecialists', 'prioritySupport']),
 *   consultationController.createPremiumConsultation
 * );
 * 
 * // Beta feature - needs both beta access and early access
 * router.get('/beta/features',
 *   authenticateJWT,
 *   requireAllFeatures(['betaAccess', 'earlyAccessFeatures']),
 *   betaController.getFeatures
 * );
 * 
 * 
 * EXAMPLE 4: Custom User ID Sources
 * ---------------------------------
 * 
 * // Get user ID from params instead of JWT
 * router.get('/users/:userId/family-plan',
 *   requireSingleFeature('familyPlan', { userIdSource: 'params.userId' }),
 *   familyController.getFamilyPlan
 * );
 * 
 * // Get user ID from request body
 * router.post('/consultations/family',
 *   requireSingleFeature('familyPlan', { userIdSource: 'body.patientId' }),
 *   consultationController.createFamilyConsultation
 * );
 * 
 * 
 * EXAMPLE 5: Feature Info (Non-blocking check)
 * -------------------------------------------
 * 
 * // Add feature info to request without blocking access
 * router.get('/dashboard',
 *   authenticateJWT,
 *   FeatureAccessMiddleware.checkFeatureInfo(['videoConsultation', 'labAccess', 'pharmacy']),
 *   (req, res) => {
 *     res.json({
 *       success: true,
 *       user: req.user,
 *       availableFeatures: req.featureInfo // Contains access info for each feature
 *     });
 *   }
 * );
 * 
 * 
 * EXAMPLE 6: Complete Route Setup
 * -------------------------------
 * 
 * const express = require('express');
 * const router = express.Router();
 * const { authenticateJWT } = require('../middlewares/authMiddleware');
 * const FeatureAccessMiddleware = require('../middlewares/featureAccessMiddleware');
 * 
 * // Extract middleware functions for cleaner code
 * const { requireSingleFeature, requireAnyFeature, requireAllFeatures, checkFeatureInfo } = FeatureAccessMiddleware;
 * 
 * // Apply authentication to all routes
 * router.use(authenticateJWT);
 * 
 * // Video consultation routes
 * router.post('/video-consultation',
 *   requireSingleFeature('videoConsultation'),
 *   consultationController.createVideo
 * );
 * 
 * // Lab routes
 * router.get('/lab/results',
 *   requireSingleFeature('labAccess'),
 *   labController.getResults
 * );
 * 
 * // Pharmacy routes  
 * router.post('/pharmacy/prescription',
 *   requireSingleFeature('pharmacy'),
 *   pharmacyController.submitPrescription
 * );
 * 
 * // Support routes
 * router.post('/support',
 *   requireAnyFeature(['standardSupport', 'prioritySupport']),
 *   supportController.createTicket
 * );
 * 
 * // Premium routes
 * router.get('/premium/specialists',
 *   requireSingleFeature('allSpecialists'),
 *   specialistController.getAllSpecialists
 * );
 * 
 * // Family routes
 * router.get('/family/members',
 *   requireSingleFeature('familyPlan'),
 *   familyController.getMembers
 * );
 * 
 * // Beta features
 * router.get('/beta/features',
 *   requireAllFeatures(['betaAccess', 'earlyAccessFeatures']),
 *   betaController.getFeatures
 * );
 * 
 * module.exports = router;
 * 
 * 
 * EXAMPLE 7: API Endpoint to Check Feature Access
 * ----------------------------------------------
 * 
 * // Route to get feature access info for frontend
 * router.get('/user/feature-access', async (req, res) => {
 *   const userId = req.user.sub;
 *   const features = req.query.features ? req.query.features.split(',') : [
 *     'videoConsultation', 'labAccess', 'pharmacy', 'allSpecialists', 'familyPlan'
 *   ];
 *   
 *   const accessInfo = await FeatureAccessMiddleware.getFeatureAccessInfo(userId, features);
 *   res.json(accessInfo);
 * });
 * 
 * 
 * EXPECTED RESPONSES:
 * ===================
 * 
 * SUCCESS (Feature Access Granted):
 * - Status: 200
 * - Middleware calls next() to continue to route handler
 * - Adds req.featureAccess with access details
 * 
 * ACCESS DENIED (Feature Not Available):
 * - Status: 403
 * - errorCode: "FEATURE_ACCESS_REQUIRED"
 * - Contains upgrade information and current plan details
 * 
 * USAGE LIMIT EXCEEDED:
 * - Status: 403  
 * - errorCode: "FEATURE_ACCESS_REQUIRED"
 * - Contains usage details and limit information
 * 
 * ERRORS:
 * - Status: 401 - User not authenticated
 * - Status: 500 - Server error during feature check
 * 
 * 
 * AVAILABLE FEATURES BY PLAN:
 * ===========================
 * 
 * Patient Plans:
 * - Free: chatOnly, generalEmergencySpecialists, shopAccess, standardSupport
 * - Standard: + voiceConsultation, videoConsultation, allSpecialists, labAccess, pharmacy, firstAidInstructions
 * - Medium: + familyPlan (3 members)
 * - Premium: + prioritySupport (5 family members) 
 * - Gold Elite: + earlyAccessFeatures, betaAccess (unlimited family)
 * 
 * Doctor Plans:
 * - Free: chatOnly, regularProfileListing, standardSupport
 * - Professional: + videoConsultation, topProfileListing, prioritySupport
 * - Premium: + unlimitedPatients, unlimitedAI
 * 
 * 
 * FRONTEND INTEGRATION:
 * ====================
 * 
 * // Check feature access before showing UI elements
 * const checkFeatureAccess = async (feature) => {
 *   try {
 *     const response = await fetch(`/api/user/feature-access?features=${feature}`);
 *     const data = await response.json();
 *     return data.features[feature].hasAccess;
 *   } catch (error) {
 *     console.error('Feature access check failed:', error);
 *     return false;
 *   }
 * };
 * 
 * // Show/hide video consultation button
 * if (await checkFeatureAccess('videoConsultation')) {
 *   showVideoConsultationButton();
 * } else {
 *   showUpgradePrompt('videoConsultation');
 * }
 */