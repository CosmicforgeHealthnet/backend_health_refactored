// controllers/InsuranceController.js
const InsuranceService = require("../services/insuranceService");

class InsuranceController {
  constructor() {
    this.insuranceService = new InsuranceService();
  }

  async getInsuranceTickets(req, res) {
    try {
      const tickets = await this.insuranceService.getAllInsuranceTickets();
      res.json({
        success: true,
        data: tickets,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getInsuranceTicket(req, res) {
    try {
      const { id } = req.params;
      const ticket = await this.insuranceService.getInsuranceTicketById(id);
      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  async createInsuranceTicket(req, res) {
    try {
      const {
        userId,
        issueType,
        insuranceProviderName,
        policyNumber,
        serviceAffected,
        description,
        screenshotUrl,
      } = req.body;

      // Validation
      if (!userId || !issueType) {
        return res.status(400).json({
          success: false,
          message: 'User ID and issue type are required',
        });
      }

      const validIssueTypes = [
        'insurance_not_recognized',
        'policy_details_incorrect',
        'claim_status_delay',
        'coverage_rejected',
        'upload_document_error',
        'wrong_billing',
      ];

      if (!validIssueTypes.includes(issueType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid issue type',
        });
      }

      const ticket = await this.insuranceService.createInsuranceTicket({
        userId,
        issueType,
        insuranceProviderName,
        policyNumber,
        serviceAffected,
        description,
        screenshotUrl,
      });

      res.status(201).json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateInsuranceTicket(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const ticket = await this.insuranceService.updateInsuranceTicket(id, updateData);
      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getUserInsuranceTickets(req, res) {
    try {
      console.log(req.params);
      const { userId } = req.params;

      const tickets = await this.insuranceService.getUserInsuranceTickets(userId);
      res.json({
        success: true,
        data: tickets,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = InsuranceController;