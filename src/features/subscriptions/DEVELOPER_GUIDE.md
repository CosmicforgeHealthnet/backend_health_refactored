# Subscription System Developer Guide

This guide explains how to use the subscription system for usage tracking, feature access control, and billing operations.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Middlewares](#middlewares)
   - [requireSubscription](#1-requiresubscription)
   - [requireUsage](#2-requireusage)
   - [requireFeature](#3-requirefeature)
3. [Services](#services)
   - [SubscriptionCompatibilityService](#subscriptioncompatibilityservice)
   - [UsageService](#usageservice)
   - [SubscriptionService](#subscriptionservice)
   - [BillingService](#billingservice)
   - [SubscriptionNotificationService](#subscriptionnotificationservice)
4. [Promotional Pricing Configuration](#promotional-pricing-configuration)
5. [Plan Definitions](#plan-definitions)
6. [Common Use Cases](#common-use-cases)
7. [Cron Jobs](#cron-jobs)
8. [Testing](#testing)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              ROUTES                                      │
│   Uses: requireSubscription, requireUsage, requireFeature               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           MIDDLEWARES                                    │
│   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐          │
│   │requireSubscript-│ │  requireUsage   │ │ requireFeature  │          │
│   │      ion        │ │                 │ │                 │          │
│   │                 │ │ Check & track   │ │ Check boolean   │          │
│   │ Check tier/     │ │ usage limits    │ │ feature access  │          │
│   │ status          │ │                 │ │                 │          │
│   └────────┬────────┘ └────────┬────────┘ └────────┬────────┘          │
└────────────┼───────────────────┼───────────────────┼────────────────────┘
             │                   │                   │
             ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            SERVICES                                      │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │           SubscriptionCompatibilityService                       │   │
│   │   - Get user subscription (with caching)                        │   │
│   │   - Get available plans                                         │   │
│   │   - Check feature access                                        │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      UsageService                                │   │
│   │   - Check usage limits                                          │   │
│   │   - Track consumption                                           │   │
│   │   - Get usage summary                                           │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                   SubscriptionService                            │   │
│   │   - Upgrade/downgrade subscriptions                             │   │
│   │   - Process expiry                                              │   │
│   │   - Handle doctor commissions                                   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     BillingService                               │   │
│   │   - Create payments                                             │   │
│   │   - Process payment completion                                  │   │
│   │   - Auto-billing management                                     │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          REPOSITORY                                      │
│   SubscriptionRepository → Database (Subscription Entity)               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Middlewares

### 1. requireSubscription

**Purpose:** Check subscription tier/status and attach subscription data to request.

**Location:** `middlewares/requireSubscription.js`

**Methods:**

| Method | Description |
|--------|-------------|
| `requireSubscription` | Attach subscription data (never blocks) |
| `requireSubscription.premium` | Require paid (non-free) plan |
| `requireSubscription.tier(['tier1', 'tier2'])` | Require specific tier(s) |
| `requireSubscription.active` | Require non-expired subscription |

**Examples:**

```javascript
const requireSubscription = require('../subscriptions/middlewares/requireSubscription');

// Just attach subscription data (for use in controller)
router.get('/dashboard',
  authenticateJWT,
  requireSubscription,
  (req, res) => {
    const { tier, features, isPremium } = req.subscription;
    res.json({ tier, features, isPremium });
  }
);

// Require paid plan
router.get('/premium-content',
  authenticateJWT,
  requireSubscription.premium,
  premiumController.getContent
);

// Require specific tier(s)
router.get('/gold-features',
  authenticateJWT,
  requireSubscription.tier(['premium', 'gold_elite']),
  goldController.getFeatures
);

// Require non-expired subscription
router.post('/renew',
  authenticateJWT,
  requireSubscription.active,
  renewController.process
);
```

**Attached Data (`req.subscription`):**

```javascript
{
  id: "uuid",
  tier: "basic",
  planType: "patient",
  status: "active",
  features: { videoConsultation: true, labAccess: true, ... },
  monthlyLimits: { aiChatbotResponses: 30, ... },
  currentUsage: { aiChatbotResponses: 5, ... },
  isActive: true,
  isPremium: true,
  daysRemaining: 25
}
```

---

### 2. requireUsage

**Purpose:** Check and track monthly usage limits (countable features).

**Location:** `middlewares/requireUsage.js`

**Usage Types:**

| Type | For | Description |
|------|-----|-------------|
| `aiChatbotResponses` | Patient | AI chatbot messages per month |
| `aiDiagnosticRequests` | Patient | AI diagnostic requests per month |
| `maxPatients` | Doctor | Patient consultations per month |
| `aiResponses` | Doctor | AI-assisted responses per month |

**Methods:**

| Method | Description |
|--------|-------------|
| `requireUsage(type, amount)` | Check limit before request |
| `requireUsage.trackAfterSuccess` | Track usage after successful response |
| `requireUsage.consumeNow(type, amount)` | Check AND consume immediately |
| `requireUsage.check(type, amount)` | Check only, no tracking |

**Examples:**

```javascript
const requireUsage = require('../subscriptions/middlewares/requireUsage');

// Pattern 1: Check before, track after (RECOMMENDED)
router.post('/ai-chat',
  authenticateJWT,
  requireUsage('aiChatbotResponses'),      // Check limit
  chatController.sendMessage,               // Process request
  requireUsage.trackAfterSuccess            // Track usage after success
);

// Pattern 2: Consume immediately (blocking)
router.post('/diagnosis',
  authenticateJWT,
  requireUsage.consumeNow('aiDiagnosticRequests'),
  diagnosisController.analyze
);

// Pattern 3: Custom amount
router.post('/bulk-chat',
  authenticateJWT,
  requireUsage('aiChatbotResponses', 5),   // Check for 5 messages
  bulkChatController.send,
  requireUsage.trackAfterSuccess
);

// Pattern 4: Check only (for validation)
router.get('/can-use-ai',
  authenticateJWT,
  requireUsage.check('aiChatbotResponses'),
  (req, res) => {
    res.json({
      canUse: true,
      remaining: req.usageCheck.remaining
    });
  }
);
```

**Error Response (429):**

```json
{
  "success": false,
  "message": "AI Chat Messages limit exceeded",
  "code": "USAGE_LIMIT_EXCEEDED",
  "details": {
    "usageType": "aiChatbotResponses",
    "displayName": "AI Chat Messages",
    "used": 30,
    "limit": 30,
    "remaining": 0,
    "tier": "basic"
  },
  "upgradeUrl": "/dashboard/settings/billing/subscription-plans"
}
```

---

### 3. requireFeature

**Purpose:** Check if user's plan includes specific features (boolean on/off).

**Location:** `middlewares/requireFeature.js`

**Feature Types:**

| Feature | Description |
|---------|-------------|
| `videoConsultation` | Video call with doctors |
| `voiceConsultation` | Voice call with doctors |
| `labAccess` | Order lab tests |
| `pharmacy` | Order medications |
| `allSpecialists` | Access all specialist doctors |
| `familyPlan` | Add family members |
| `prioritySupport` | Priority customer support |
| `topProfileListing` | (Doctor) Premium search visibility |

**Methods:**

| Method | Description |
|--------|-------------|
| `requireFeature(name)` | Check single feature |
| `requireFeature.all([...])` | Require ALL features |
| `requireFeature.any([...])` | Require ANY feature |
| `requireFeature.check(name)` | Non-blocking check |

**Examples:**

```javascript
const requireFeature = require('../subscriptions/middlewares/requireFeature');

// Single feature check
router.post('/video-call',
  authenticateJWT,
  requireFeature('videoConsultation'),
  videoController.startCall
);

// Multiple features - ALL required
router.post('/premium-lab-order',
  authenticateJWT,
  requireFeature.all(['labAccess', 'allSpecialists']),
  premiumLabController.order
);

// Multiple features - ANY one
router.post('/consultation',
  authenticateJWT,
  requireFeature.any(['voiceConsultation', 'videoConsultation']),
  consultationController.start
);

// Non-blocking check (for conditional UI)
router.get('/dashboard',
  authenticateJWT,
  requireFeature.check('familyPlan'),
  (req, res) => {
    const showFamilySection = req.featureCheck.hasAccess;
    res.json({ showFamilySection });
  }
);
```

**Error Response (403):**

```json
{
  "success": false,
  "message": "Your plan does not include Video Consultation",
  "code": "FEATURE_NOT_AVAILABLE",
  "details": {
    "feature": "videoConsultation",
    "displayName": "Video Consultation",
    "currentTier": "free",
    "planType": "patient"
  },
  "upgradeUrl": "/dashboard/settings/billing/subscription-plans"
}
```

---

## Services

### SubscriptionCompatibilityService

**Purpose:** Get subscription data with caching and fallbacks.

**Location:** `services/subscriptionCompatibilityService.js`

**Key Methods:**

```javascript
const SubscriptionCompatibilityService = require('./subscriptionCompatibilityService');

// Get full subscription (with caching - 30 min TTL)
const subscription = await SubscriptionCompatibilityService.getUserSubscription(userId);

// Get basic subscription (lightweight - 15 min TTL)
const basicSub = await SubscriptionCompatibilityService.getUserSubscriptionBasic(userId);

// Get available plans (for landing page - no auth required)
// Discount is automatically applied based on PROMO_EXPIRY env variable
const plans = SubscriptionCompatibilityService.getAvailablePlans('patient', 'US');
// Returns: { plans: { free: {...}, basic: {...}, premium: {...} }, currency: 'USD', withDiscount: true/false, ... }

// Get specific plan pricing
// Discount is automatically applied based on PROMO_EXPIRY env variable
const pricing = SubscriptionCompatibilityService.getPlanPricing('patient', 'premium', 'NG');
// Returns: { price: 24950, originalPrice: 49900, discount: 24950, currency: 'NGN', ... }

// Check feature access
const access = await SubscriptionCompatibilityService.hasFeatureAccess(userId, 'videoConsultation');
// Returns: { hasAccess: true/false, reason: '...', currentPlan: 'basic', ... }

// Clear user cache (after subscription changes)
await SubscriptionCompatibilityService.clearUserCache(userId);
```

---

### UsageService

**Purpose:** Check and track usage limits.

**Location:** `services/usageService.js`

**Key Methods:**

```javascript
const usageService = require('./usageService');

// Quick check - returns boolean
const canUse = await usageService.canConsume(userId, 'aiChatbotResponses', 1);

// Detailed check - returns full info
const check = await usageService.canConsumeDetailed(userId, 'aiChatbotResponses', 1);
// Returns: { allowed: true, used: 5, limit: 30, remaining: 25, ... }

// Track usage (after successful action)
const result = await usageService.consume(userId, 'aiChatbotResponses', 1);
// Returns: { success: true, previousCount: 5, newCount: 6, remaining: 24 }

// Track multiple usages at once
const results = await usageService.consumeMultiple(userId, {
  aiChatbotResponses: 1,
  aiDiagnosticRequests: 1
});

// Get complete usage summary (for dashboard)
const summary = await usageService.getUsageSummary(userId);
// Returns comprehensive usage data with all limits, features, and health status

// Reset monthly usage (for cron job)
await usageService.resetMonthlyUsage();
```

**Usage Summary Response:**

```javascript
{
  subscription: {
    tier: "basic",
    tierDisplay: "Basic Plan",
    planType: "patient",
    status: "active",
    isActive: true,
    isPremium: true,
    daysRemaining: 25
  },
  usageLimits: {
    aiChatbotResponses: {
      displayName: "AI Chat Messages",
      used: 15,
      limit: 30,
      remaining: 15,
      percentage: 50,
      status: "ok"  // "ok" | "warning" | "exceeded"
    }
  },
  featureAccess: {
    videoConsultation: {
      displayName: "Video Consultation",
      enabled: true
    }
  },
  familyPlan: {
    enabled: false,
    currentMembers: 1,
    maxMembers: 1
  },
  health: {
    status: "healthy",  // "healthy" | "warning" | "critical"
    message: "All usage within limits"
  },
  resetInfo: {
    nextResetDate: "2026-03-01T00:00:00.000Z",
    daysUntilReset: 19
  }
}
```

---

### SubscriptionService

**Purpose:** Subscription lifecycle management (upgrade, downgrade, expiry).

**Location:** `services/subscriptionService.js`

**Key Methods:**

```javascript
const SubscriptionService = require('./subscriptionService');

// Create payment for subscription upgrade
const payment = await SubscriptionService.createSubscriptionPayment(
  userId,
  'patient',           // planType
  'premium',           // tier
  'NG',                // countryCode
  'paystack',          // paymentProvider
  true                 // enableAutoBilling
);
// Returns: { success: true, transactionId: '...', redirectUrl: '...', amount: 24950 }

// Process upgrade after payment completion
const result = await SubscriptionService.processSubscriptionUpgradeAfterPayment(transactionId);

// Cancel subscription
await SubscriptionService.cancelSubscription(userId, 'Too expensive');

// Direct upgrade (without payment - for testing/admin)
const subscription = await SubscriptionService.upgradeSubscription(userId, 'premium', 'patient', 'US');

// Enable/disable auto-billing
await SubscriptionService.enableAutoBilling(userId, paymentMethodId);
await SubscriptionService.disableAutoBilling(userId);

// Get analytics (admin)
const analytics = await SubscriptionService.getSubscriptionAnalytics();
// Returns: { totalSubscriptions: 150, activeSubscriptions: 120, monthlyRevenue: 5000 }

// Batch operations (for cron jobs)
await SubscriptionService.batchProcessSubscriptions();  // Check expiry, send warnings
await SubscriptionService.resetMonthlyUsageForAll();    // Reset all usage counters
await SubscriptionService.sendUsageLimitWarnings();     // Notify users at 80% usage
```

---

### BillingService

**Purpose:** Handle payments and auto-billing.

**Location:** `services/billingService.js`

**Key Methods:**

```javascript
const billingService = require('./billingService');

// Create payment
const payment = await billingService.createPayment({
  userId,
  planType: 'patient',
  tier: 'premium',
  countryCode: 'NG',
  paymentProvider: 'auto',  // 'auto' | 'paystack' | 'flutterwave'
  enableAutoBilling: true
});

// Process completed payment
const result = await billingService.processPaymentComplete(transactionId);

// Auto-billing management
await billingService.enableAutoBilling(userId, paymentMethodId);
await billingService.disableAutoBilling(userId);
const settings = await billingService.getAutoBillingSettings(userId);

// Process auto-renewals (cron job)
const results = await billingService.processAutoRenewals();
// Returns: { processed: 10, failed: 2 }

// Cancel subscription
await billingService.cancelSubscription(userId, 'reason');
```

---

### SubscriptionNotificationService

**Purpose:** Send subscription-related notifications.

**Location:** `services/subscriptionNotificationService.js`

**Key Methods:**

```javascript
const notificationService = require('./subscriptionNotificationService');

// Expiration warnings
await notificationService.sendExpirationWarning(user, subscription, daysRemaining);

// Upgrade/downgrade
await notificationService.sendUpgradeSuccess(user, 'Premium Plan', 'premium', true);
await notificationService.sendDowngradeNotice(user, 'premium', false);
await notificationService.sendCancellationConfirmation(user, 'Too expensive');

// Billing
await notificationService.sendBillingSuccess(user, subscription);
await notificationService.sendBillingFailure(user, subscription, failureCount, 'Card declined');
await notificationService.sendAutoBillingEnabled(user, '4242', nextBillingDate);

// Usage warnings
await notificationService.sendUsageWarning(user, 'aiChatbotResponses', 85);
await notificationService.sendUsageLimitReached(user, 'aiChatbotResponses');
```

---

## Promotional Pricing Configuration

**Location:** Environment variables (`.env`)

The subscription system supports promotional pricing that can be enabled/disabled via environment variables.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PROMO_EXPIRY` | ISO date string for when promo expires | `2024-01-01T00:00:00Z` (disabled) |
| `PROMO_DISCOUNT_PERCENTAGE` | Default discount percentage | `50` |

### How It Works

- **Promo Active:** If `PROMO_EXPIRY` is set to a **future date**, discounts are automatically applied
- **Promo Disabled:** If `PROMO_EXPIRY` is set to a **past date** (or not set), no discounts are applied

### Example Configuration

```bash
# .env

# Enable 50% discount until end of 2026
PROMO_EXPIRY=2026-12-31T23:59:59Z
PROMO_DISCOUNT_PERCENTAGE=50

# OR disable discounts (set to past date)
PROMO_EXPIRY=2024-01-01T00:00:00Z
```

### API Response Behavior

When promo is **active**, responses include:
```json
{
  "price": 4950,
  "originalPrice": 9900,
  "discount": 4950,
  "discountPercentage": 50,
  "hasDiscount": true,
  "withDiscount": true,
  "promoExpiry": "2026-12-31T23:59:59Z",
  "promoTimeLeft": "314 days left",
  "hasActivePromo": true
}
```

When promo is **expired/disabled**, responses show:
```json
{
  "price": 9900,
  "originalPrice": 9900,
  "discount": 0,
  "discountPercentage": 0,
  "hasDiscount": false,
  "withDiscount": false
}
```

### Changing Promo Settings

1. Update `PROMO_EXPIRY` in your `.env` file
2. Restart the application
3. No code changes required

---

## Plan Definitions

**Location:** `utils/subscriptionConstants.js`

### Patient Plans

| Tier | AI Chat | AI Diagnostic | Video | Lab | Pharmacy | Family | Price (USD) |
|------|---------|---------------|-------|-----|----------|--------|-------------|
| Free | 10/mo | 0 | No | No | No | No | $0 |
| Basic | 30/mo | 20/mo | No | Yes | No | No | $5 |
| Standard | 80/mo | 50/mo | Yes | Yes | Yes | No | $7.50 |
| Medium | 200/mo | 150/mo | Yes | Yes | Yes | 3 members | $10 |
| Premium | Unlimited | Unlimited | Yes | Yes | Yes | 5 members | $25 |
| Gold Elite | Unlimited | Unlimited | Yes | Yes | Yes | Unlimited | $50 |

### Doctor Plans

| Tier | Commission | Patients/mo | AI Responses | Video | Top Listing | Price (USD) |
|------|------------|-------------|--------------|-------|-------------|-------------|
| Free | 30% | 10 | 50 | No | No | $0 |
| Basic | 20% | 40 | 200 | Yes | No | $5 |
| Professional | 15% | 100 | 400 | Yes | Yes | $15 |
| Premium | 10% | Unlimited | Unlimited | Yes | Yes | $30 |

---

## Common Use Cases

### 1. Protect AI Chat Endpoint

```javascript
const { requireUsage } = require('../subscriptions');

router.post('/ai-chat',
  authenticateJWT,
  requireUsage('aiChatbotResponses'),
  async (req, res) => {
    // Process AI chat...
    res.json({ message: 'AI response' });
  },
  requireUsage.trackAfterSuccess
);
```

### 2. Check Feature Before Video Call

```javascript
const { requireFeature } = require('../subscriptions');

router.post('/video-call/start',
  authenticateJWT,
  requireFeature('videoConsultation'),
  videoController.startCall
);
```

### 3. Get Usage Summary for Dashboard

```javascript
const { UsageService } = require('../subscriptions');

router.get('/usage',
  authenticateJWT,
  async (req, res) => {
    const summary = await UsageService.getUsageSummary(req.user.id);
    res.json(summary);
  }
);
```

### 4. Create Subscription Payment

```javascript
const { SubscriptionService } = require('../subscriptions');

router.post('/upgrade',
  authenticateJWT,
  async (req, res) => {
    const { tier, countryCode } = req.body;

    const payment = await SubscriptionService.createSubscriptionPayment(
      req.user.id,
      req.user.role === 'doctor' ? 'doctor' : 'patient',
      tier,
      countryCode,
      'auto',
      true
    );

    res.json(payment);
  }
);
```

### 5. Webhook for Payment Completion

```javascript
const { SubscriptionService } = require('../subscriptions');

router.post('/webhook/payment-complete',
  async (req, res) => {
    const { transactionId } = req.body;

    const result = await SubscriptionService.processSubscriptionUpgradeAfterPayment(transactionId);

    res.json(result);
  }
);
```

### 6. Manual Usage Tracking in Controller

```javascript
const { UsageService } = require('../subscriptions');

async function processAIResponse(req, res) {
  const userId = req.user.id;

  // Check first
  const canUse = await UsageService.canConsume(userId, 'aiChatbotResponses');
  if (!canUse) {
    return res.status(429).json({ error: 'Limit exceeded' });
  }

  // Process...
  const response = await generateAIResponse(req.body.message);

  // Track after success
  await UsageService.consume(userId, 'aiChatbotResponses', 1);

  res.json({ response });
}
```

---

## Cron Jobs

Add these to your cron scheduler:

```javascript
const { SubscriptionService, UsageService } = require('../subscriptions');

// Daily at midnight - check expiry and send warnings
cron.schedule('0 0 * * *', async () => {
  await SubscriptionService.batchProcessSubscriptions();
});

// 1st of every month - reset usage counters
cron.schedule('0 0 1 * *', async () => {
  await UsageService.resetMonthlyUsage();
});

// Daily at 6 PM - send usage warnings (80%+ users)
cron.schedule('0 18 * * *', async () => {
  await SubscriptionService.sendUsageLimitWarnings();
});

// Every hour - process auto-renewals
cron.schedule('0 * * * *', async () => {
  await SubscriptionService.processAutoRenewals();
});
```

---

## Testing

### Test Subscription Upgrade

```javascript
// In test/dev environment only
const result = await SubscriptionService.testSubscriptionUpgrade(
  transactionId,
  'patient',
  'premium'
);
```

### Check Current Subscription

```bash
GET /api/subscriptions/current
Authorization: Bearer <token>
```

### Check Usage Summary

```bash
GET /api/subscriptions/usage
Authorization: Bearer <token>
```

### Get Available Plans

```bash
GET /api/subscriptions/public/plans?type=patient&country=NG
```

---

## File Structure

```
src/features/subscriptions/
├── controllers/
│   └── subscriptionController.js    # HTTP endpoints
├── entities/
│   └── Subscription.js              # TypeORM entity
├── middlewares/
│   ├── requireSubscription.js       # Tier/status checks
│   ├── requireUsage.js              # Usage limit tracking
│   ├── requireFeature.js            # Feature access control
│   └── doctorSpecializationAccessMiddleware.js
├── repositories/
│   └── subscriptionRepository.js    # Database operations
├── routes/
│   └── index.js                     # Route definitions
├── services/
│   ├── subscriptionCompatibilityService.js  # Data retrieval
│   ├── usageService.js              # Usage tracking
│   ├── subscriptionService.js       # Lifecycle management
│   ├── billingService.js            # Payments
│   └── subscriptionNotificationService.js
├── utils/
│   └── subscriptionConstants.js     # Plan definitions
├── index.js                         # Feature exports
└── DEVELOPER_GUIDE.md               # This file
```

---

## Quick Reference

```javascript
// Import everything
const {
  requireSubscription,
  requireUsage,
  requireFeature,
  SubscriptionCompatibilityService,
  UsageService,
  SubscriptionService,
  BillingService
} = require('../subscriptions');

// Route protection
router.post('/ai', auth, requireUsage('aiChatbotResponses'), ctrl, requireUsage.trackAfterSuccess);
router.post('/video', auth, requireFeature('videoConsultation'), ctrl);
router.get('/premium', auth, requireSubscription.premium, ctrl);

// Service calls
const sub = await SubscriptionCompatibilityService.getUserSubscription(userId);
const summary = await UsageService.getUsageSummary(userId);
const check = await UsageService.canConsumeDetailed(userId, 'aiChatbotResponses', 1);
await UsageService.consume(userId, 'aiChatbotResponses', 1);
```

---

## Need Help?

- Check `subscriptionConstants.js` for plan definitions
- Check `subscriptionController.js` for API endpoints
- Check route files for usage examples

For questions, contact the backend team.
