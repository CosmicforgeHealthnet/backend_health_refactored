// src/routes/transactions/paymentMethodRoutes.js
const express = require('express');
const router = express.Router();

const PaymentMethodController = require('../controllers/paymentMethodController');
const { authenticateJWT } = require('../../../shared/middlewares/authMiddleware');
const ValidationMiddleware = require('../../../shared/middlewares/validation');
const RateLimiterMiddleware = require('../../../shared/middlewares/rateLimiter');
const SanitizerMiddleware = require('../../../shared/middlewares/sanitizer');

// Apply common middlewares
router.use(authenticateJWT);

// ================================
// SECURE TOKENIZATION ENDPOINTS
// ================================

/**
 * @route   POST /api/payment-methods/initialize-tokenization
 * @desc    SECURE: Initialize card tokenization with payment provider
 * @access  Private
 * @body    { provider: string, currency: string }
 */
router.post('/initialize-tokenization',
  RateLimiterMiddleware.payments(),
  SanitizerMiddleware.sanitizeInput,
  ValidationMiddleware.validateInitializeTokenization(),
  PaymentMethodController.initializeCardTokenization
);

/**
 * @route   POST /api/payment-methods/tokenization-callback
 * @desc    SECURE: Handle tokenization callback from payment provider
 * @access  Private
 * @body    { provider: string, reference: string, userId: string }
 */
router.post('/tokenization-callback',
  RateLimiterMiddleware.payments(),
  SanitizerMiddleware.sanitizeInput,
  ValidationMiddleware.validateTokenizationCallback(),
  PaymentMethodController.handleTokenizationCallback
);

/**
 * @route   GET /api/payment-methods/tokenization-status/:provider/:reference
 * @desc    SECURE: Check tokenization status
 * @access  Private
 */
router.get('/tokenization-status/:provider/:reference',
  PaymentMethodController.checkTokenizationStatus
);

/**
 * @route   GET /api/payment-methods/supported-options
 * @desc    Get supported providers and currencies
 * @access  Private
 */
router.get('/supported-options',
  PaymentMethodController.getSupportedOptions
);

/**
 * @route   POST /api/payment-methods/:paymentMethodId/refresh-tokens
 * @desc    Refresh expired payment method tokens
 * @access  Private
 * @body    { provider: string }
 */
router.post('/:paymentMethodId/refresh-tokens',
  RateLimiterMiddleware.payments(),
  SanitizerMiddleware.sanitizeInput,
  ValidationMiddleware.validateRefreshTokens(),
  PaymentMethodController.refreshPaymentMethodTokens
);

// ================================
// DEPRECATED ENDPOINTS (for backward compatibility)
// ================================

/**
 * @route   POST /api/payment-methods/validate-and-save
 * @desc    DEPRECATED: Use /initialize-tokenization instead
 * @access  Private
 * @deprecated This endpoint is deprecated for security reasons
 */
router.post('/validate-and-save',
  PaymentMethodController.validateAndSavePaymentMethod
);

// ================================
// PAYMENT METHOD MANAGEMENT
// ================================

/**
 * @route   GET /api/payment-methods
 * @desc    Get user's payment methods
 * @access  Private
 */
router.get('/',
  PaymentMethodController.getUserPaymentMethods
);

/**
 * @route   POST /api/payment-methods
 * @desc    Save a new payment method (internal use)
 * @access  Private
 */
router.post('/',
  RateLimiterMiddleware.payments(),
  SanitizerMiddleware.sanitizeInput,
  ValidationMiddleware.validateSavePaymentMethod(),
  PaymentMethodController.savePaymentMethod
);

/**
 * @route   PUT /api/payment-methods/:paymentMethodId/default
 * @desc    Set payment method as default
 * @access  Private
 */
router.put('/:paymentMethodId/default',
  SanitizerMiddleware.sanitizeInput,
  PaymentMethodController.setDefaultPaymentMethod
);

/**
 * @route   DELETE /api/payment-methods/:paymentMethodId
 * @desc    Remove a payment method
 * @access  Private
 */
router.delete('/:paymentMethodId',
  PaymentMethodController.removePaymentMethod
);

// ================================
// AUTO-BILLING MANAGEMENT
// ================================

/**
 * @route   GET /api/payment-methods/auto-billing
 * @desc    Get payment methods available for auto-billing
 * @access  Private
 */
router.get('/auto-billing',
  PaymentMethodController.getAutoBillingPaymentMethods
);

/**
 * @route   PUT /api/payment-methods/:paymentMethodId/auto-charge
 * @desc    Enable/disable auto-charging for payment method
 * @access  Private
 * @body    { canAutoCharge: boolean }
 */
router.put('/:paymentMethodId/auto-charge',
  RateLimiterMiddleware.payments(),
  SanitizerMiddleware.sanitizeInput,
  ValidationMiddleware.validateToggleAutoCharging(),
  PaymentMethodController.toggleAutoCharging
);

/**
 * @route   GET /api/payment-methods/analytics
 * @desc    Get payment method auto-billing analytics
 * @access  Private
 */
router.get('/analytics',
  PaymentMethodController.getPaymentMethodAnalytics
);

module.exports = router;