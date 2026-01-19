// controllers/DisputeController.js
const DisputeService = require('../services/disputeService');

class DisputeController {
  constructor() {
    this.disputeService = new DisputeService();
  }

  async getDisputes(req, res) {
    try {
      const disputes = await this.disputeService.getAllDisputes();
      res.json({
        success: true,
        data: disputes,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getDispute(req, res) {
    try {
      const { id } = req.params;
      const dispute = await this.disputeService.getDisputeById(id);
      res.json({
        success: true,
        data: dispute,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }


  async createDispute(req, res) {
    try {
      const {
        userId,
        transactionId,
        disputeType,
        description,
        screenshotUrl,
      } = req.body;

      // Validation
      if (!userId || !transactionId || !disputeType) {
        return res.status(400).json({
          success: false,
          message: 'User ID, transaction ID, and dispute type are required',
        });
      }

      const validDisputeTypes = [
        'incorrect_billing',
        'doctor_no_show',
        'poor_service_quality',
        'refund_request',
        'transaction_issues',
      ];

      if (!validDisputeTypes.includes(disputeType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid dispute type',
        });
      }

      const dispute = await this.disputeService.createDispute({
        userId,
        transactionId,
        disputeType,
        description,
        screenshotUrl,
      });

      res.status(201).json({
        success: true,
        data: dispute,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateDispute(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const dispute = await this.disputeService.updateDispute(id, updateData);
      res.json({
        success: true,
        data: dispute,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getUserDisputes(req, res) {
    try {
      const { userId } = req.params;
      const disputes = await this.disputeService.getUserDisputes(userId);
      res.json({
        success: true,
        data: disputes,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = DisputeController;