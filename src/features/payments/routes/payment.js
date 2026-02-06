// src/routes/transactions/paymentRoutes.js - UPDATED WITH WEBHOOK VERIFICATION
const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');
const { authenticateJWT, authorizeRoles } = require('../../../shared/middlewares/authMiddleware');
const ValidationMiddleware = require('../../../shared/middlewares/validation');
const RateLimiterMiddleware = require('../../../shared/middlewares/rateLimiter');
const SanitizerMiddleware = require('../../../shared/middlewares/sanitizer');
const crypto = require('crypto');

// Webhook logic moved to ./webhooks.js
const captureRawBody = require('../../../shared/middlewares/captureRawBody');
// Middleware to capture raw body for signature verification
// const captureRawBody = (req, res, next) => {
//   let data = '';
//   req.setEncoding('utf8');

//   req.on('data', (chunk) => {
//     data += chunk;
//   });

//   req.on('end', () => {
//     req.rawBody = data;
//     try {
//       // Parse the JSON body after capturing raw body
//       req.body = JSON.parse(data);
//       next();
//     } catch (error) {
//       console.error('❌ Error parsing webhook JSON:', error);
//       res.status(400).json({ error: 'Invalid JSON' });
//     }
//   });
// };

const captureRawBody = (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');

  req.on('data', (chunk) => {
    data += chunk;
    console.log('📥 Received chunk:', chunk.length, 'bytes');
  });

  req.on('end', () => {
    console.log('📥 Raw body captured:', data.length, 'bytes');
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
      console.log('✅ JSON parsed successfully');
      next();
    } catch (error) {
      console.error('❌ Error parsing webhook JSON:', error);
      console.error('❌ Raw data:', data);
      res.status(400).json({ error: 'Invalid JSON' });
    }
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error);
    res.status(500).json({ error: 'Request processing failed' });
  });
};

// Token verification logic moved to services/middleware (if needed)

// ================================
// PUBLIC ROUTES
// ================================

// // UPDATED WEBHOOK ROUTES WITH SIGNATURE VERIFICATION
// router.post('/webhooks/flutterwave', 
//   captureRawBody, 
//   verifyFlutterwaveSignature, 
//   PaymentController.handleWebhook
// );

// router.post('/webhooks/paystack', 
//   captureRawBody, 
//   verifyPaystackSignature, 
//   PaymentController.handleWebhook
// );

// Dynamic webhook route with provider-specific verification
// router.post('/webhooks/:provider', (req, res, next) => {
//  console.log('🎯 WEBHOOK HIT:', req.params.provider);
//  console.log('🎯 TIME:', new Date().toISOString());
//  next();
// }, captureRawBody, (req, res, next) => {
//  const { provider } = req.params;

//  console.log('🔍 Processing provider:', provider);

//  if (provider === 'flutterwave') {
//    return verifyFlutterwaveSignature(req, res, next);
//  } else if (provider === 'paystack') {
//    return verifyPaystackSignature(req, res, next);
//  } else {
//    console.log('⚠️ Unknown provider:', provider);
//    return res.status(400).json({ error: 'Unknown provider' });
//  }
// }, PaymentController.handleWebhook);

// WEBHOOK ROUTES MOVED TO separate webhook router
// See src/features/payments/routes/webhooks.js

// PAYMENT CALLBACK ROUTE (PUBLIC - for provider redirects)
router.get('/callback', PaymentController.handlePaymentCallback);

// ================================
// AUTHENTICATED ROUTES
// ================================
router.use(authenticateJWT);
router.use(SanitizerMiddleware.sanitizeInput);

// CORE PAYMENT ROUTES
router.get('/options', RateLimiterMiddleware.payments(), PaymentController.getPaymentOptions);
router.post('/initiate', RateLimiterMiddleware.payments(), PaymentController.initiatePayment);
router.post('/process', RateLimiterMiddleware.payments(), PaymentController.processPayment);

// TRANSACTION ROUTES
router.get('/transaction/:transactionId', PaymentController.getTransaction);
router.get('/history', PaymentController.getUserTransactions);

// APPOINTMENT ROUTES
router.post('/appointment/create', RateLimiterMiddleware.payments(), PaymentController.createAppointmentPayment);
router.post('/appointment/date-change', PaymentController.handleAppointmentDateChange);
router.get('/appointment/:transactionId/status', PaymentController.getAppointmentPaymentStatus);
router.post('/appointment/:transactionId/cancel', RateLimiterMiddleware.payments(), PaymentController.cancelAppointmentPayment);
router.post('/appointment/:transactionId/reschedule', RateLimiterMiddleware.payments(), PaymentController.rescheduleAppointmentPayment);
router.get('/appointments/overview', PaymentController.getAppointmentsOverview);

// APPOINTMENT RETRY ROUTE
router.post('/appointment/:transactionId/retry',
  RateLimiterMiddleware.payments(),
  PaymentController.retryAppointmentPayment
);

// CANCELLED TRANSACTIONS ROUTE
router.get('/cancelled-transactions',
  PaymentController.getCancelledTransactions
);

// REFUND ROUTES (Admin Only)
router.post('/refund/:transactionId',
  authorizeRoles('admin', 'super_admin'),
  RateLimiterMiddleware.sensitive(),
  PaymentController.processManualRefund
);

// ANALYTICS (Admin Only)
router.get('/statistics', authorizeRoles('admin', 'super_admin'), PaymentController.getPaymentStatistics);
router.get('/analytics/services', authorizeRoles('admin', 'super_admin'), PaymentController.getServiceAnalytics);
router.get('/analytics/providers', authorizeRoles('admin', 'super_admin'), PaymentController.getProviderPerformance);
router.get('/analytics/currencies', authorizeRoles('admin', 'super_admin'), PaymentController.getCurrencyAnalytics);
router.get('/analytics/dashboard', authorizeRoles('admin', 'super_admin'), PaymentController.getDashboardAnalytics);
router.get('/auto-billing/analytics', authorizeRoles('admin', 'super_admin'), PaymentController.getAutoBillingAnalytics);

// UTILITY ROUTES
router.get('/supported-options', PaymentController.getSupportedOptions);
router.get('/user/settings', PaymentController.getUserPaymentSettings);
router.get('/fees/calculate', PaymentController.calculatePaymentFees);
router.get('/exchange-rates', PaymentController.getExchangeRates);
router.post('/currency/convert', PaymentController.convertCurrency);
router.get('/health', authorizeRoles('admin', 'super_admin'), PaymentController.checkPaymentSystemHealth);

// OPTIONAL ADVANCED ROUTES (implement as needed)
// router.post('/subscription/auto-billing', RateLimiterMiddleware.payments(), PaymentController.setupSubscriptionAutoBilling);
// router.post('/multi-service', RateLimiterMiddleware.payments(), PaymentController.processMultiServicePayment);
// router.post('/schedule', RateLimiterMiddleware.payments(), PaymentController.schedulePayment);
// router.get('/batch/:batchId/status', authorizeRoles('admin', 'super_admin'), PaymentController.getBatchPaymentStatus);

module.exports = router;