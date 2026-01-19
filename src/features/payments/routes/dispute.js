// ================================
// DISPUTE ROUTES
// ================================

// src/routes/transactions/disputeRoutes.js
const express = require('express');
const router = express.Router();

const DisputeController = require('../controllers/disputeController');
const { authenticateJWT, authorizeRoles } = require('../../../shared/middlewares/authMiddleware');
const PaymentAuthMiddleware = require('../../payments/middlewares/paymentAuth');
const ValidationMiddleware = require('../../../shared/middlewares/validation');
const RateLimiterMiddleware = require('../../../shared/middlewares/rateLimiter');
const SanitizerMiddleware = require('../../../shared/middlewares/sanitizer');

// Apply common middlewares
router.use(authenticateJWT);
router.use(SanitizerMiddleware.sanitizeInput);

/**
 * @route   POST /api/disputes/create
 * @desc    Create a refund request
 * @access  Private (Patient only)
 */
router.post('/create',
  PaymentAuthMiddleware.requireActivePatient,
  RateLimiterMiddleware.sensitive(),
  ValidationMiddleware.validateCreateDispute(),
  DisputeController.createRefundRequest
);

/**
 * @route   POST /api/disputes/respond
 * @desc    Respond to dispute
 * @access  Private (Doctor only)
 */
router.post('/respond',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  RateLimiterMiddleware.sensitive(),
  ValidationMiddleware.validateDisputeResponse(),
  DisputeController.respondToDispute
);

/**
 * @route   GET /api/disputes/doctor
 * @desc    Get disputes for doctor
 * @access  Private (Doctor only)
 */
router.get('/doctor',
  PaymentAuthMiddleware.requireVerifiedDoctor,
  DisputeController.getDoctorDisputes
);

/**
 * @route   GET /api/disputes/patient
 * @desc    Get disputes for patient
 * @access  Private (Patient only)
 */
router.get('/patient',
  PaymentAuthMiddleware.requireActivePatient,
  DisputeController.getPatientDisputes
);

/**
 * @route   GET /api/disputes/pending
 * @desc    Get all pending disputes
 * @access  Private (Admin only)
 */
router.get('/pending',
  authorizeRoles('admin', 'super_admin'),
  DisputeController.getPendingDisputes
);

module.exports = router;