// controllers/ReportController.js
const ReportService = require('../services/reportService');

class ReportController {
  constructor() {
    this.reportService = new ReportService();
  }

  async getReports(req, res) {
    try {
      const reports = await this.reportService.getAllReports();
      res.json({
        success: true,
        data: reports,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getReport(req, res) {
    try {
      const { id } = req.params;
      const report = await this.reportService.getReportById(id);
      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  async createReport(req, res) {
    try {
      const {
        userId,
        providerId,
        providerType,
        issueType,
        description,
        screenshotUrl,
      } = req.body;

      // Validation
      if (!userId || !providerId || !providerType || !issueType) {
        return res.status(400).json({
          success: false,
          message: 'User ID, provider ID, provider type, and issue type are required',
        });
      }

      const validProviderTypes = ['healthcare_provider', 'lab', 'pharmacy'];
      if (!validProviderTypes.includes(providerType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid provider type',
        });
      }

      const validIssueTypes = [
        'unprofessional_behavior',
        'harassment_verbal_abuse',
        'medical_negligence',
        'fraud_fake_profile',
        'wrong_diagnosis',
        'appointment_issues',
        'prescription_error',
        'privacy_violation',
        'wrong_lab_result',
        'lab_misconduct',
        'pharmacy_misconduct',
      ];

      if (!validIssueTypes.includes(issueType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid issue type',
        });
      }

      const report = await this.reportService.createReport({
        userId,
        providerId,
        providerType,
        issueType,
        description,
        screenshotUrl,
      });

      res.status(201).json({
        success: true,
        data: report,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateReport(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const report = await this.reportService.updateReport(id, updateData);
      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getUserReports(req, res) {
    try {
      const { userId } = req.params;
      const reports = await this.reportService.getUserReports(userId);
      res.json({
        success: true,
        data: reports,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = ReportController;