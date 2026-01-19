// src/controllers/analyticsController.js
const AnalyticsService = require('../services/analyticsService');

class AnalyticsController {

  /**
   * Get user dashboard analytics
   * GET /api/analytics/dashboard
   */
  static async getDashboard(req, res) {
    try {
      const userId = req.user.sub;
      const { days = 30 } = req.query;

      const result = await AnalyticsService.getUserDashboard(
        userId,
        parseInt(days)
      );

      res.json(result);

    } catch (error) {
      console.error('Error getting analytics dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analytics dashboard'
      });
    }
  }

  /**
   * Get user statistics overview
   * GET /api/analytics/overview
   */
  static async getOverview(req, res) {
    try {
      const userId = req.user.sub;

      // Get basic stats from different services
      const [folderAnalytics, storageAnalytics] = await Promise.all([
        AnalyticsService.getFolderAnalytics(userId),
        AnalyticsService.getStorageAnalytics(userId)
      ]);

      const overview = {
        folders: {
          total: folderAnalytics.totalFolders,
          byType: folderAnalytics.foldersByType,
          averageFiles: folderAnalytics.averageFilesPerFolder
        },
        storage: {
          totalSize: storageAnalytics.storage.totalSize,
          totalSizeFormatted: storageAnalytics.storage.totalSizeFormatted,
          totalFiles: storageAnalytics.storage.totalFiles,
          encryptedFiles: storageAnalytics.storage.encryptedFiles,
          encryptionPercentage: storageAnalytics.storage.encryptionPercentage
        },
        generatedAt: new Date()
      };

      res.json({
        success: true,
        overview
      });

    } catch (error) {
      console.error('Error getting overview:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get overview'
      });
    }
  }

  /**
   * Get storage analytics
   * GET /api/analytics/storage
   */
  static async getStorageAnalytics(req, res) {
    try {
      const userId = req.user.sub;

      const result = await AnalyticsService.getStorageAnalytics(userId);

      res.json(result);

    } catch (error) {
      console.error('Error getting storage analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get storage analytics'
      });
    }
  }

  /**
   * Get security analytics
   * GET /api/analytics/security
   */
  static async getSecurityAnalytics(req, res) {
    try {
      const userId = req.user.sub;
      const { days = 30 } = req.query;

      const result = await AnalyticsService.getSecurityAnalytics(
        userId,
        parseInt(days)
      );

      res.json(result);

    } catch (error) {
      console.error('Error getting security analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get security analytics'
      });
    }
  }

  /**
   * Get access analytics
   * GET /api/analytics/access
   */
  static async getAccessAnalytics(req, res) {
    try {
      const userId = req.user.sub;
      const { days = 7 } = req.query;

      const result = await AnalyticsService.getAccessAnalytics(
        userId,
        parseInt(days)
      );

      res.json(result);

    } catch (error) {
      console.error('Error getting access analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get access analytics'
      });
    }
  }

  /**
   * Get file analytics
   * GET /api/analytics/files
   */
  static async getFileAnalytics(req, res) {
    try {
      const userId = req.user.sub;
      const { days = 30 } = req.query;

      const result = await AnalyticsService.getFileAnalytics(
        userId,
        parseInt(days)
      );

      res.json({
        success: true,
        analytics: result
      });

    } catch (error) {
      console.error('Error getting file analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get file analytics'
      });
    }
  }

  /**
   * Get folder analytics
   * GET /api/analytics/folders
   */
  static async getFolderAnalytics(req, res) {
    try {
      const userId = req.user.sub;

      const result = await AnalyticsService.getFolderAnalytics(userId);

      res.json({
        success: true,
        analytics: result
      });

    } catch (error) {
      console.error('Error getting folder analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get folder analytics'
      });
    }
  }

  /**
   * Get activity summary
   * GET /api/analytics/activity
   */
  static async getActivitySummary(req, res) {
    try {
      const userId = req.user.sub;
      const { limit = 20 } = req.query;

      const result = await AnalyticsService.getRecentActivity(
        userId,
        parseInt(limit)
      );

      res.json({
        success: true,
        activity: result
      });

    } catch (error) {
      console.error('Error getting activity summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get activity summary'
      });
    }
  }

  /**
   * Get download statistics
   * GET /api/analytics/downloads
   */
  static async getDownloadStats(req, res) {
    try {
      const userId = req.user.sub;
      const { days = 30 } = req.query;

      const accessStats = await AnalyticsService.getAccessAnalytics(
        userId,
        parseInt(days)
      );

      const downloadStats = {
        period: `${days} days`,
        totalDownloads: accessStats.analytics.accessStats.files?.downloads || 0,
        avgDownloadTime: accessStats.analytics.accessStats.files?.avgDownloadTime || 0,
        uniqueFiles: accessStats.analytics.accessStats.files?.uniqueFiles || 0,
        generatedAt: new Date()
      };

      res.json({
        success: true,
        downloads: downloadStats
      });

    } catch (error) {
      console.error('Error getting download stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get download statistics'
      });
    }
  }

  /**
   * Get usage trends
   * GET /api/analytics/trends
   */
  static async getUsageTrends(req, res) {
    try {
      const userId = req.user.sub;
      const { days = 30, metric = 'uploads' } = req.query;

      const activitySummary = await AnalyticsService.getUserDashboard(
        userId,
        parseInt(days)
      );

      const trends = {
        metric,
        period: `${days} days`,
        data: activitySummary.dashboard.activitySummary,
        generatedAt: new Date()
      };

      res.json({
        success: true,
        trends
      });

    } catch (error) {
      console.error('Error getting usage trends:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get usage trends'
      });
    }
  }

  /**
   * Get file type distribution
   * GET /api/analytics/file-types
   */
  static async getFileTypeDistribution(req, res) {
    try {
      const userId = req.user.sub;

      const fileAnalytics = await AnalyticsService.getFileAnalytics(userId);

      const distribution = {
        documentTypes: fileAnalytics.documentTypeDistribution || {},
        mimeTypes: fileAnalytics.mimeTypeDistribution || {},
        totalFiles: fileAnalytics.totalFiles || 0,
        generatedAt: new Date()
      };

      res.json({
        success: true,
        distribution
      });

    } catch (error) {
      console.error('Error getting file type distribution:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get file type distribution'
      });
    }
  }

  /**
   * Generate analytics report
   * POST /api/analytics/reports
   */
  static async generateReport(req, res) {
    try {
      const userId = req.user.sub;
      const {
        reportType = 'comprehensive',
        days = 30,
        format = 'json'
      } = req.body;

      // Validate report type
      const validReportTypes = ['comprehensive', 'storage', 'security', 'activity'];
      if (!validReportTypes.includes(reportType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid report type. Valid types: ' + validReportTypes.join(', ')
        });
      }

      const result = await AnalyticsService.generateReport(
        userId,
        reportType,
        parseInt(days)
      );

      if (format === 'json') {
        res.json(result);
      } else {
        res.status(400).json({
          success: false,
          error: 'Only JSON format is currently supported'
        });
      }

    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report'
      });
    }
  }

  /**
   * Export analytics data
   * GET /api/analytics/export
   */
  static async exportAnalytics(req, res) {
    try {
      const userId = req.user.sub;
      const { 
        type = 'comprehensive',
        days = 30,
        format = 'json'
      } = req.query;

      const report = await AnalyticsService.generateReport(
        userId,
        type,
        parseInt(days)
      );

      if (format === 'json') {
        // Set download headers
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${type}-${Date.now()}.json"`);
        
        res.json(report);
      } else {
        res.status(400).json({
          success: false,
          error: 'Only JSON format is currently supported'
        });
      }

    } catch (error) {
      console.error('Error exporting analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export analytics'
      });
    }
  }
}

module.exports = AnalyticsController;