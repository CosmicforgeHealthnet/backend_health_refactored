// src/controllers/complianceController.js
const AuditComplianceReports = require('../services/auditComplianceReports');
const AdvancedAuditService = require('../services/advancedAuditService');

class ComplianceController {

  /**
   * Generate HIPAA compliance report
   * POST /api/compliance/hipaa-report
   */
  static async generateHIPAAReport(req, res) {
    try {
      const userId = req.user.sub;
      const { dateRange, filters = {} } = req.body;

      // Validate date range
      if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
        return res.status(400).json({
          success: false,
          error: 'Date range with startDate and endDate is required'
        });
      }

      const result = await AuditComplianceReports.generateComplianceReport(
        'hipaa',
        {
          startDate: new Date(dateRange.startDate),
          endDate: new Date(dateRange.endDate)
        },
        filters
      );

      // Log HIPAA report generation
      await AdvancedAuditService.logEvent({
        eventType: 'compliance_report',
        severity: 'medium',
        userId,
        eventDescription: 'Generated HIPAA compliance report',
        complianceFrameworks: ['hipaa'],
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          framework: 'hipaa',
          dateRange,
          totalRecords: result.totalRecords,
          complianceScore: result.report.complianceScore
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error generating HIPAA report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate HIPAA compliance report'
      });
    }
  }

  /**
   * Generate GDPR compliance report
   * POST /api/compliance/gdpr-report
   */
  static async generateGDPRReport(req, res) {
    try {
      const userId = req.user.sub;
      const { dateRange, filters = {} } = req.body;

      // Validate date range
      if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
        return res.status(400).json({
          success: false,
          error: 'Date range with startDate and endDate is required'
        });
      }

      const result = await AuditComplianceReports.generateComplianceReport(
        'gdpr',
        {
          startDate: new Date(dateRange.startDate),
          endDate: new Date(dateRange.endDate)
        },
        filters
      );

      // Log GDPR report generation
      await AdvancedAuditService.logEvent({
        eventType: 'compliance_report',
        severity: 'medium',
        userId,
        eventDescription: 'Generated GDPR compliance report',
        complianceFrameworks: ['gdpr'],
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          framework: 'gdpr',
          dateRange,
          totalRecords: result.totalRecords,
          dataSubjectRequests: result.report.summary.dataSubjectRequests
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error generating GDPR report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate GDPR compliance report'
      });
    }
  }

  /**
   * Generate FDA 21 CFR Part 11 compliance report
   * POST /api/compliance/fda-report
   */
  static async generateFDAReport(req, res) {
    try {
      const userId = req.user.sub;
      const { dateRange, filters = {} } = req.body;

      // Validate date range
      if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
        return res.status(400).json({
          success: false,
          error: 'Date range with startDate and endDate is required'
        });
      }

      const result = await AuditComplianceReports.generateComplianceReport(
        'fda_21cfr11',
        {
          startDate: new Date(dateRange.startDate),
          endDate: new Date(dateRange.endDate)
        },
        filters
      );

      // Log FDA report generation
      await AdvancedAuditService.logEvent({
        eventType: 'compliance_report',
        severity: 'medium',
        userId,
        eventDescription: 'Generated FDA 21 CFR Part 11 compliance report',
        complianceFrameworks: ['fda_21cfr11'],
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          framework: 'fda_21cfr11',
          dateRange,
          totalRecords: result.totalRecords,
          electronicRecords: result.report.summary.electronicRecordEvents
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error generating FDA report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate FDA 21 CFR Part 11 compliance report'
      });
    }
  }

  /**
   * Generate generic compliance report
   * POST /api/compliance/generic-report
   */
  static async generateGenericReport(req, res) {
    try {
      const userId = req.user.sub;
      const { dateRange, filters = {} } = req.body;

      // Validate date range
      if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
        return res.status(400).json({
          success: false,
          error: 'Date range with startDate and endDate is required'
        });
      }

      const result = await AuditComplianceReports.generateComplianceReport(
        'generic',
        {
          startDate: new Date(dateRange.startDate),
          endDate: new Date(dateRange.endDate)
        },
        filters
      );

      // Log generic report generation
      await AdvancedAuditService.logEvent({
        eventType: 'compliance_report',
        severity: 'low',
        userId,
        eventDescription: 'Generated generic compliance report',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          framework: 'generic',
          dateRange,
          totalRecords: result.totalRecords
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error generating generic report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate generic compliance report'
      });
    }
  }

  /**
   * Run automated compliance monitoring
   * GET /api/compliance/monitoring
   */
  static async runAutomatedMonitoring(req, res) {
    try {
      const userId = req.user.sub;

      const result = await AuditComplianceReports.runComplianceMonitoring();

      // Log monitoring execution
      await AdvancedAuditService.logEvent({
        eventType: 'compliance_monitoring',
        severity: result.results.overallCompliance >= 90 ? 'low' : 'high',
        userId,
        eventDescription: 'Executed automated compliance monitoring',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          complianceScore: result.results.overallCompliance,
          criticalIssues: result.results.criticalIssues.length,
          checksPerformed: result.results.checks.length
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error running compliance monitoring:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to run automated compliance monitoring'
      });
    }
  }

  /**
   * Export audit logs for compliance
   * POST /api/compliance/export-logs
   */
  static async exportAuditLogs(req, res) {
    try {
      const userId = req.user.sub;
      const { criteria, format = 'json' } = req.body;

      // Validate export criteria
      if (!criteria) {
        return res.status(400).json({
          success: false,
          error: 'Export criteria is required'
        });
      }

      // Validate format
      const validFormats = ['json', 'csv', 'xml'];
      if (!validFormats.includes(format.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: `Invalid format. Supported formats: ${validFormats.join(', ')}`
        });
      }

      const result = await AuditComplianceReports.exportAuditLogs(criteria, format);

      // Log export operation
      await AdvancedAuditService.logEvent({
        eventType: 'data_export',
        severity: 'high',
        userId,
        eventDescription: `Exported ${result.recordCount} audit logs in ${format} format`,
        dataExported: true,
        dataSize: Buffer.byteLength(result.data, 'utf8'),
        exportDestination: 'compliance_export',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          exportFormat: format,
          recordCount: result.recordCount,
          exportCriteria: criteria
        }
      });

      // Set appropriate headers for file download
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', Buffer.byteLength(result.data, 'utf8'));

      res.send(result.data);

    } catch (error) {
      console.error('Error exporting audit logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export audit logs'
      });
    }
  }

  /**
   * Generate executive summary report
   * GET /api/compliance/executive-summary?timeRange=30
   */
  static async generateExecutiveSummary(req, res) {
    try {
      const userId = req.user.sub;
      const { timeRange = 30 } = req.query;

      const result = await AuditComplianceReports.generateExecutiveSummary(parseInt(timeRange));

      // Log executive summary generation
      await AdvancedAuditService.logEvent({
        eventType: 'executive_summary_generated',
        severity: 'medium',
        userId,
        eventDescription: 'Generated executive compliance summary',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          timeRange: parseInt(timeRange),
          totalEvents: result.summary.keyMetrics.totalEvents,
          complianceScore: result.summary.complianceStatus.overallScore
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error generating executive summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate executive summary'
      });
    }
  }

  /**
   * Get compliance framework comparison
   * POST /api/compliance/framework-comparison
   */
  static async getFrameworkComparison(req, res) {
    try {
      const userId = req.user.sub;
      const { frameworks, dateRange } = req.body;

      // Validate input
      if (!frameworks || !Array.isArray(frameworks) || frameworks.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'At least 2 frameworks are required for comparison'
        });
      }

      if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
        return res.status(400).json({
          success: false,
          error: 'Date range is required'
        });
      }

      const comparison = {};
      const filters = {};

      // Generate reports for each framework
      for (const framework of frameworks) {
        try {
          const result = await AuditComplianceReports.generateComplianceReport(
            framework,
            {
              startDate: new Date(dateRange.startDate),
              endDate: new Date(dateRange.endDate)
            },
            filters
          );
          comparison[framework] = result.report;
        } catch (error) {
          console.error(`Error generating ${framework} report:`, error);
          comparison[framework] = { error: `Failed to generate ${framework} report` };
        }
      }

      // Log framework comparison
      await AdvancedAuditService.logEvent({
        eventType: 'compliance_framework_comparison',
        severity: 'medium',
        userId,
        eventDescription: `Generated compliance comparison for frameworks: ${frameworks.join(', ')}`,
        complianceFrameworks: frameworks,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          frameworks,
          dateRange,
          comparisonGenerated: new Date()
        }
      });

      res.json({
        success: true,
        comparison,
        frameworks,
        dateRange,
        generatedAt: new Date()
      });

    } catch (error) {
      console.error('Error generating framework comparison:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate framework comparison'
      });
    }
  }

  /**
   * Get compliance trends over time
   * POST /api/compliance/trends
   */
  static async getComplianceTrends(req, res) {
    try {
      const userId = req.user.sub;
      const { framework, startDate, endDate, intervalType = 'monthly' } = req.body;

      // Validate input
      if (!framework || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Framework, start date, and end date are required'
        });
      }

      const validIntervals = ['daily', 'weekly', 'monthly'];
      if (!validIntervals.includes(intervalType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid interval type. Supported: ${validIntervals.join(', ')}`
        });
      }

      // Generate trend data by splitting date range into intervals
      const trends = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Calculate interval duration
      let intervalDays;
      switch (intervalType) {
        case 'daily': intervalDays = 1; break;
        case 'weekly': intervalDays = 7; break;
        case 'monthly': intervalDays = 30; break;
      }

      let currentStart = new Date(start);
      while (currentStart < end) {
        const currentEnd = new Date(currentStart);
        currentEnd.setDate(currentEnd.getDate() + intervalDays);
        
        if (currentEnd > end) {
          currentEnd.setTime(end.getTime());
        }

        try {
          const result = await AuditComplianceReports.generateComplianceReport(
            framework,
            {
              startDate: currentStart,
              endDate: currentEnd
            },
            {}
          );

          trends.push({
            period: {
              start: new Date(currentStart),
              end: new Date(currentEnd)
            },
            complianceScore: result.report.complianceScore || 0,
            totalRecords: result.totalRecords,
            summary: result.report.summary
          });
        } catch (error) {
          console.error(`Error generating trend data for ${currentStart}:`, error);
        }

        currentStart.setDate(currentStart.getDate() + intervalDays);
      }

      // Log trends analysis
      await AdvancedAuditService.logEvent({
        eventType: 'compliance_trends_analysis',
        severity: 'low',
        userId,
        eventDescription: `Generated ${framework} compliance trends analysis`,
        complianceFrameworks: [framework],
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          framework,
          intervalType,
          periodsAnalyzed: trends.length,
          dateRange: { startDate, endDate }
        }
      });

      res.json({
        success: true,
        trends,
        framework,
        intervalType,
        totalPeriods: trends.length,
        overallTrend: this.calculateOverallTrend(trends),
        generatedAt: new Date()
      });

    } catch (error) {
      console.error('Error generating compliance trends:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate compliance trends'
      });
    }
  }

  /**
   * Get compliance dashboard summary
   * GET /api/compliance/dashboard?frameworks=hipaa,gdpr&timeRange=30
   */
  static async getComplianceDashboard(req, res) {
    try {
      const userId = req.user.sub;
      const { 
        frameworks = 'hipaa,gdpr,fda_21cfr11',
        timeRange = 30 
      } = req.query;

      const frameworkList = frameworks.split(',').map(f => f.trim());
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange));

      const dashboard = {
        summary: {
          timeRange: parseInt(timeRange),
          frameworks: frameworkList,
          generatedAt: new Date()
        },
        frameworkStatus: {},
        overallMetrics: {
          totalEvents: 0,
          averageComplianceScore: 0,
          criticalIssues: 0,
          recommendationsCount: 0
        },
        recentActivity: [],
        topIssues: []
      };

      // Generate summary for each framework
      let totalComplianceScore = 0;
      let validFrameworks = 0;

      for (const framework of frameworkList) {
        try {
          const result = await AuditComplianceReports.generateComplianceReport(
            framework,
            { startDate, endDate },
            {}
          );

          dashboard.frameworkStatus[framework] = {
            complianceScore: result.report.complianceScore || 0,
            totalRecords: result.totalRecords,
            status: this.getComplianceStatus(result.report.complianceScore || 0),
            lastUpdated: new Date(),
            keyMetrics: this.extractKeyMetrics(result.report, framework)
          };

          // Aggregate metrics
          dashboard.overallMetrics.totalEvents += result.totalRecords;
          totalComplianceScore += (result.report.complianceScore || 0);
          validFrameworks++;

          // Collect recommendations
          if (result.report.recommendations) {
            dashboard.overallMetrics.recommendationsCount += result.report.recommendations.length;
          }

        } catch (error) {
          console.error(`Error getting ${framework} dashboard data:`, error);
          dashboard.frameworkStatus[framework] = {
            error: `Failed to load ${framework} data`,
            status: 'error'
          };
        }
      }

      // Calculate overall metrics
      if (validFrameworks > 0) {
        dashboard.overallMetrics.averageComplianceScore = Math.round(totalComplianceScore / validFrameworks);
      }

      // Get recent compliance monitoring results
      try {
        const monitoringResult = await AuditComplianceReports.runComplianceMonitoring();
        dashboard.overallMetrics.criticalIssues = monitoringResult.results.criticalIssues.length;
        dashboard.recentActivity = monitoringResult.results.checks.slice(0, 10);
      } catch (error) {
        console.error('Error getting monitoring data:', error);
      }

      // Log dashboard access
      await AdvancedAuditService.logEvent({
        eventType: 'compliance_dashboard_access',
        severity: 'low',
        userId,
        eventDescription: 'User accessed compliance dashboard',
        complianceFrameworks: frameworkList,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          frameworks: frameworkList,
          timeRange: parseInt(timeRange),
          overallScore: dashboard.overallMetrics.averageComplianceScore
        }
      });

      res.json({
        success: true,
        dashboard
      });

    } catch (error) {
      console.error('Error getting compliance dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get compliance dashboard'
      });
    }
  }

  /**
   * Validate compliance configuration
   * POST /api/compliance/validate-config
   */
  static async validateComplianceConfig(req, res) {
    try {
      const userId = req.user.sub;
      const { framework, configuration } = req.body;

      // Validate input
      if (!framework || !configuration) {
        return res.status(400).json({
          success: false,
          error: 'Framework and configuration are required'
        });
      }

      const validation = {
        framework,
        isValid: true,
        issues: [],
        warnings: [],
        recommendations: []
      };

      // Framework-specific validation
      switch (framework.toLowerCase()) {
        case 'hipaa':
          this.validateHIPAAConfig(configuration, validation);
          break;
        case 'gdpr':
          this.validateGDPRConfig(configuration, validation);
          break;
        case 'fda_21cfr11':
          this.validateFDAConfig(configuration, validation);
          break;
        default:
          validation.warnings.push(`Unknown framework: ${framework}`);
      }

      // Log configuration validation
      await AdvancedAuditService.logEvent({
        eventType: 'compliance_config_validation',
        severity: validation.isValid ? 'low' : 'medium',
        userId,
        eventDescription: `Validated ${framework} compliance configuration`,
        complianceFrameworks: [framework],
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          framework,
          isValid: validation.isValid,
          issueCount: validation.issues.length,
          warningCount: validation.warnings.length
        }
      });

      res.json({
        success: true,
        validation
      });

    } catch (error) {
      console.error('Error validating compliance configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate compliance configuration'
      });
    }
  }

  /**
   * Get compliance metrics over time
   * GET /api/compliance/metrics?framework=hipaa&days=90
   */
  static async getComplianceMetrics(req, res) {
    try {
      const userId = req.user.sub;
      const { 
        framework = 'hipaa',
        days = 30
      } = req.query;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      // Get compliance metrics
      const result = await AuditComplianceReports.generateComplianceReport(
        framework,
        { startDate, endDate },
        {}
      );

      // Get historical data for trend analysis
      const metrics = {
        framework,
        period: {
          startDate,
          endDate,
          days: parseInt(days)
        },
        currentScore: result.report.complianceScore || 0,
        totalRecords: result.totalRecords,
        summary: result.report.summary,
        trends: await this.getMetricsTrends(framework, startDate, endDate),
        breakdown: this.getComplianceBreakdown(result.report, framework),
        recommendations: result.report.recommendations || []
      };

      // Log metrics access
      await AdvancedAuditService.logEvent({
        eventType: 'compliance_metrics_access',
        severity: 'low',
        userId,
        eventDescription: `User accessed ${framework} compliance metrics`,
        complianceFrameworks: [framework],
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          framework,
          days: parseInt(days),
          complianceScore: metrics.currentScore
        }
      });

      res.json({
        success: true,
        metrics
      });

    } catch (error) {
      console.error('Error getting compliance metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get compliance metrics'
      });
    }
  }

  // Helper methods

  /**
   * Calculate overall trend from trend data
   */
  static calculateOverallTrend(trends) {
    if (trends.length < 2) return 'insufficient_data';

    const firstScore = trends[0].complianceScore;
    const lastScore = trends[trends.length - 1].complianceScore;
    const change = lastScore - firstScore;

    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  }

  /**
   * Get compliance status based on score
   */
  static getComplianceStatus(score) {
    if (score >= 95) return 'excellent';
    if (score >= 85) return 'good';
    if (score >= 70) return 'acceptable';
    if (score >= 50) return 'needs_improvement';
    return 'critical';
  }

  /**
   * Extract key metrics for dashboard
   */
  static extractKeyMetrics(report, framework) {
    const metrics = {};

    switch (framework) {
      case 'hipaa':
        metrics.patientDataAccesses = report.summary?.patientDataAccesses || 0;
        metrics.consentViolations = report.summary?.consentViolations || 0;
        metrics.emergencyAccesses = report.summary?.emergencyAccesses || 0;
        break;
      case 'gdpr':
        metrics.dataSubjectRequests = report.summary?.dataSubjectRequests || 0;
        metrics.dataExports = report.summary?.dataExports || 0;
        metrics.consentWithdrawals = report.summary?.consentWithdrawals || 0;
        break;
      case 'fda_21cfr11':
        metrics.electronicRecords = report.summary?.electronicRecordEvents || 0;
        metrics.digitalSignatures = report.summary?.digitalSignatureEvents || 0;
        metrics.systemChanges = report.summary?.systemChanges || 0;
        break;
    }

    return metrics;
  }

  /**
   * Validate HIPAA configuration
   */
  static validateHIPAAConfig(config, validation) {
    // Check required HIPAA settings
    if (!config.consentVerification) {
      validation.issues.push('Consent verification must be enabled for HIPAA compliance');
      validation.isValid = false;
    }

    if (!config.minimumNecessary) {
      validation.issues.push('Minimum necessary standard must be enforced');
      validation.isValid = false;
    }

    if (!config.auditLogging) {
      validation.issues.push('Comprehensive audit logging is required');
      validation.isValid = false;
    }

    if (!config.dataEncryption) {
      validation.warnings.push('Data encryption is strongly recommended');
    }

    if (config.dataRetentionDays && config.dataRetentionDays < 2555) { // 7 years
      validation.warnings.push('HIPAA recommends retaining medical records for at least 7 years');
    }
  }

  /**
   * Validate GDPR configuration
   */
  static validateGDPRConfig(config, validation) {
    // Check required GDPR settings
    if (!config.consentManagement) {
      validation.issues.push('Explicit consent management is required for GDPR');
      validation.isValid = false;
    }

    if (!config.rightToErasure) {
      validation.issues.push('Right to erasure (right to be forgotten) must be implemented');
      validation.isValid = false;
    }

    if (!config.dataPortability) {
      validation.warnings.push('Data portability features should be implemented');
    }

    if (!config.privacyByDesign) {
      validation.recommendations.push('Implement privacy by design principles');
    }
  }

  /**
   * Validate FDA 21 CFR Part 11 configuration
   */
  static validateFDAConfig(config, validation) {
    // Check required FDA settings
    if (!config.digitalSignatures) {
      validation.issues.push('Digital signatures are required for FDA 21 CFR Part 11');
      validation.isValid = false;
    }

    if (!config.auditTrails) {
      validation.issues.push('Comprehensive audit trails are mandatory');
      validation.isValid = false;
    }

    if (!config.userAuthentication) {
      validation.issues.push('Strong user authentication is required');
      validation.isValid = false;
    }

    if (!config.recordIntegrity) {
      validation.warnings.push('Record integrity controls should be implemented');
    }
  }

  /**
   * Get metrics trends (simplified implementation)
   */
  static async getMetricsTrends(framework, startDate, endDate) {
    // This would implement actual trend calculation
    // For now, return placeholder data
    return {
      trend: 'stable',
      change: 0,
      period: 'last_30_days'
    };
  }

  /**
   * Get compliance breakdown by category
   */
  static getComplianceBreakdown(report, framework) {
    const breakdown = {};

    if (report.summary) {
      Object.keys(report.summary).forEach(key => {
        if (typeof report.summary[key] === 'number') {
          breakdown[key] = report.summary[key];
        }
      });
    }

    return breakdown;
  }
}

module.exports = ComplianceController;