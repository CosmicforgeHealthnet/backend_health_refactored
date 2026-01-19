// ================================
// 6. INPUT SANITIZER MIDDLEWARE
// ================================

// src/middlewares/sanitizer.js
const validator = require('validator');
const xss = require('xss');

class SanitizerMiddleware {
  /**
   * Sanitize input data
   */
  static sanitizeInput(req, res, next) {
    try {
      console.log('Original req.body:', req.body);
      req.body = SanitizerMiddleware.sanitizeObject(req.body);
      console.log('Sanitized req.body:', req.body);
      
      req.query = SanitizerMiddleware.sanitizeObject(req.query);
      req.params = SanitizerMiddleware.sanitizeObject(req.params);
      next();
    } catch (error) {
      console.error('Sanitizer error:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid input data'
      });
    }
  }

  /**
   * Recursively sanitize object
   */
  static sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return SanitizerMiddleware.sanitizeValue(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => SanitizerMiddleware.sanitizeObject(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = SanitizerMiddleware.sanitizeValue(key);
      sanitized[sanitizedKey] = SanitizerMiddleware.sanitizeObject(value);
    }

    return sanitized;
  }

  /**
   * Sanitize individual value
   */
  static sanitizeValue(value) {
    if (typeof value !== 'string') {
      return value;
    }

    try {
      // Remove XSS attempts - but use safer options
      value = xss(value, {
        whiteList: {},
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script'],
        allowCommentTag: false
      });

      // Trim whitespace
      value = validator.trim(value);

      return value;
    } catch (error) {
      // If XSS sanitization fails, just trim and return
      return validator.trim(value);
    }
  }

  /**
   * Validate and sanitize financial amounts
   */
  static sanitizeFinancialData(req, res, next) {
    const financialFields = ['amount', 'originalAmount', 'appointmentFee', 'serviceFee', 'vat', 'amountUsd'];
    
    for (const field of financialFields) {
      if (req.body[field] !== undefined) {
        const value = parseFloat(req.body[field]);
        
        if (isNaN(value) || value < 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${field}. Must be a positive number.`
          });
        }

        // Round to 2 decimal places for financial precision
        req.body[field] = Math.round(value * 100) / 100;
      }
    }

    next();
  }
}

module.exports = SanitizerMiddleware;