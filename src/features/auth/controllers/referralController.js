// ===================================
// src/controllers/ReferralController.js
// ===================================
const referralService = require('../services/referralService');

class ReferralController {

  /**
   * Get user's referral stats and link
   */
  async getUserReferralInfo(req, res) {
    try {
      const userId = req.user.sub;
      const stats = await referralService.getUserReferralStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get user's referral list
   */
  async getUserReferrals(req, res) {
    try {
      const userId = req.user.sub;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await referralService.getUserReferrals(userId, page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get current draw leaderboard
   */
  async getLeaderboard(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const activeDraw = await referralService.getActiveDraw();

      if (!activeDraw) {
        return res.json({
          success: true,
          data: {
            leaderboard: [],
            activeDraw: null,
            message: 'No active draw currently'
          }
        });
      }

      const leaderboard = await referralService.getDrawLeaderboard(activeDraw.id, limit);

      res.json({
        success: true,
        data: {
          leaderboard,
          activeDraw: {
            id: activeDraw.id,
            title: activeDraw.title,
            description: activeDraw.description,
            startDate: activeDraw.startDate,
            endDate: activeDraw.endDate,
            maxWinners: activeDraw.maxWinners
          }
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }


  /**
   * Get all draws visible to users
   */
  async getAllDrawsForUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status; // optional filter: 'active', 'ended', 'pending'

      const result = await referralService.getAllDrawsForUsers(page, limit, status);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get specific draw leaderboard
   */
  async getDrawLeaderboard(req, res) {
    try {
      const { drawId } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      const userId = req.user.sub;

      const result = await referralService.getSpecificDrawLeaderboard(drawId, limit, userId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get user's stats for specific draw
   */
  async getUserDrawStats(req, res) {
    try {
      const { drawId } = req.params;
      const userId = req.user.sub;

      const stats = await referralService.getUserDrawStats(drawId, userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }


  /**
   * Process referral code during signup
   */
  async processReferral(req, res) {
    try {
      const { referralCode } = req.body;
      const newUserId = req.user.sub;

      const referral = await referralService.processReferral(newUserId, referralCode);

      res.json({
        success: true,
        data: referral,
        message: referral ? 'Referral processed successfully' : 'No referral code provided'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Verify referral (called after user verification)
   */
  async verifyReferral(req, res) {
    try {
      const userId = req.user.sub;
      const referral = await referralService.verifyReferral(userId);

      res.json({
        success: true,
        data: referral,
        message: referral ? 'Referral verified successfully' : 'No pending referral found'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = ReferralController;