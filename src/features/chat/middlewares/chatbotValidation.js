// src/middlewares/chatbotValidation.js
const { body, query, param } = require('express-validator');

const validateChatMessage = [
  body('message')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 1, max: 4000 })
    .withMessage('Message must be between 1 and 4000 characters'),
  body('sessionId')
    .optional({ checkFalsy: true })
    .isUUID()
    .withMessage('Session ID must be a valid UUID')
];

const validateSessionQuery = [
  query('sessionType')
    .optional()
    .isIn(['general', 'doctor'])
    .withMessage('Session type must be either general or doctor'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
];

const validateSessionParam = [
  param('sessionId')
    .isUUID()
    .withMessage('Session ID must be a valid UUID')
];

module.exports = {
  validateChatMessage,
  validateSessionQuery,
  validateSessionParam
};
