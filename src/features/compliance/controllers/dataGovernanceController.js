// src/controllers/dataGovernanceController.js
const DataGovernanceService = require('../services/dataGovernanceService');
const DataGovernanceRepository = require('../repositories/dataGovernanceRepository');
const AdvancedAuditService = require('../services/advancedAuditService');

class DataGovernanceController {

  /**
   * Get all governance policies
   * GET /api/governance/policies?page=1&limit=50&jurisdiction=us&framework=hipaa
   */
  static async getPolicies(req, res) {
    try {
      const userId = req.user.sub;
      const {
        page = 1,
        limit = 50,
        jurisdiction,
        complianceFramework
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        jurisdiction,
        complianceFramework
      };

      const result = await DataGovernanceRepository.getActivePolicies(options);

      // Log policy access
      await AdvancedAuditService.logEvent({
        eventType: 'governance_policies_access',
        severity: 'low',
        userId,
        eventDescription: 'User accessed governance policies',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          policyCount: result.policies.length,
          filters: { jurisdiction, complianceFramework }
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting governance policies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get governance policies'
      });
    }
  }

  /**
   * Create new governance policy
   * POST /api/governance/policies
   */
  static async createPolicy(req, res) {
    try {
      const userId = req.user.sub;
      const policyData = {
        ...req.body,
        policyOwner: userId,
        effectiveDate: req.body.effectiveDate || new Date()
      };

      // Validate required fields
      const requiredFields = ['policyName', 'policyType', 'policyDescription', 'policyRules'];
      const missingFields = requiredFields.filter(field => !policyData[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
      }

      const result = await DataGovernanceRepository.createPolicy(policyData);

      // Log policy creation
      await AdvancedAuditService.logEvent({
        eventType: 'governance_policy_created',
        severity: 'medium',
        userId,
        eventDescription: `Created governance policy: ${result.policyName}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          policyId: result.id,
          policyType: result.policyType,
          policyName: result.policyName
        }
      });

      res.status(201).json({
        success: true,
        message: 'Governance policy created successfully',
        policy: {
          id: result.id,
          policyName: result.policyName,
          policyType: result.policyType,
          effectiveDate: result.effectiveDate,
          policyStatus: result.policyStatus
        }
      });

    } catch (error) {
      console.error('Error creating governance policy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create governance policy'
      });
    }
  }

  /**
   * Get specific policy details
   * GET /api/governance/policies/:policyId
   */
  static async getPolicyDetails(req, res) {
    try {
      const userId = req.user.sub;
      const { policyId } = req.params;

      const policy = await DataGovernanceRepository.getPolicyById(policyId);

      if (!policy) {
        return res.status(404).json({
          success: false,
          error: 'Policy not found'
        });
      }

      // Log policy access
      await AdvancedAuditService.logEvent({
        eventType: 'governance_policy_access',
        severity: 'low',
        userId,
        eventDescription: `User accessed policy details: ${policy.policyName}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          policyId,
          policyType: policy.policyType
        }
      });

      res.json({
        success: true,
        policy
      });

    } catch (error) {
      console.error('Error getting policy details:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get policy details'
      });
    }
  }

  /**
   * Search governance policies
   * POST /api/governance/policies/search
   */
  static async searchPolicies(req, res) {
    try {
      const userId = req.user.sub;
      const searchCriteria = req.body;
      const options = {
        page: parseInt(req.body.page || 1),
        limit: parseInt(req.body.limit || 50),
        sortBy: req.body.sortBy || 'createdAt',
        sortOrder: req.body.sortOrder || 'DESC'
      };

      // Validate search criteria
      const allowedFields = [
        'policyName', 'policyType', 'policyStatus', 'jurisdiction',
        'complianceFramework', 'dataType', 'isAutomated', 'owner',
        'effectiveDateRange', 'searchText'
      ];

      const filteredCriteria = {};
      allowedFields.forEach(field => {
        if (searchCriteria[field] !== undefined) {
          filteredCriteria[field] = searchCriteria[field];
        }
      });

      const result = await DataGovernanceRepository.searchPolicies(filteredCriteria, options);

      // Log policy search
      await AdvancedAuditService.logEvent({
        eventType: 'governance_policy_search',
        severity: 'low',
        userId,
        eventDescription: 'User searched governance policies',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          searchCriteria: filteredCriteria,
          resultCount: result.policies.length
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error searching governance policies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search governance policies'
      });
    }
  }

  /**
   * Apply data retention policy
   * POST /api/governance/policies/:policyId/apply-retention
   */
  static async applyRetentionPolicy(req, res) {
    try {
      const userId = req.user.sub;
      const { policyId } = req.params;
      const { dryRun = true } = req.body;

      // First get retention candidates
      const candidates = await DataGovernanceRepository.getRetentionCandidates(policyId, true);

      if (dryRun) {
        // Log dry run
        await AdvancedAuditService.logEvent({
          eventType: 'retention_policy_dry_run',
          severity: 'low',
          userId,
          eventDescription: `Dry run for retention policy ${policyId}`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: {
            policyId,
            candidateCount: candidates.totalCandidates,
            retentionAction: candidates.retentionAction
          }
        });

        return res.json({
          success: true,
          dryRun: true,
          candidates: candidates.candidates,
          totalCandidates: candidates.totalCandidates,
          retentionAction: candidates.retentionAction,
          policyName: candidates.policyName
        });
      }

      // Apply retention policy
      const candidateIds = candidates.candidates.map(c => c.fileId);
      const result = await DataGovernanceRepository.applyRetentionPolicy(policyId, candidateIds, userId);

      // Log retention policy application
      await AdvancedAuditService.logEvent({
        eventType: 'retention_policy_applied',
        severity: 'high',
        userId,
        eventDescription: `Applied retention policy: ${result.totalProcessed} files processed`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          policyId,
          processedFiles: result.totalProcessed,
          retentionAction: result.retentionAction
        }
      });

      res.json({
        success: true,
        message: `Retention policy applied: ${result.totalProcessed} files processed`,
        processedFiles: result.processedFiles,
        totalProcessed: result.totalProcessed,
        retentionAction: result.retentionAction
      });

    } catch (error) {
      console.error('Error applying retention policy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply retention policy'
      });
    }
  }

  /**
   * Anonymize data for research
   * POST /api/governance/anonymize
   */
  static async anonymizeData(req, res) {
    try {
      const userId = req.user.sub;
      const {
        datasetId,
        anonymizationLevel = 'k-anonymity',
        k = 5,
        researchPurpose
      } = req.body;

      // Validate required fields
      if (!datasetId || !researchPurpose) {
        return res.status(400).json({
          success: false,
          error: 'Dataset ID and research purpose are required'
        });
      }

      const result = await DataGovernanceService.anonymizeForResearch(
        datasetId,
        anonymizationLevel,
        k
      );

      // Log anonymization
      await AdvancedAuditService.logEvent({
        eventType: 'anonymization',
        severity: 'high',
        userId,
        eventDescription: `Anonymized dataset ${datasetId} for research`,
        purposeOfUse: 'research',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          datasetId,
          anonymizationLevel,
          originalFiles: result.originalFiles,
          anonymizedFiles: result.anonymizedFiles.length,
          researchPurpose
        }
      });

      res.json({
        success: true,
        message: `Dataset anonymized: ${result.anonymizedFiles.length} files created`,
        originalFiles: result.originalFiles,
        anonymizedFiles: result.anonymizedFiles,
        anonymizationLevel: result.anonymizationLevel,
        privacyParameters: result.privacyParameters
      });

    } catch (error) {
      console.error('Error anonymizing data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to anonymize data'
      });
    }
  }

  /**
   * Generate privacy-preserving analytics
   * POST /api/governance/privacy-analytics
   */
  static async generatePrivacyAnalytics(req, res) {
    try {
      const userId = req.user.sub;
      const {
        resourceType,
        aggregationType,
        groupBy,
        dateRange,
        filters,
        privacyLevel = 'differential'
      } = req.body;

      // Validate required fields
      if (!resourceType || !aggregationType) {
        return res.status(400).json({
          success: false,
          error: 'Resource type and aggregation type are required'
        });
      }

      const query = {
        resourceType,
        aggregationType,
        groupBy,
        dateRange,
        filters
      };

      const result = await DataGovernanceService.generatePrivacyPreservingAnalytics(query, privacyLevel);

      // Log privacy analytics
      await AdvancedAuditService.logEvent({
        eventType: 'privacy_preserving_analytics',
        severity: 'medium',
        userId,
        eventDescription: `Generated privacy-preserving analytics for ${resourceType}`,
        purposeOfUse: 'analytics',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          query,
          privacyLevel,
          recordsAnalyzed: result.metadata.recordsAnalyzed,
          privacyBudgetUsed: result.metadata.privacyBudgetUsed
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error generating privacy analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate privacy-preserving analytics'
      });
    }
  }

  /**
   * Get data lineage for a source
   * GET /api/governance/lineage/:sourceId/:sourceType?page=1&limit=50
   */
  static async getDataLineage(req, res) {
    try {
      const userId = req.user.sub;
      const { sourceId, sourceType } = req.params;
      const {
        page = 1,
        limit = 50,
        includeDestinations = true,
        transformationType
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        includeDestinations: includeDestinations === 'true',
        transformationType
      };

      const result = await DataGovernanceRepository.getDataLineage(sourceId, sourceType, options);

      // Log lineage access
      await AdvancedAuditService.logEvent({
        eventType: 'data_lineage_access',
        severity: 'low',
        userId,
        eventDescription: `User accessed data lineage for ${sourceType} ${sourceId}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          sourceId,
          sourceType,
          lineageRecords: result.lineageRecords.length
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting data lineage:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get data lineage'
      });
    }
  }

  /**
   * Trace complete data lineage chain
   * GET /api/governance/lineage/:sourceId/:sourceType/trace?maxDepth=10
   */
  static async traceDataLineageChain(req, res) {
    try {
      const userId = req.user.sub;
      const { sourceId, sourceType } = req.params;
      const { maxDepth = 10 } = req.query;

      const result = await DataGovernanceRepository.traceDataLineageChain(
        sourceId,
        sourceType,
        parseInt(maxDepth)
      );

      // Log lineage tracing
      await AdvancedAuditService.logEvent({
        eventType: 'data_lineage_trace',
        severity: 'low',
        userId,
        eventDescription: `User traced data lineage chain for ${sourceType} ${sourceId}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          sourceId,
          sourceType,
          totalTransformations: result.totalTransformations,
          maxDepthReached: result.maxDepthReached
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error tracing data lineage chain:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trace data lineage chain'
      });
    }
  }

  /**
   * Get policy statistics
   * GET /api/governance/statistics
   */
  static async getPolicyStatistics(req, res) {
    try {
      const userId = req.user.sub;

      const result = await DataGovernanceRepository.getPolicyStatistics();

      // Log statistics access
      await AdvancedAuditService.logEvent({
        eventType: 'governance_statistics_access',
        severity: 'low',
        userId,
        eventDescription: 'User accessed governance policy statistics',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          totalPolicies: result.statusDistribution.reduce((sum, stat) => sum + stat.count, 0)
        }
      });

      res.json({
        success: true,
        statistics: result
      });

    } catch (error) {
      console.error('Error getting policy statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get policy statistics'
      });
    }
  }

  /**
   * Get data transformation statistics
   * GET /api/governance/transformation-stats?timeRange=30
   */
  static async getDataTransformationStats(req, res) {
    try {
      const userId = req.user.sub;
      const { timeRange = 30 } = req.query;

      const result = await DataGovernanceRepository.getDataTransformationStats(parseInt(timeRange));

      // Log transformation stats access
      await AdvancedAuditService.logEvent({
        eventType: 'transformation_statistics_access',
        severity: 'low',
        userId,
        eventDescription: 'User accessed data transformation statistics',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          timeRange: parseInt(timeRange),
          transformationCount: result.transformationTypes.reduce((sum, t) => sum + t.count, 0)
        }
      });

      res.json({
        success: true,
        statistics: result
      });

    } catch (error) {
      console.error('Error getting transformation statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get data transformation statistics'
      });
    }
  }

  /**
   * Get anonymization history
   * GET /api/governance/anonymization-history?page=1&limit=50
   */
  static async getAnonymizationHistory(req, res) {
    try {
      const userId = req.user.sub;
      const {
        page = 1,
        limit = 50,
        anonymizationLevel,
        startDate,
        endDate
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        anonymizationLevel,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      };

      const result = await DataGovernanceRepository.getAnonymizationHistory(options);

      // Log anonymization history access
      await AdvancedAuditService.logEvent({
        eventType: 'anonymization_history_access',
        severity: 'low',
        userId,
        eventDescription: 'User accessed anonymization history',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          recordCount: result.records.length,
          filters: { anonymizationLevel, startDate, endDate }
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting anonymization history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get anonymization history'
      });
    }
  }

  /**
   * Update policy status
   * PUT /api/governance/policies/:policyId/status
   */
  static async updatePolicyStatus(req, res) {
    try {
      const userId = req.user.sub;
      const { policyId } = req.params;
      const { status, reason } = req.body;

      // Validate status
      const validStatuses = ['active', 'inactive', 'pending', 'deprecated'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid policy status'
        });
      }

      const result = await DataGovernanceRepository.updatePolicyStatus(policyId, status, userId);

      // Log policy status update
      await AdvancedAuditService.logEvent({
        eventType: 'governance_policy_status_update',
        severity: 'medium',
        userId,
        eventDescription: `Updated policy ${result.policyName} status to ${status}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          policyId,
          oldStatus: result.previousStatus,
          newStatus: status,
          reason
        }
      });

      res.json({
        success: true,
        message: `Policy status updated to ${status}`,
        policy: {
          id: result.id,
          policyName: result.policyName,
          policyStatus: result.policyStatus,
          updatedAt: result.updatedAt
        }
      });

    } catch (error) {
      console.error('Error updating policy status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update policy status'
      });
    }
  }

  /**
   * Get cross-border transfer policies
   * GET /api/governance/cross-border/:sourceJurisdiction/:destinationJurisdiction
   */
  static async getCrossBorderPolicies(req, res) {
    try {
      const userId = req.user.sub;
      const { sourceJurisdiction, destinationJurisdiction } = req.params;

      const policies = await DataGovernanceRepository.getCrossBorderPolicies(
        sourceJurisdiction,
        destinationJurisdiction
      );

      // Log cross-border policy access
      await AdvancedAuditService.logEvent({
        eventType: 'cross_border_policies_access',
        severity: 'low',
        userId,
        eventDescription: `User accessed cross-border policies for ${sourceJurisdiction} to ${destinationJurisdiction}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          sourceJurisdiction,
          destinationJurisdiction,
          policyCount: policies.length
        }
      });

      res.json({
        success: true,
        policies,
        sourceJurisdiction,
        destinationJurisdiction,
        totalPolicies: policies.length
      });

    } catch (error) {
      console.error('Error getting cross-border policies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cross-border policies'
      });
    }
  }

  /**
   * Validate cross-border transfer
   * POST /api/governance/validate-cross-border
   */
  static async validateCrossBorderTransfer(req, res) {
    try {
      const userId = req.user.sub;
      const transferRequest = req.body;

      // Validate required fields
      const requiredFields = ['sourceJurisdiction', 'destinationJurisdiction', 'dataTypes', 'transferPurpose'];
      const missingFields = requiredFields.filter(field => !transferRequest[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
      }

      const result = await DataGovernanceService.enforceCrossBorderPolicy(transferRequest);

      // Log cross-border validation
      await AdvancedAuditService.logEvent({
        eventType: 'cross_border_validation',
        severity: result.transferAllowed ? 'low' : 'high',
        userId,
        eventDescription: `Cross-border transfer validation ${result.transferAllowed ? 'passed' : 'failed'}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          transferRequest,
          validationResult: result.validationResults,
          transferAllowed: result.transferAllowed
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error validating cross-border transfer:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate cross-border transfer'
      });
    }
  }

  /**
   * Get policy compliance report
   * GET /api/governance/compliance-report?timeRange=30&framework=hipaa
   */
  static async getPolicyComplianceReport(req, res) {
    try {
      const userId = req.user.sub;
      const {
        timeRange = 30,
        complianceFramework,
        policyType
      } = req.query;

      const options = {
        timeRange: parseInt(timeRange),
        complianceFramework,
        policyType
      };

      const result = await DataGovernanceRepository.getPolicyComplianceReport(options);

      // Log compliance report access
      await AdvancedAuditService.logEvent({
        eventType: 'governance_compliance_report',
        severity: 'medium',
        userId,
        eventDescription: 'User generated governance compliance report',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          timeRange: parseInt(timeRange),
          complianceFramework,
          totalPolicies: result.complianceMetrics.totalActivePolicies
        }
      });

      res.json({
        success: true,
        report: result
      });

    } catch (error) {
      console.error('Error getting policy compliance report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get policy compliance report'
      });
    }
  }

  /**
   * Get policy violations
   * GET /api/governance/violations?page=1&limit=50&timeRange=30
   */
  static async getPolicyViolations(req, res) {
    try {
      const userId = req.user.sub;
      const {
        page = 1,
        limit = 50,
        policyType,
        timeRange = 30
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        policyType,
        timeRange: parseInt(timeRange)
      };

      const result = await DataGovernanceRepository.getPolicyViolations(options);

      // Log violations access
      await AdvancedAuditService.logEvent({
        eventType: 'policy_violations_access',
        severity: 'medium',
        userId,
        eventDescription: 'User accessed policy violations',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          violationCount: result.violations.length,
          timeRange: parseInt(timeRange)
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting policy violations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get policy violations'
      });
    }
  }

  /**
   * Get policies requiring review
   * GET /api/governance/policies-requiring-review?daysAhead=30
   */
  static async getPoliciesRequiringReview(req, res) {
    try {
      const userId = req.user.sub;
      const { daysAhead = 30 } = req.query;

      const policies = await DataGovernanceRepository.getPoliciesRequiringReview(parseInt(daysAhead));

      // Log review requirement access
      await AdvancedAuditService.logEvent({
        eventType: 'policies_requiring_review_access',
        severity: 'low',
        userId,
        eventDescription: 'User accessed policies requiring review',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          daysAhead: parseInt(daysAhead),
          policyCount: policies.length
        }
      });

      res.json({
        success: true,
        policies,
        totalRequiringReview: policies.length,
        daysAhead: parseInt(daysAhead)
      });

    } catch (error) {
      console.error('Error getting policies requiring review:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get policies requiring review'
      });
    }
  }

  /**
   * Classify data automatically
   * POST /api/governance/classify-data
   */
  static async classifyData(req, res) {
    try {
      const userId = req.user.sub;
      const { fileId } = req.body;

      if (!fileId) {
        return res.status(400).json({
          success: false,
          error: 'File ID is required'
        });
      }

      const result = await DataGovernanceService.classifyData(fileId);

      // Log data classification
      await AdvancedAuditService.logEvent({
        eventType: 'data_classification',
        severity: 'low',
        userId,
        eventDescription: `Automatically classified file ${fileId}`,
        resourceId: fileId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          fileId,
          classification: result.classification,
          sensitivityLevel: result.classification.sensitivityLevel
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error classifying data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to classify data'
      });
    }
  }

  /**
   * Cleanup old lineage records
   * DELETE /api/governance/cleanup-lineage?retentionDays=2555
   */
  static async cleanupOldLineageRecords(req, res) {
    try {
      const userId = req.user.sub;
      const { retentionDays = 2555 } = req.query; // 7 years default

      const result = await DataGovernanceRepository.deleteOldLineageRecords(parseInt(retentionDays));

      // Log cleanup operation
      await AdvancedAuditService.logEvent({
        eventType: 'lineage_records_cleanup',
        severity: 'medium',
        userId,
        eventDescription: `Cleaned up ${result.deletedCount} old lineage records`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          deletedCount: result.deletedCount,
          retentionDays: parseInt(retentionDays),
          cutoffDate: result.cutoffDate
        }
      });

      res.json({
        success: true,
        message: `${result.deletedCount} old lineage records cleaned up`,
        deletedCount: result.deletedCount,
        cutoffDate: result.cutoffDate,
        retentionDays: parseInt(retentionDays)
      });

    } catch (error) {
      console.error('Error cleaning up lineage records:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup old lineage records'
      });
    }
  }
}

module.exports = DataGovernanceController;