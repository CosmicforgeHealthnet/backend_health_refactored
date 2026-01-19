// src/middlewares/chatbotValidationMiddleware.js
const { body, query, param } = require('express-validator');

class ChatbotValidationMiddleware {
  
  /**
   * Validate chat message request
   */
  static validateChatMessage() {
    return [
      body('message')
        .optional({ checkFalsy: true })
        .isString()
        .withMessage('Message must be a string')
        .isLength({ min: 1, max: 4000 })
        .withMessage('Message must be between 1 and 4000 characters')
        .trim(),
      
      body('sessionId')
        .optional()
        .isUUID()
        .withMessage('Session ID must be a valid UUID')
    ];
  }

  /**
   * Validate get sessions request
   */
  static validateGetSessions() {
    return [
      query('sessionType')
        .optional()
        .isIn(['general', 'doctor'])
        .withMessage('Session type must be either "general" or "doctor"'),
      
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
    ];
  }

  /**
   * Validate session ID parameter
   */
  static validateSessionId() {
    return [
      param('sessionId')
        .isUUID()
        .withMessage('Session ID must be a valid UUID')
    ];
  }

  /**
   * Validate continue session request
   */
  static validateContinueSession() {
    return [
      param('sessionId')
        .isUUID()
        .withMessage('Session ID must be a valid UUID'),
      
      body('message')
  .optional({ checkFalsy: true })
  .isString()
  .withMessage('Message must be a string')
  .isLength({ min: 1, max: 4000 })
  .withMessage('Message must be between 1 and 4000 characters')
  .trim()
    ];
  }

  /**
   * Sanitize message content
   */
  static sanitizeMessage(req, res, next) {
    if (req.body.message) {
      // Remove any potential harmful scripts or excessive whitespace
      req.body.message = req.body.message
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    next();
  }

  /**
   * Rate limiting for chatbot endpoints
   */
  static getRateLimit() {
    const rateLimit = require('express-rate-limit');
    
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50, // Limit each IP to 50 requests per windowMs
      message: {
        success: false,
        error: 'Too many chatbot requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Skip rate limiting for admin users
      skip: (req) => {
        return req.user && req.user.role === 'admin';
      }
    });
  }

  /**
   * Special rate limiting for doctor chat (more restrictive)
   */
  static getDoctorChatRateLimit() {
    const rateLimit = require('express-rate-limit');
    
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 30, // Limit to 30 requests per windowMs for doctor chat
      message: {
        success: false,
        error: 'Too many doctor chat requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
  }
}

module.exports = ChatbotValidationMiddleware;
