// services/ReportService.js
const ReportRepository = require('../repositories/ReportRepository');
const userRepository = require('../../auth/repositories/userRepository');

class ReportService {
  constructor() {
    this.reportRepository = new ReportRepository();
  }

  async getAllReports() {
    try {
      return await this.reportRepository.findAll();
    } catch (error) {
      throw new Error(`Failed to get reports: ${error.message}`);
    }
  }

  async getReportById(id) {
    try {
      const report = await this.reportRepository.findById(id);
      if (!report) {
        throw new Error('Report not found');
      }
      return report;
    } catch (error) {
      throw new Error(`Failed to get report: ${error.message}`);
    }
  }

  async createReport(reportData) {
    try {
      // Validate user exists
      const user = await userRepository.findById(reportData.userId);
      if (!user) {
        throw new Error('User not found');
      }


      return await this.reportRepository.create(reportData);
    } catch (error) {
      throw new Error(`Failed to create report: ${error.message}`);
    }
  }

  async updateReport(id, reportData) {
    try {
      const report = await this.reportRepository.findById(id);
      if (!report) {
        throw new Error('Report not found');
      }

      return await this.reportRepository.update(id, reportData);
    } catch (error) {
      throw new Error(`Failed to update report: ${error.message}`);
    }
  }

  async getUserReports(userId) {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return await this.reportRepository.findByUserId(userId);
    } catch (error) {
      throw new Error(`Failed to get user reports: ${error.message}`);
    }
  }
}

module.exports = ReportService;