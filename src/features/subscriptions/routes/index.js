// src/features/subscriptions/routes/index.js
/**
 * Subscription Routes
 *
 * PUBLIC (no auth):
 *   GET /public/plans              - Get all plans for landing page
 *   GET /public/plans/:type/:tier  - Get specific plan pricing
 *
 * AUTHENTICATED:
 *   GET /current                   - Get user's current subscription
 *   GET /plans                     - Get plans for user's role
 *   GET /plans/:type/:tier/pricing - Get specific plan pricing
 *   POST /create-payment           - Create payment for upgrade
 *   POST /process-upgrade-after-payment - Process after payment
 *   POST /upgrade                  - Direct upgrade
 *   POST /cancel                   - Cancel subscription
 *   GET /usage                     - Get comprehensive usage summary
 *   GET /features/:name            - Check feature access
 *   GET /auto-billing              - Get auto-billing settings
 *   POST /auto-billing/enable      - Enable auto-billing
 *   POST /auto-billing/disable     - Disable auto-billing
 *   GET /analytics                 - Admin analytics
 */

const express = require("express");
const router = express.Router();
const { authenticateJWT, optionalAuth, authorizeRoles } = require("../../auth/middlewares/authMiddleware");
const RateLimiterMiddleware = require("../../../shared/middlewares/rateLimiter");
const SanitizerMiddleware = require("../../../shared/middlewares/sanitizer");

const {
  // Public
  getPublicPlans,
  getPublicPlanPricing,
  // Subscription info
  getCurrentSubscription,
  getAvailablePlans,
  getPlanPricing,
  // Management
  createSubscriptionPayment,
  processUpgradeAfterPayment,
  upgradeSubscription,
  cancelSubscription,
  // Usage (consolidated to single endpoint)
  getUsageSummary,
  // Features
  checkFeatureAccess,
  // Auto-billing
  getAutoBillingSettings,
  enableAutoBilling,
  disableAutoBilling,
  // Admin
  getSubscriptionAnalytics,
  // Dev
  testSubscriptionUpgrade
} = require("../controllers/subscriptionController");

// ===========================================================================
// PUBLIC ROUTES (No Auth Required)
// ===========================================================================

// Get all plans (landing page) - works for doctor and patient
router.get("/public/plans",
  SanitizerMiddleware.sanitizeInput,
  optionalAuth,
  getPublicPlans
);

// Get specific plan pricing (public)
router.get("/public/plans/:planType/:tier",
  SanitizerMiddleware.sanitizeInput,
  getPublicPlanPricing
);

// ===========================================================================
// AUTHENTICATED ROUTES
// ===========================================================================

router.use(authenticateJWT);
router.use(SanitizerMiddleware.sanitizeInput);

// --- Subscription Info ---
router.get("/current", getCurrentSubscription);
router.get("/plans", getAvailablePlans);
router.get("/plans/:planType/:tier/pricing", getPlanPricing);

// --- Subscription Management ---
router.post("/create-payment", RateLimiterMiddleware.payments(), createSubscriptionPayment);
router.post("/process-upgrade-after-payment", processUpgradeAfterPayment);
router.post("/upgrade", upgradeSubscription);
router.post("/cancel", RateLimiterMiddleware.sensitive(), cancelSubscription);

// --- Usage (Single comprehensive endpoint) ---
router.get("/usage", getUsageSummary);

// --- Features ---
router.get("/features/:featureName", checkFeatureAccess);

// --- Auto-billing ---
router.get("/auto-billing", getAutoBillingSettings);
router.post("/auto-billing/enable", RateLimiterMiddleware.sensitive(), enableAutoBilling);
router.post("/auto-billing/disable", disableAutoBilling);

// --- Admin ---
router.get("/analytics", authorizeRoles("admin", "super_admin"), getSubscriptionAnalytics);

// --- Dev/Test ---
router.post("/test-upgrade/:transactionId", testSubscriptionUpgrade);

module.exports = router;
