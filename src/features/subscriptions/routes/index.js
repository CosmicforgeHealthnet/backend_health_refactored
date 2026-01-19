// src/routes/subscriptionRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRoles } = require('../../auth/middlewares/authMiddleware');
const RateLimiterMiddleware = require('../../../shared/middlewares/rateLimiter');
const SanitizerMiddleware = require('../../../shared/middlewares/sanitizer');

const {
  getCurrentSubscription,
  getAvailablePlans,
  getPlanPricing,
  upgradeSubscription,
  cancelSubscription,
  checkFeatureAccess,
  getUsageInfo,
  getSubscriptionAnalytics,
  getAutoBillingSettings,
  enableAutoBilling,
  disableAutoBilling,
  // NEW METHODS:
  createSubscriptionPayment,
  upgradeWithSavedMethod,
  processUpgradeAfterPayment,
  testSubscriptionUpgrade,
  getUsageSummary,
  getUsageStatus
} = require('../controllers/subscriptionController');

// Apply common middlewares
router.use(authenticateJWT);
router.use(SanitizerMiddleware.sanitizeInput);

/**
 * @route   GET /api/subscription/current
 * @desc    Get user's current subscription
 * @access  Private
 */
router.get('/current', getCurrentSubscription);

/**
 * @route   GET /api/subscription/plans
 * @desc    Get available plans for user type
 * @access  Private
 */
router.get('/plans', getAvailablePlans);

/**
 * @route   GET /api/subscription/plans/:planType/:tier/pricing
 * @desc    Get pricing for specific plan
 * @access  Private
 */
router.get('/plans/:planType/:tier/pricing', getPlanPricing);

/**
 * @route   POST /api/subscription/create-payment
 * @desc    Create subscription payment (payment-first upgrade)
 * @access  Private
 */
router.post('/create-payment',
  RateLimiterMiddleware.payments(),
  createSubscriptionPayment
);

// Add this route to your subscription routes
router.post('/test-upgrade/:transactionId',
  authenticateJWT,
  testSubscriptionUpgrade
);

/**
 * @route   POST /api/subscription/upgrade-with-saved-method
 * @desc    Upgrade subscription using saved payment method
 * @access  Private
 */
router.post('/upgrade-with-saved-method',
  RateLimiterMiddleware.payments(),
  upgradeWithSavedMethod
);

/**
 * @route   POST /api/subscription/process-upgrade-after-payment
 * @desc    Process subscription upgrade after successful payment (webhook/callback)
 * @access  Private (Internal use)
 */
router.post('/process-upgrade-after-payment',
  processUpgradeAfterPayment
);

/**
 * @route   POST /api/subscription/upgrade
 * @desc    Upgrade/change subscription plan
 * @access  Private
 */
router.post('/upgrade',
  RateLimiterMiddleware.sensitive(),
  upgradeSubscription
);

/**
 * @route   POST /api/subscription/cancel
 * @desc    Cancel subscription
 * @access  Private
 */
router.post('/cancel',
  RateLimiterMiddleware.sensitive(),
  cancelSubscription
);

/**
 * @route   GET /api/subscription/features/:featureName
 * @desc    Check if user has access to specific feature
 * @access  Private
 */
router.get('/features/:featureName', checkFeatureAccess);

/**
 * @route   GET /api/subscription/usage
 * @desc    Get usage limits and current usage
 * @access  Private
 */
router.get('/usage', getUsageInfo);

/**
 * @route   GET /api/subscription/analytics
 * @desc    Get subscription analytics
 * @access  Private (Admin only)
 */
router.get('/analytics',
  authorizeRoles('admin', 'super_admin'),
  getSubscriptionAnalytics
);

/**
 * @route   GET /api/subscription/auto-billing
 * @desc    Get auto-billing settings
 * @access  Private
 */
router.get('/auto-billing', getAutoBillingSettings);

/**
 * @route   POST /api/subscription/auto-billing/enable
 * @desc    Enable auto-billing
 * @access  Private
 */
router.post('/auto-billing/enable',
  RateLimiterMiddleware.sensitive(),
  enableAutoBilling
);

/**
 * @route   POST /api/subscription/auto-billing/disable
 * @desc    Disable auto-billing
 * @access  Private
 */
router.post('/auto-billing/disable',
  RateLimiterMiddleware.sensitive(),
  disableAutoBilling
);

/**
 * @route   GET /api/subscription/usage-summary
 * @desc    Get comprehensive usage summary
 * @access  Private
 */
router.get('/usage-summary', getUsageSummary);

/**
 * @route   GET /api/subscription/usage-status
 * @desc    Get quick usage status
 * @access  Private
 */
router.get('/usage-status', getUsageStatus);

module.exports = router;