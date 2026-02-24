// ===================================
// src/middlewares/referralMiddleware.js
// ===================================
const ReferralService = require('../services/referralService');
const User = require('../entities/User')
const AppDataSource = require("../../../config/database");



class ReferralMiddleware {
  constructor() {
    this.referralService = new ReferralService();
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Middleware to handle referral code storage in session
   */
  storeReferralCode(req, res, next) {
    try {
      const { ref } = req.query;

      if (ref) {
        // Store referral code in session for later use during signup
        req.session.referralCode = ref;

        // Also store in response headers for frontend to handle
        res.set('X-Referral-Code', ref);
      }

      next();
    } catch (error) {
      // Don't fail the request if referral code storage fails
      next();
    }
  }

  /**
   * Middleware to automatically create referral code for new users
   */
  async createReferralCode(req, res, next) {
    try {
      if (req.user && req.user.sub) {
        const userId = req.user.sub;

        // Check if user already has a referral code
        const existingCode = await this.userRepository.findOne({
          where: { id: userId },
          select: ['referralCode']
        });

        if (!existingCode?.referralCode) {
          await this.referralService.createUserReferralCode(userId);
        }
      }

      next();
    } catch (error) {
      console.error('Error creating referral code:', error);
      next(); // Don't fail the request
    }
  }

  /**
   * Middleware to automatically process referral on user signup
   */
  async processSignupReferral(req, res, next) {
    try {
      if (req.user && req.user.sub) {
        const userId = req.user.sub;
        const referralCode = req.session?.referralCode || req.body.referralCode;

        if (referralCode) {
          await this.referralService.processReferral(userId, referralCode);

          // Clear referral code from session
          if (req.session.referralCode) {
            delete req.session.referralCode;
          }
        }
      }

      next();
    } catch (error) {
      console.error('Error processing signup referral:', error);
      next(); // Don't fail the request
    }
  }

  /**
   * Middleware to automatically verify referral on user verification
   */
  async verifyUserReferral(req, res, next) {
    try {
      if (req.user && req.user.sub) {
        const userId = req.user.sub;
        await this.referralService.verifyReferral(userId);
      }
      next();
    } catch (error) {
      console.error('Error verifying referral:', error);
      next(); // Don't fail the request
    }
  }
}

module.exports = ReferralMiddleware;