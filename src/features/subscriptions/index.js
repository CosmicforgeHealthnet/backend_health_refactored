// src/features/subscriptions/index.js
/**
 * =============================================================================
 * SUBSCRIPTIONS FEATURE
 * =============================================================================
 *
 * SERVICES:
 *   SubscriptionCompatibilityService - Get subscriptions, plans, pricing
 *   SubscriptionService              - Lifecycle (upgrade, cancel, expiry)
 *   BillingService                   - Payments, auto-billing
 *   UsageService                     - Usage tracking and limits
 *   SubscriptionNotificationService  - Notifications
 *
 * MIDDLEWARES:
 *   requireSubscription              - Check subscription tier/status
 *   requireUsage                     - Check and track usage limits
 *   requireFeature                   - Check feature access
 *
 * =============================================================================
 * QUICK REFERENCE
 * =============================================================================
 *
 * SUBSCRIPTION TIER:
 *   requireSubscription              - Attach subscription data
 *   requireSubscription.premium      - Require paid plan
 *   requireSubscription.tier([...])  - Require specific tier(s)
 *   requireSubscription.active       - Require non-expired
 *
 * USAGE LIMITS (countable):
 *   requireUsage('aiChatbotResponses')     - Check AI chat limit
 *   requireUsage('aiDiagnosticRequests')   - Check diagnostic limit
 *   requireUsage('maxPatients')            - Check doctor patient limit
 *   requireUsage('aiResponses')            - Check doctor AI limit
 *   requireUsage.trackAfterSuccess         - Track after response
 *   requireUsage.consumeNow('type')        - Check + consume immediately
 *
 * FEATURE ACCESS (boolean):
 *   requireFeature('videoConsultation')    - Check video access
 *   requireFeature('labAccess')            - Check lab access
 *   requireFeature('pharmacy')             - Check pharmacy access
 *   requireFeature.all([...])              - Require all features
 *   requireFeature.any([...])              - Require any feature
 *
 * =============================================================================
 * EXAMPLES
 * =============================================================================
 *
 * // Usage limit with tracking
 * router.post('/ai-chat', auth, requireUsage('aiChatbotResponses'), controller.chat, requireUsage.trackAfterSuccess);
 *
 * // Feature access
 * router.post('/video', auth, requireFeature('videoConsultation'), controller.start);
 *
 * // Premium only
 * router.get('/premium', auth, requireSubscription.premium, controller.get);
 *
 * =============================================================================
 */

const router = require("./routes");
const entities = require("./entities");

// Services
const SubscriptionCompatibilityService = require("./services/subscriptionCompatibilityService");
const SubscriptionService = require("./services/subscriptionService");
const BillingService = require("./services/billingService");
const UsageService = require("./services/usageService");
const SubscriptionNotificationService = require("./services/subscriptionNotificationService");

// Middlewares (separate, focused, composable)
const requireSubscription = require("./middlewares/requireSubscription");
const requireUsage = require("./middlewares/requireUsage");
const requireFeature = require("./middlewares/requireFeature");

module.exports = {
  router,
  entities,

  // Services
  SubscriptionCompatibilityService,
  SubscriptionService,
  BillingService,
  UsageService,
  SubscriptionNotificationService,

  // Middlewares
  requireSubscription,
  requireUsage,
  requireFeature
};
