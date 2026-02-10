// src/routes/chatbotRoutes.js
/**
 * Chatbot Routes - AI-powered medical chat endpoints
 *
 * USAGE TRACKING:
 * - Patient chat: Tracks 'aiChatbotResponses' against monthly limit
 * - Doctor chat: Tracks 'aiResponses' against doctor's monthly limit
 *
 * Pattern: requireUsage checks before, trackAfterSuccess records after.
 */
const express = require('express');
const router = express.Router();
const ChatbotController = require('../controllers/chatbotController');
const { authenticateJWT, authorizeRoles } = require('../../auth/middlewares/authMiddleware');
const {
  validateChatMessage,
  validateSessionQuery,
  validateSessionParam
} = require('../middlewares/chatbotValidation');
const RateLimiterMiddleware = require('../../../shared/middlewares/rateLimiter');

// Usage tracking middleware
const requireUsage = require("../../subscriptions/middlewares/requireUsage");

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const chatbotController = new ChatbotController();

// Apply authentication to all chatbot routes
router.use(authenticateJWT);

/**
 * @route   POST /chatbot/chat
 * @desc    AI-Doctor endpoint for patient consultations
 * @access  Private (All authenticated users)
 * @usage   Checks 'aiChatbotResponses' limit, tracks after success
 */
router.post('/chat',
  requireUsage('aiChatbotResponses'),
  RateLimiterMiddleware?.general ? RateLimiterMiddleware.general() : (req, res, next) => next(),
  upload.array('files', 10),
  validateChatMessage,
  chatbotController.chat.bind(chatbotController),
  requireUsage.trackAfterSuccess
);

/**
 * @route   POST /chatbot/doctorchat
 * @desc    Medical Assistant endpoint for healthcare professionals
 * @access  Private (Doctors only)
 * @usage   Checks 'aiResponses' limit, tracks after success
 */
router.post('/doctorchat',
  authorizeRoles('doctor'),
  requireUsage('aiResponses'),
  RateLimiterMiddleware?.general ? RateLimiterMiddleware.general() : (req, res, next) => next(),
  upload.array('files', 10),
  validateChatMessage,
  chatbotController.doctorChat.bind(chatbotController),
  requireUsage.trackAfterSuccess
);

/**
 * @route   GET /chatbot/sessions
 * @desc    Get user's chatbot sessions
 * @access  Private (All authenticated users)
 */
router.get('/sessions',
  validateSessionQuery,
  chatbotController.getSessions.bind(chatbotController)
);

/**
 * @route   GET /chatbot/sessions/:sessionId
 * @desc    Get specific session with messages
 * @access  Private (All authenticated users)
 */
router.get('/sessions/:sessionId',
  validateSessionParam,
  chatbotController.getSession.bind(chatbotController)
);

module.exports = router;
