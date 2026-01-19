// ===================================
// src/controllers/ReferralDrawController.js
// ===================================
const ReferralDrawService = require('../services/referralDrawService');

class ReferralDrawController {
  constructor() {
    this.drawService = new ReferralDrawService();
  }

  /**
   * Create new draw (Marketing Team)
   */
  async createDraw(req, res) {
    try {
      const { title, description, startDate, endDate, maxWinners } = req.body;
      const createdBy = req.user.sub;

      const draw = await this.drawService.createDraw({
        title,
        description,
        startDate,
        endDate,
        maxWinners
      }, createdBy);

      res.status(201).json({
        success: true,
        data: draw,
        message: 'Draw created successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Start a draw
   */
  async startDraw(req, res) {
    try {
      const { drawId } = req.params;
      const draw = await this.drawService.startDraw(drawId);

      res.json({
        success: true,
        data: draw,
        message: 'Draw started successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * End a draw
   */
  async endDraw(req, res) {
    try {
      const { drawId } = req.params;
      const result = await this.drawService.endDraw(drawId);

      res.json({
        success: true,
        data: result,
        message: 'Draw ended successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get all draws
   */
  async getAllDraws(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await this.drawService.getAllDraws(page, limit);

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
   * Get draw statistics
   */
  async getDrawStats(req, res) {
    try {
      const { drawId } = req.params;
      const stats = await this.drawService.getDrawStats(drawId);
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
}

module.exports = ReferralDrawController;