// ================================
// 5. RATE LIMITER MIDDLEWARE
// ================================

// src/middlewares/rateLimiter.js
const rateLimit = require('express-rate-limit');

class RateLimiterMiddleware {

    /**
   * Strict rate limiting for sensitive operations
   */
  static sensitive() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // Limit each user to 10 sensitive operations per hour
      message: {
        success: false,
        message: 'Too many sensitive operations. Please wait an hour before trying again.'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => `user:${req.user.sub}`
    });
  }
  /**
   * General API rate limiting
   */
  static general() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
  }

  /**
   * Payment operations rate limiting
   */
  static payments() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50, // Limit each IP to 50 payment requests per 15 minutes
      message: {
        success: false,
        message: 'Too many payment attempts. Please wait before trying again.'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        return req.user ? `user:${req.user.sub}` : req.ip;
      }
    });
  }

  /**
   * Withdrawal rate limiting
   */
  static withdrawals() {
    return rateLimit({
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      max: 100, // Limit each user to 3 withdrawal requests per day
      message: {
        success: false,
        message: 'Daily withdrawal limit reached. Please try again tomorrow.'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => `user:${req.user.sub}`
    });
  }
}

module.exports = RateLimiterMiddleware;