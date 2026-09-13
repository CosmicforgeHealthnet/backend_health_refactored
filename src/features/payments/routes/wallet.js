// ================================
// WALLET ROUTES
// ================================

// src/routes/transactions/walletRoutes.js
const express = require('express');
const router = express.Router();

const WalletController = require('../controllers/walletController');
const { authenticateJWT, authorizeRoles } = require('../../../shared/middlewares/authMiddleware');
const PaymentAuthMiddleware = require('../middlewares/paymentAuth');
const ValidationMiddleware = require('../../../shared/middlewares/validation');
const RateLimiterMiddleware = require('../../../shared/middlewares/rateLimiter');
const SanitizerMiddleware = require('../../../shared/middlewares/sanitizer');

// plubic route 

/**
 * @route   POST /api/wallet/password/reset
 * @desc    Reset wallet password using email token (PUBLIC - no auth required)
 * @access  Public
 */
router.post('/password/reset',
  RateLimiterMiddleware.general(),
  ValidationMiddleware.validateResetWalletPassword(),
  WalletController.resetWalletPasswordWithToken
);

/**
 * @route   GET /api/wallet/password/reset/verify/:token
 * @desc    Verify wallet password reset token (PUBLIC - no auth required)
 * @access  Public
 */
router.get('/password/reset/verify/:token',
  RateLimiterMiddleware.general(),
  WalletController.verifyWalletPasswordResetToken
);



// Apply common middlewares
router.use(authenticateJWT);
router.use(PaymentAuthMiddleware.verifyPaymentAuth); // fresh DB read -> req.fullUser, so requireVerifiedDoctor sees live status, not a stale JWT claim
router.use(SanitizerMiddleware.sanitizeInput);

/**
 * @route   GET /api/wallet
 * @desc    Get doctor's wallet
 * @access  Private (Doctor only)
 */
router.get('/',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  WalletController.getDoctorWallet
);

/**
 * @route   PUT /api/wallet/currency
 * @desc    Update wallet display currency
 * @access  Private (Doctor only)
 */
router.put('/currency',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  WalletController.updateDisplayCurrency
);

/**
 * @route   GET /api/wallet/supported-currencies
 * @desc    Get supported currencies
 * @access  Private (Doctor only)
 */
router.get('/supported-currencies',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  WalletController.getSupportedCurrencies
);

/**
 * @route   POST /api/wallet/withdraw
 * @desc    Initiate withdrawal request
 * @access  Private (Doctor only)
 */
router.post('/withdraw',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  RateLimiterMiddleware.withdrawals(),
  ValidationMiddleware.validateWalletWithdrawal(),
  SanitizerMiddleware.sanitizeFinancialData,
  WalletController.initiateWithdrawal
);

/**
 * @route   GET /api/wallet/withdrawals
 * @desc    Get withdrawal history
 * @access  Private (Doctor only)
 */
router.get('/withdrawals',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  WalletController.getWithdrawalHistory
);

/**
 * @route   POST /api/wallet/resolve-account
 * @desc    Resolve bank account details
 * @access  Private (Doctor only)
 */
router.post('/resolve-account',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  RateLimiterMiddleware.general(),
  WalletController.resolveAccountDetails
);

/**
 * @route   GET /api/wallet/supported-banks
 * @desc    Get supported banks
 * @access  Private (Doctor only)
 */
router.get('/supported-banks',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  WalletController.getSupportedBanks
);

/**
 * @route   PUT /api/wallet/withdraw/:withdrawalId/verify-otp
 * @desc    Complete withdrawal with custom OTP verification
 * @access  Private (Doctor only)
 */
router.put('/withdraw/:withdrawalId/verify-otp',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  RateLimiterMiddleware.general(),
  ValidationMiddleware.validateOtpVerification(),
  WalletController.completeWithdrawalOtp
);

/**
 * @route   POST /api/wallet/withdraw/:withdrawalId/resend-otp
 * @desc    Resend OTP for withdrawal
 * @access  Private (Doctor only)
 */
router.post('/withdraw/:withdrawalId/resend-otp',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  RateLimiterMiddleware.general(),
  WalletController.resendWithdrawalOtp
);

/**
 * @route   POST /api/wallet/password
 * @desc    Set wallet password
 * @access  Private (Doctor only)
 */
router.post('/password',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  ValidationMiddleware.validateSetWalletPassword(),
  WalletController.setWalletPassword
);

/**
 * @route   PUT /api/wallet/password
 * @desc    Update wallet password (requires current password)
 * @access  Private (Doctor only)
 */
router.put('/password',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  RateLimiterMiddleware.general(),
  ValidationMiddleware.validateUpdateWalletPassword(),
  WalletController.updateWalletPassword
);

/**
 * @route   POST /api/wallet/password/reset-request
 * @desc    Request wallet password reset via email
 * @access  Private (Doctor only)
 */
router.post('/password/reset-request',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  RateLimiterMiddleware.general(),
  WalletController.requestWalletPasswordReset
);


/**
 * @route   GET /api/wallet/password/check
 * @desc    Check if doctor has wallet password
 * @access  Private (Doctor only)
 */
router.get('/password/check',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  WalletController.checkWalletPassword
);

/**
 * @route   POST /api/wallet/password/verify
 * @desc    Verify wallet password for sensitive operations
 * @access  Private (Doctor only)
 */
router.post('/password/verify',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  RateLimiterMiddleware.general(),
  ValidationMiddleware.validatePasswordVerification(),
  WalletController.verifyWalletPassword
);




// ================================
// ADMIN WALLET ROUTES
// ================================

/**
 * @route   POST /api/wallet/create
 * @desc    Create wallet for doctor
 * @access  Private (Admin only)
 */
router.post('/create',
  authorizeRoles('admin', 'super_admin'),
  WalletController.createDoctorWallet
);

/**
 * @route   POST /api/wallet/freeze
 * @desc    Freeze wallet
 * @access  Private (Admin only)
 */
router.post('/freeze',
  authorizeRoles('admin', 'super_admin'),
  WalletController.freezeWallet
);

/**
 * @route   POST /api/wallet/unfreeze
 * @desc    Unfreeze wallet
 * @access  Private (Admin only)
 */
router.post('/unfreeze',
  authorizeRoles('admin', 'super_admin'),
  WalletController.unfreezeWallet
);

module.exports = router;