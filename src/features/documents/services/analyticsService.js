// src/services/analyticsService.js
const AccessLogRepository = require('../repositories/accessLogRepository');
const DocumentFolderRepository = require('../repositories/documentFolderRepository');
const DocumentFileRepository = require('../repositories/documentFileRepository');

class AnalyticsService {

  /**
   * Get comprehensive user analytics dashboard
   */
  static async getUserDashboard(userId, days = 30) {
    try {
      const [
        activitySummary,
        accessStats,
        folderStats,
        fileStats,
        recentActivity
      ] = await Promise.all([
        AccessLogRepository.getUserActivitySummary(userId, days),
        AccessLogRepository.getAccessStats(userId, 'both', days),
        this.getFolderAnalytics(userId),
        DocumentFileRepository.getFileStats(userId),
        this.getRecentActivity(userId, 10)
      ]);

      return {
        success: true,
        dashboard: {
          period: `${days} days`,
          activitySummary,
          accessStats,
          folderStats,
          fileStats,
          recentActivity,
          generatedAt: new Date()
        }
      };

    } catch (error) {
      throw new Error(`Failed to get user dashboard: ${error.message}`);
    }
  }

  /**
   * Get file analytics
   */
  static async getFileAnalytics(userId, days = 30) {
    try {
      const [fileStats, recentFiles] = await Promise.all([
        DocumentFileRepository.getFileStats(userId),
        DocumentFileRepository.getRecentFiles(userId, 50)
      ]);

      const analytics = {
        ...fileStats,
        documentTypeDistribution: {},
        mimeTypeDistribution: {},
        uploadTrends: {},
        averageFileSize: 0
      };

      if (recentFiles.length > 0) {
        // Document type distribution
        recentFiles.forEach(file => {
          const docType = file.documentType || 'unknown';
          analytics.documentTypeDistribution[docType] = 
            (analytics.documentTypeDistribution[docType] || 0) + 1;
        });

        // MIME type distribution
        recentFiles.forEach(file => {
          const mimeType = file.mimeType || 'unknown';
          analytics.mimeTypeDistribution[mimeType] = 
            (analytics.mimeTypeDistribution[mimeType] || 0) + 1;
        });

        // Upload trends (by day)
        recentFiles.forEach(file => {
          const date = new Date(file.createdAt).toDateString();
          analytics.uploadTrends[date] = (analytics.uploadTrends[date] || 0) + 1;
        });

        // Average file size
        const totalSize = recentFiles.reduce((sum, file) => sum + parseInt(file.fileSize), 0);
        analytics.averageFileSize = Math.round(totalSize / recentFiles.length);
      }

      return {
        success: true,
        analytics: analytics
      };

    } catch (error) {
      throw new Error(`Failed to get file analytics: ${error.message}`);
    }
  }

  /**
   * Get access analytics
   */
  static async getAccessAnalytics(userId, days = 7) {
    try {
      const accessStats = await AccessLogRepository.getAccessStats(userId, 'both', days);
      const suspiciousActivity = await AccessLogRepository.getSuspiciousActivity(userId, 24);

      return {
        success: true,
        analytics: {
          period: `${days} days`,
          accessStats,
          suspiciousActivity,
          securityScore: this.calculateSecurityScore(accessStats, suspiciousActivity)
        }
      };

    } catch (error) {
      throw new Error(`Failed to get access analytics: ${error.message}`);
    }
  }

  /**
   * Get recent activity feed
   */
  static async getRecentActivity(userId, limit = 20) {
    try {
      // This would need to be implemented with a unified activity log
      // For now, we'll simulate it with recent files and folders
      const [recentFiles, recentFolders] = await Promise.all([
        DocumentFileRepository.getRecentFiles(userId, limit / 2),
        DocumentFolderRepository.getRecentFolders(userId, limit / 2)
      ]);

      const activities = [];

      // Add file activities
      recentFiles.forEach(file => {
        activities.push({
          type: 'file',
          action: 'uploaded',
          resource: {
            id: file.id,
            name: file.originalFileName,
            documentType: file.documentType
          },
          timestamp: file.createdAt
        });
      });

      // Add folder activities
      recentFolders.forEach(folder => {
        activities.push({
          type: 'folder',
          action: 'updated',
          resource: {
            id: folder.id,
            name: folder.name,
            folderType: folder.folderType
          },
          timestamp: folder.updatedAt
        });
      });

      // Sort by timestamp (most recent first)
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return activities.slice(0, limit);

    } catch (error) {
      throw new Error(`Failed to get recent activity: ${error.message}`);
    }
  }

  /**
   * Get storage usage analytics
   */
  static async getStorageAnalytics(userId) {
    try {
      const fileStats = await DocumentFileRepository.getFileStats(userId);
      const folders = await DocumentFolderRepository.getUserFolders(userId, { limit: 1000 });

      // Calculate storage by folder type
      const storageByFolderType = {};
      const storageByDocumentType = {};

      for (const folder of folders.folders) {
        if (folder.files) {
          const folderSize = folder.files.reduce((sum, file) => sum + parseInt(file.fileSize), 0);
          
          if (!storageByFolderType[folder.folderType]) {
            storageByFolderType[folder.folderType] = 0;
          }
          storageByFolderType[folder.folderType] += folderSize;

          // Group by document type
          folder.files.forEach(file => {
            const docType = file.documentType || 'unknown';
            if (!storageByDocumentType[docType]) {
              storageByDocumentType[docType] = 0;
            }
            storageByDocumentType[docType] += parseInt(file.fileSize);
          });
        }
      }

      return {
        success: true,
        storage: {
          totalSize: fileStats.totalSize,
          totalSizeFormatted: this.formatFileSize(fileStats.totalSize),
          totalFiles: fileStats.totalFiles,
          encryptedFiles: fileStats.encryptedFiles,
          encryptionPercentage: fileStats.totalFiles > 0 ? 
            Math.round((fileStats.encryptedFiles / fileStats.totalFiles) * 100) : 0,
          storageByFolderType,
          storageByDocumentType,
          averageFileSize: fileStats.totalFiles > 0 ? 
            Math.round(fileStats.totalSize / fileStats.totalFiles) : 0
        }
      };

    } catch (error) {
      throw new Error(`Failed to get storage analytics: ${error.message}`);
    }
  }

  /**
   * Get security analytics
   */
  static async getSecurityAnalytics(userId, days = 30) {
    try {
      const [accessStats, suspiciousActivity] = await Promise.all([
        AccessLogRepository.getAccessStats(userId, 'both', days),
        AccessLogRepository.getSuspiciousActivity(userId, days * 24)
      ]);

      const securityScore = this.calculateSecurityScore(accessStats, suspiciousActivity);
      
      return {
        success: true,
        security: {
          period: `${days} days`,
          securityScore,
          riskLevel: this.getRiskLevel(securityScore),
          accessStats,
          suspiciousActivity,
          recommendations: this.getSecurityRecommendations(securityScore, suspiciousActivity)
        }
      };

    } catch (error) {
      throw new Error(`Failed to get security analytics: ${error.message}`);
    }
  }

  /**
   * Generate analytics report
   */
  static async generateReport(userId, reportType = 'comprehensive', days = 30) {
    try {
      let reportData = {};

      switch (reportType) {
        case 'comprehensive':
          reportData = await this.getUserDashboard(userId, days);
          break;
        case 'storage':
          reportData = await this.getStorageAnalytics(userId);
          break;
        case 'security':
          reportData = await this.getSecurityAnalytics(userId, days);
          break;
        case 'activity':
          reportData = await this.getAccessAnalytics(userId, days);
          break;
        default:
          throw new Error('Invalid report type');
      }

      return {
        success: true,
        report: {
          type: reportType,
          period: `${days} days`,
          generatedAt: new Date(),
          userId,
          data: reportData
        }
      };

    } catch (error) {
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }

  // Helper methods

  /**
   * Calculate security score (0-100)
   */
  static calculateSecurityScore(accessStats, suspiciousActivity) {
    let score = 100;

    // Deduct points for suspicious activity
    if (suspiciousActivity.length > 0) {
      const highRiskCount = suspiciousActivity.filter(a => a.riskLevel === 'high').length;
      const mediumRiskCount = suspiciousActivity.filter(a => a.riskLevel === 'medium').length;
      
      score -= (highRiskCount * 20) + (mediumRiskCount * 10);
    }

    // Deduct points for excessive access patterns
    if (accessStats.files && accessStats.files.downloads > 1000) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get risk level based on security score
   */
  static getRiskLevel(securityScore) {
    if (securityScore >= 80) return 'low';
    if (securityScore >= 60) return 'medium';
    if (securityScore >= 40) return 'high';
    return 'critical';
  }

  /**
   * Get security recommendations
   */
  static getSecurityRecommendations(securityScore, suspiciousActivity) {
    const recommendations = [];

    if (securityScore < 60) {
      recommendations.push('Consider enabling two-factor authentication');
      recommendations.push('Review recent access logs for unusual activity');
    }

    if (suspiciousActivity.length > 0) {
      recommendations.push('Investigate suspicious download patterns');
      recommendations.push('Consider restricting access from unusual IP addresses');
    }

    if (recommendations.length === 0) {
      recommendations.push('Your account security looks good!');
    }

    return recommendations;
  }

  /**
   * Format file size
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get folder analytics
   */
  static async getFolderAnalytics(userId) {
    try {
      const folders = await DocumentFolderRepository.getUserFolders(userId, { limit: 1000 });

      const analytics = {
        totalFolders: folders.total,
        foldersByType: {},
        averageFilesPerFolder: 0,
        largestFolder: null,
        oldestFolder: null,
        newestFolder: null
      };

      if (folders.folders.length > 0) {
        // Group by folder type
        folders.folders.forEach(folder => {
          const type = folder.folderType;
          if (!analytics.foldersByType[type]) {
            analytics.foldersByType[type] = 0;
          }
          analytics.foldersByType[type]++;
        });

        // Calculate averages
        const totalFiles = folders.folders.reduce((sum, folder) => 
          sum + (folder.files ? folder.files.length : 0), 0);
        analytics.averageFilesPerFolder = Math.round(totalFiles / folders.folders.length);

        // Find largest folder
        analytics.largestFolder = folders.folders.reduce((largest, folder) => {
          const fileCount = folder.files ? folder.files.length : 0;
          const largestCount = largest && largest.files ? largest.files.length : 0;
          return fileCount > largestCount ? folder : largest;
        });

        // Find oldest and newest folders
        const sortedByDate = [...folders.folders].sort((a, b) => 
          new Date(a.createdAt) - new Date(b.createdAt));
        analytics.oldestFolder = sortedByDate[0];
        analytics.newestFolder = sortedByDate[sortedByDate.length - 1];
      }

      return {
        success: true,
        analytics: analytics
      };

    } catch (error) {
      throw new Error(`Failed to get folder analytics: ${error.message}`);
    }
  }
}

module.exports = AnalyticsService;