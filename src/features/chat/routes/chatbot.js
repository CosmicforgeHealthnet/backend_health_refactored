// src/routes/chatbotRoutes.js
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

// Import usage tracking middleware and activity hooks
const UsageTrackingMiddleware = require("../../subscriptions/middlewares/usageTrackingMiddleware");
const ActivityHooksService = require('../../../shared/services/activityHooksService');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const chatbotController = new ChatbotController();

// Apply authentication to all chatbot routes
router.use(authenticateJWT);

/**
 * @route   POST /chatbot/chat
 * @desc    AI-Doctor endpoint for patient consultations
 * @access  Private (All authenticated users)
 * @usage   Tracks 'aiChatbotResponses' usage
 */
router.post('/chat',
  UsageTrackingMiddleware.usageMiddleware('aiChatbotResponses'),
  RateLimiterMiddleware?.general ? RateLimiterMiddleware.general() : (req, res, next) => next(),
  // accept optional files + message
  upload.array('files', 10),
  validateChatMessage,
  chatbotController.chat.bind(chatbotController),
  ActivityHooksService.trackActivityAfterSuccess
);

/**
 * @route   POST /chatbot/doctorchat
 * @desc    Medical Assistant endpoint for healthcare professionals
 * @access  Private (Doctors only)
 * @usage   Tracks 'aiResponses' usage for doctors
 */
router.post('/doctorchat',
  authorizeRoles('doctor'),
  UsageTrackingMiddleware.usageMiddleware('aiResponses'),
  RateLimiterMiddleware?.general ? RateLimiterMiddleware.general() : (req, res, next) => next(),
  upload.array('files', 10),
  validateChatMessage,
  chatbotController.doctorChat.bind(chatbotController),
  ActivityHooksService.trackActivityAfterSuccess
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
