// src/controllers/auditController.js
const AdvancedAuditService = require('../services/advancedAuditService');
const AuditAnomalyDetection = require('../services/auditAnomalyDetection');
const AdvancedAuditRepository = require('../repositories/advancedAuditRepository');

class AuditController {

  /**
   * Search audit logs with advanced filtering
   * POST /api/audit/search
   */
  static async searchLogs(req, res) {
    try {
      const userId = req.user.sub;
      const searchCriteria = req.body;
      const options = {
        page: parseInt(req.body.page || 1),
        limit: parseInt(req.body.limit || 100),
        sortBy: req.body.sortBy || 'eventTimestamp',
        sortOrder: req.body.sortOrder || 'DESC'
      };

      // Validate search criteria
      const allowedFields = [
        'eventTypes', 'patientIdentifier', 'userId', 'severity', 'dateRange',
        'ipAddress', 'outcome', 'emergencyAccess', 'riskScoreMin', 'complianceFramework',
        'searchText', 'fhirResourceType', 'dataExported'
      ];

      const filteredCriteria = {};
      allowedFields.forEach(field => {
        if (searchCriteria[field] !== undefined) {
          filteredCriteria[field] = searchCriteria[field];
        }
      });

      const result = await AdvancedAuditService.searchAuditLogs(filteredCriteria, options);

      // Log the search operation
      await AdvancedAuditService.logEvent({
        eventType: 'audit_log_search',
        severity: 'low',
        userId,
        eventDescription: 'User searched audit logs',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          searchCriteria: filteredCriteria,
          resultCount: result.auditLogs.length
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error searching audit logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search audit logs'
      });
    }
  }

  /**
   * Get audit statistics and trends
   * GET /api/audit/statistics?timeRange=30
   */
  static async getStatistics(req, res) {
    try {
      const userId = req.user.sub;
      const { timeRange = 30 } = req.query;

      const result = await AdvancedAuditService.getAuditStatistics(parseInt(timeRange));

      // Log statistics access
      await AdvancedAuditService.logEvent({
        eventType: 'audit_statistics_access',
        severity: 'low',
        userId,
        eventDescription: 'User accessed audit statistics',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { timeRange: parseInt(timeRange) }
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting audit statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get audit statistics'
      });
    }
  }

  /**
   * Detect audit anomalies and security incidents
   * GET /api/audit/anomalies?timeWindow=24
   */
  static async detectAnomalies(req, res) {
    try {
      const userId = req.user.sub;
      const { timeWindow = 24 } = req.query;

      const result = await AuditAnomalyDetection.detectAnomalies(parseInt(timeWindow));

      // Log anomaly detection
      await AdvancedAuditService.logEvent({
        eventType: 'anomaly_detection_requested',
        severity: result.anomalies.length > 0 ? 'high' : 'low',
        userId,
        eventDescription: `Anomaly detection completed: ${result.anomalies.length} anomalies found`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          timeWindow: parseInt(timeWindow),
          anomaliesFound: result.anomalies.length
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error detecting anomalies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect anomalies'
      });
    }
  }

  /**
   * Generate security intelligence report
   * GET /api/audit/security-intelligence?timeWindow=24
   */
  static async generateSecurityIntelligence(req, res) {
    try {
      const userId = req.user.sub;
      const { timeWindow = 24 } = req.query;

      const result = await AuditAnomalyDetection.generateSecurityIntelligence(parseInt(timeWindow));

      // Log intelligence generation
      await AdvancedAuditService.logEvent({
        eventType: 'security_intelligence_generated',
        severity: 'medium',
        userId,
        eventDescription: 'Security intelligence report generated',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          timeWindow: parseInt(timeWindow),
          threatLevel: result.intelligence.threatLevel
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error generating security intelligence:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate security intelligence'
      });
    }
  }

  /**
   * Verify audit log integrity
   * POST /api/audit/verify-integrity
   */
  static async verifyIntegrity(req, res) {
    try {
      const userId = req.user.sub;
      const { batchSize = 1000 } = req.body;

      const result = await AdvancedAuditService.verifyIntegrity(parseInt(batchSize));

      // Log integrity verification
      await AdvancedAuditService.logEvent({
        eventType: 'integrity_verification',
        severity: result.integrityReport.corruptedLogs > 0 ? 'high' : 'low',
        userId,
        eventDescription: 'Audit log integrity verification completed',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          integrityPercentage: result.integrityReport.integrityPercentage,
          corruptedLogs: result.integrityReport.corruptedLogs
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error verifying integrity:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify audit log integrity'
      });
    }
  }

  /**
   * Get audit logs for specific patient
   * GET /api/audit/patient/:patientId?page=1&limit=50
   */
  static async getPatientAuditLogs(req, res) {
    try {
      const userId = req.user.sub;
      const { patientId } = req.params;
      const {
        page = 1,
        limit = 50,
        eventTypes,
        startDate,
        endDate,
        sortBy = 'eventTimestamp',
        sortOrder = 'DESC'
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        eventTypes: eventTypes ? eventTypes.split(',') : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        sortBy,
        sortOrder
      };

      const result = await AdvancedAuditRepository.getPatientAuditLogs(patientId, options);

      // Log patient audit access
      await AdvancedAuditService.logEvent({
        eventType: 'patient_audit_access',
        severity: 'medium',
        userId,
        patientIdentifier: patientId,
        eventDescription: 'User accessed patient audit logs',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          resultCount: result.logs.length,
          searchOptions: options
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting patient audit logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get patient audit logs'
      });
    }
  }

  /**
   * Get audit logs for specific user
   * GET /api/audit/user/:targetUserId?page=1&limit=50
   */
  static async getUserAuditLogs(req, res) {
    try {
      const userId = req.user.sub;
      const { targetUserId } = req.params;
      const {
        page = 1,
        limit = 50,
        eventTypes,
        startDate,
        endDate
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        eventTypes: eventTypes ? eventTypes.split(',') : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      };

      const result = await AdvancedAuditRepository.getUserAuditLogs(targetUserId, options);

      // Log user audit access
      await AdvancedAuditService.logEvent({
        eventType: 'user_audit_access',
        severity: 'medium',
        userId,
        eventDescription: `User accessed audit logs for user ${targetUserId}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          targetUserId,
          resultCount: result.logs.length
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting user audit logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user audit logs'
      });
    }
  }

  /**
   * Get high-risk events
   * GET /api/audit/high-risk?minRiskScore=80&timeRange=24
   */
  static async getHighRiskEvents(req, res) {
    try {
      const userId = req.user.sub;
      const {
        page = 1,
        limit = 50,
        minRiskScore = 80,
        timeRange = 24
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        minRiskScore: parseInt(minRiskScore),
        timeRange: parseInt(timeRange)
      };

      const result = await AdvancedAuditRepository.getHighRiskEvents(options);

      // Log high-risk event access
      await AdvancedAuditService.logEvent({
        eventType: 'high_risk_events_access',
        severity: 'medium',
        userId,
        eventDescription: 'User accessed high-risk events',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          minRiskScore: parseInt(minRiskScore),
          eventCount: result.events.length
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting high-risk events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get high-risk events'
      });
    }
  }

  /**
   * Get emergency access events
   * GET /api/audit/emergency-access?startDate=2024-01-01&endDate=2024-12-31
   */
  static async getEmergencyAccessEvents(req, res) {
    try {
      const userId = req.user.sub;
      const {
        page = 1,
        limit = 50,
        startDate,
        endDate
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      };

      const result = await AdvancedAuditRepository.getEmergencyAccessEvents(options);

      // Log emergency access review
      await AdvancedAuditService.logEvent({
        eventType: 'emergency_access_review',
        severity: 'medium',
        userId,
        eventDescription: 'User reviewed emergency access events',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          eventCount: result.events.length,
          dateRange: { startDate, endDate }
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting emergency access events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get emergency access events'
      });
    }
  }

  /**
   * Get failed access attempts
   * GET /api/audit/failed-attempts?timeRange=24
   */
  static async getFailedAccessAttempts(req, res) {
    try {
      const userId = req.user.sub;
      const {
        page = 1,
        limit = 50,
        timeRange = 24
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        timeRange: parseInt(timeRange)
      };

      const result = await AdvancedAuditRepository.getFailedAccessAttempts(options);

      // Log failed attempts review
      await AdvancedAuditService.logEvent({
        eventType: 'failed_attempts_review',
        severity: 'medium',
        userId,
        eventDescription: 'User reviewed failed access attempts',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          eventCount: result.events.length,
          timeRange: parseInt(timeRange)
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting failed access attempts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get failed access attempts'
      });
    }
  }

  /**
   * Get compliance-specific audit logs
   * GET /api/audit/compliance/:framework?startDate=2024-01-01&endDate=2024-12-31
   */
  static async getComplianceAuditLogs(req, res) {
    try {
      const userId = req.user.sub;
      const { framework } = req.params;
      const {
        page = 1,
        limit = 100,
        startDate,
        endDate
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      };

      const result = await AdvancedAuditRepository.getComplianceAuditLogs(framework, options);

      // Log compliance audit access
      await AdvancedAuditService.logEvent({
        eventType: 'compliance_audit_access',
        severity: 'medium',
        userId,
        eventDescription: `User accessed ${framework} compliance audit logs`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          framework,
          logCount: result.logs.length
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting compliance audit logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get compliance audit logs'
      });
    }
  }

  /**
   * Get logs requiring attention (dashboard summary)
   * GET /api/audit/requiring-attention?timeRange=24
   */
  static async getLogsRequiringAttention(req, res) {
    try {
      const userId = req.user.sub;
      const { timeRange = 24 } = req.query;

      const options = { timeRange: parseInt(timeRange) };
      const result = await AdvancedAuditRepository.getLogsRequiringAttention(options);

      // Log attention summary access
      await AdvancedAuditService.logEvent({
        eventType: 'attention_summary_access',
        severity: 'low',
        userId,
        eventDescription: 'User accessed logs requiring attention summary',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          timeRange: parseInt(timeRange),
          totalRequiringAttention: result.totalRequiringAttention
        }
      });

      res.json({
        success: true,
        summary: result
      });

    } catch (error) {
      console.error('Error getting logs requiring attention:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get logs requiring attention'
      });
    }
  }

  /**
   * Monitor user behavior patterns
   * GET /api/audit/user-behavior/:targetUserId?timeWindow=168
   */
  static async monitorUserBehavior(req, res) {
    try {
      const userId = req.user.sub;
      const { targetUserId } = req.params;
      const { timeWindow = 168 } = req.query; // 7 days default

      const result = await AuditAnomalyDetection.monitorUserBehavior(
        targetUserId, 
        parseInt(timeWindow)
      );

      // Log behavior monitoring
      await AdvancedAuditService.logEvent({
        eventType: 'user_behavior_monitoring',
        severity: result.riskLevel === 'high' ? 'high' : 'medium',
        userId,
        eventDescription: `User behavior analysis for ${targetUserId}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          targetUserId,
          riskLevel: result.riskLevel,
          deviationCount: result.deviations.length
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error monitoring user behavior:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to monitor user behavior'
      });
    }
  }
}

module.exports = AuditController;