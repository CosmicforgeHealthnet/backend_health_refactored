// src/routes/transactions/paymentRoutes.js - UPDATED WITH WEBHOOK VERIFICATION
const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');
const { authenticateJWT, authorizeRoles } = require('../../../shared/middlewares/authMiddleware');
const ValidationMiddleware = require('../../../shared/middlewares/validation');
const RateLimiterMiddleware = require('../../../shared/middlewares/rateLimiter');
const SanitizerMiddleware = require('../../../shared/middlewares/sanitizer');

// Webhook logic moved to ./webhooks.js
// Token verification logic moved to services/middleware (if needed)

// ================================
// PUBLIC ROUTES
// ================================

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