// src/controllers/consentController.js
const AppDataSource = require('../../../config/database');
const ConsentService = require('../services/consentService');
const AdvancedAuditService = require('../services/advancedAuditService');
const ConsentRepository = require('../repositories/consentRepository');


class ConsentController {

  /**
   * Create new patient consent
   * POST /api/consent/create
   */
  static async createConsent(req, res) {
    try {
      const userId = req.user.sub;
      const consentData = req.body;

      // Validate required fields
      const requiredFields = ['patientIdentifier', 'consentScope', 'allowedPurposes'];
      const missingFields = requiredFields.filter(field => !consentData[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
      }

      const result = await ConsentService.createConsent(consentData, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Log consent creation
      await AdvancedAuditService.logEvent({
        eventType: 'consent_granted',
        severity: 'medium',
        userId,
        patientIdentifier: consentData.patientIdentifier,
        eventDescription: `Patient consent created with scope: ${consentData.consentScope}`,
        consentId: result.consent.id,
        consentChecked: true,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          consentScope: consentData.consentScope,
          allowedPurposes: consentData.allowedPurposes,
          expirationDate: consentData.expirationDate
        }
      });

      res.status(201).json({
        success: true,
        message: 'Patient consent created successfully',
        consent: result.consent
      });

    } catch (error) {
      console.error('Error creating consent:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create patient consent'
      });
    }
  }

  /**
   * Get consent status for patient
   * GET /api/consent/:patientId/status
   */
  static async getConsentStatus(req, res) {
    try {
      const userId = req.user.sub;
      const { patientId } = req.params;

      const result = await ConsentService.getConsentStatus(patientId);

      // Log consent status check
      await AdvancedAuditService.logEvent({
        eventType: 'consent_checked',
        severity: 'low',
        userId,
        patientIdentifier: patientId,
        eventDescription: 'User checked patient consent status',
        consentChecked: true,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          hasActiveConsent: result.status.hasActiveConsent,
          consentScope: result.status.consentScope
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting consent status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get consent status'
      });
    }
  }

  /**
   * Withdraw patient consent
   * PUT /api/consent/:patientId/withdraw
   */
  static async withdrawConsent(req, res) {
    try {
      const userId = req.user.sub;
      const { patientId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Withdrawal reason is required'
        });
      }

      const result = await ConsentService.withdrawConsent(
        patientId,
        userId,
        reason,
        req.ip,
        req.get('User-Agent')
      );

      // Log consent withdrawal
      await AdvancedAuditService.logEvent({
        eventType: 'consent_withdrawn',
        severity: 'high',
        userId,
        patientIdentifier: patientId,
        eventDescription: `Patient consent withdrawn: ${reason}`,
        consentId: result.withdrawnConsent.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          withdrawalReason: reason,
          withdrawnAt: result.withdrawnConsent.withdrawnAt
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error withdrawing consent:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to withdraw consent'
      });
    }
  }

  /**
   * Update patient consent
   * PUT /api/consent/:patientId/update
   */
  static async updateConsent(req, res) {
    try {
      const userId = req.user.sub;
      const { patientId } = req.params;
      const updateData = req.body;

      // Validate update data
      const allowedFields = [
        'consentScope', 'allowedPurposes', 'allowedUsers', 'allowedResourceTypes',
        'restrictedResourceTypes', 'expirationDate', 'allowEmergencyAccess'
      ];

      const filteredUpdateData = {};
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredUpdateData[field] = updateData[field];
        }
      });

      if (Object.keys(filteredUpdateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields provided for update'
        });
      }

      const result = await ConsentService.updateConsent(patientId, filteredUpdateData, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Log consent modification
      await AdvancedAuditService.logEvent({
        eventType: 'consent_modified',
        severity: 'medium',
        userId,
        patientIdentifier: patientId,
        eventDescription: `Patient consent updated`,
        consentId: result.consent.id,
        consentChecked: true,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          updatedFields: Object.keys(filteredUpdateData),
          newConsentScope: result.consent.consentScope,
          version: result.consent.version
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error updating consent:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update consent'
      });
    }
  }

  /**
   * Check permission for specific access
   * POST /api/consent/check-permission
   */
  static async checkPermission(req, res) {
    try {
      const userId = req.user.sub;
      const {
        patientIdentifier,
        purposeOfUse,
        resourceType,
        isEmergency = false,
        emergencyJustification
      } = req.body;

      // Validate required fields
      if (!patientIdentifier || !purposeOfUse) {
        return res.status(400).json({
          success: false,
          error: 'Patient identifier and purpose of use are required'
        });
      }

      const metadata = {
        accessType: 'permission_check',
        isEmergency,
        emergencyJustification,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const permission = await ConsentService.checkAccessPermission(
        patientIdentifier,
        userId,
        purposeOfUse,
        resourceType,
        metadata
      );

      // Log permission check
      await AdvancedAuditService.logEvent({
        eventType: permission.granted ? 'patient_data_access' : 'permission_denied',
        severity: permission.granted ? 'low' : 'medium',
        userId,
        patientIdentifier,
        fhirResourceType: resourceType,
        eventDescription: `Permission check: ${permission.reason}`,
        outcome: permission.granted ? 'SUCCESS' : 'FAILURE',
        outcomeReason: permission.reason,
        consentId: permission.consent?.id,
        consentChecked: true,
        isEmergencyAccess: permission.isEmergencyAccess || false,
        emergencyJustification: permission.isEmergencyAccess ? emergencyJustification : null,
        purposeOfUse,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          resourceType,
          requestedAccess: purposeOfUse,
          permissionGranted: permission.granted
        }
      });

      res.json({
        success: true,
        permission: {
          granted: permission.granted,
          reason: permission.reason,
          isEmergencyAccess: permission.isEmergencyAccess || false,
          consentId: permission.consent?.id,
          consentScope: permission.consent?.consentScope,
          allowedPurposes: permission.consent?.allowedPurposes
        }
      });

    } catch (error) {
      console.error('Error checking permission:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check permission'
      });
    }
  }

  /**
   * Get consent history for patient
   * GET /api/consent/:patientId/history?page=1&limit=20
   */
  static async getConsentHistory(req, res) {
    try {
      const userId = req.user.sub;
      const { patientId } = req.params;
      const {
        page = 1,
        limit = 20
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const result = await ConsentRepository.getConsentHistory(patientId, options);

      // Log consent history access
      await AdvancedAuditService.logEvent({
        eventType: 'consent_history_access',
        severity: 'low',
        userId,
        patientIdentifier: patientId,
        eventDescription: 'User accessed patient consent history',
        consentChecked: true,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          consentCount: result.consents.length,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('Error getting consent history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get consent history'
      });
    }
  }

  /**
   * Get consent compliance report
   * GET /api/consent/compliance-report
   */
  static async getComplianceReport(req, res) {
    try {
      const userId = req.user.sub;

      const result = await ConsentService.getConsentComplianceReport();

      // Log compliance report access
      await AdvancedAuditService.logEvent({
        eventType: 'consent_compliance_report',
        severity: 'medium',
        userId,
        eventDescription: 'User accessed consent compliance report',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          totalConsents: result.report.overview.totalConsents,
          consentRate: result.report.overview.consentRate
        }
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting compliance report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get consent compliance report'
      });
    }
  }

  /**
   * Get patients requiring consent renewal
   * GET /api/consent/requiring-renewal?daysAhead=30
   */
  static async getPatientsRequiringRenewal(req, res) {
    try {
      const userId = req.user.sub;
      const { daysAhead = 30 } = req.query;

      const patients = await ConsentRepository.getPatientsRequiringRenewal(parseInt(daysAhead));

      // Log renewal requirement access
      await AdvancedAuditService.logEvent({
        eventType: 'consent_renewal_check',
        severity: 'low',
        userId,
        eventDescription: 'User checked patients requiring consent renewal',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          daysAhead: parseInt(daysAhead),
          patientCount: patients.length
        }
      });

      res.json({
        success: true,
        patients: patients.map(consent => ({
          patientIdentifier: consent.patientIdentifier,
          consentId: consent.id,
          consentScope: consent.consentScope,
          expirationDate: consent.expirationDate,
          daysUntilExpiration: Math.ceil(
            (new Date(consent.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)
          )
        })),
        totalRequiringRenewal: patients.length,
        daysAhead: parseInt(daysAhead)
      });

    } catch (error) {
      console.error('Error getting patients requiring renewal:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get patients requiring consent renewal'
      });
    }
  }

  /**
   * Bulk update consent for multiple patients
   * PUT /api/consent/bulk-update
   */
  static async bulkUpdateConsents(req, res) {
    try {
      const userId = req.user.sub;
      const { patientIdentifiers, updateData } = req.body;

      // Validate input
      if (!patientIdentifiers || !Array.isArray(patientIdentifiers) || patientIdentifiers.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Patient identifiers array is required'
        });
      }

      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Update data is required'
        });
      }

      // Limit bulk operations
      if (patientIdentifiers.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Cannot update more than 100 consents at once'
        });
      }

      const result = await ConsentRepository.bulkUpdateConsents(patientIdentifiers, updateData);

      // Log bulk consent update
      await AdvancedAuditService.logEvent({
        eventType: 'bulk_consent_update',
        severity: 'high',
        userId,
        eventDescription: `Bulk updated ${result} patient consents`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          patientCount: patientIdentifiers.length,
          updatedCount: result,
          updateData: Object.keys(updateData)
        }
      });

      res.json({
        success: true,
        message: `${result} consents updated successfully`,
        updatedCount: result,
        requestedCount: patientIdentifiers.length
      });

    } catch (error) {
      console.error('Error bulk updating consents:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk update consents'
      });
    }
  }

  /**
   * Get consent access logs for patient
   * GET /api/consent/:patientId/access-logs?page=1&limit=50
   */
  static async getConsentAccessLogs(req, res) {
    try {
      const userId = req.user.sub;
      const { patientId } = req.params;
      const {
        page = 1,
        limit = 50,
        accessType,
        startDate,
        endDate
      } = req.query;

      // Get active consent first
      const consent = await ConsentRepository.getActiveConsent(patientId);

      if (!consent) {
        return res.status(404).json({
          success: false,
          error: 'No active consent found for patient'
        });
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        accessType,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      };

      // Get access logs for the consent
      const logRepo = AppDataSource.getRepository('ConsentAccessLog');
      const queryBuilder = logRepo.createQueryBuilder('log')
        .leftJoinAndSelect('log.user', 'user')
        .where('log.consent = :consentId', { consentId: consent.id });

      if (options.accessType) {
        queryBuilder.andWhere('log.accessType = :accessType', { accessType: options.accessType });
      }

      if (options.startDate) {
        queryBuilder.andWhere('log.accessedAt >= :startDate', { startDate: options.startDate });
      }

      if (options.endDate) {
        queryBuilder.andWhere('log.accessedAt <= :endDate', { endDate: options.endDate });
      }

      queryBuilder.orderBy('log.accessedAt', 'DESC');

      const skip = (options.page - 1) * options.limit;
      queryBuilder.skip(skip).take(options.limit);

      const [logs, total] = await queryBuilder.getManyAndCount();

      // Log access log retrieval
      await AdvancedAuditService.logEvent({
        eventType: 'consent_access_logs_viewed',
        severity: 'low',
        userId,
        patientIdentifier: patientId,
        eventDescription: 'User viewed consent access logs',
        consentId: consent.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          logCount: logs.length,
          filters: options
        }
      });

      res.json({
        success: true,
        logs,
        total,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(total / options.limit),
        patientIdentifier: patientId,
        consentId: consent.id
      });

    } catch (error) {
      console.error('Error getting consent access logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get consent access logs'
      });
    }
  }

  /**
   * Get emergency access events
   * GET /api/consent/emergency-access?startDate=2024-01-01&endDate=2024-12-31
   */
  static async getEmergencyAccessEvents(req, res) {
    try {
      const userId = req.user.sub;
      const {
        page = 1,
        limit = 50,
        startDate,
        endDate,
        patientIdentifier
      } = req.query;

      const logRepo = AppDataSource.getRepository('ConsentAccessLog');
      const queryBuilder = logRepo.createQueryBuilder('log')
        .leftJoinAndSelect('log.user', 'user')
        .leftJoinAndSelect('log.consent', 'consent')
        .where('log.isEmergencyAccess = :emergency', { emergency: true });

      if (startDate) {
        queryBuilder.andWhere('log.accessedAt >= :startDate', {
          startDate: new Date(startDate)
        });
      }

      if (endDate) {
        queryBuilder.andWhere('log.accessedAt <= :endDate', {
          endDate: new Date(endDate)
        });
      }

      if (patientIdentifier) {
        queryBuilder.andWhere('consent.patientIdentifier = :patientId', {
          patientId: patientIdentifier
        });
      }

      queryBuilder.orderBy('log.accessedAt', 'DESC');

      const skip = (parseInt(page) - 1) * parseInt(limit);
      queryBuilder.skip(skip).take(parseInt(limit));

      const [events, total] = await queryBuilder.getManyAndCount();

      // Log emergency access review
      await AdvancedAuditService.logEvent({
        eventType: 'emergency_access_review',
        severity: 'medium',
        userId,
        eventDescription: 'User reviewed emergency access events',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          eventCount: events.length,
          filters: { startDate, endDate, patientIdentifier }
        }
      });

      res.json({
        success: true,
        events: events.map(event => ({
          id: event.id,
          patientIdentifier: event.consent.patientIdentifier,
          userId: event.user.id,
          userName: event.user.name || event.user.email,
          accessType: event.accessType,
          purposeOfUse: event.purposeOfUse,
          emergencyJustification: event.emergencyJustification,
          accessedAt: event.accessedAt,
          ipAddress: event.ipAddress,
          accessGranted: event.accessGranted
        })),
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      });

    } catch (error) {
      console.error('Error getting emergency access events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get emergency access events'
      });
    }
  }

  /**
   * Get consent statistics
   * GET /api/consent/statistics?timeRange=30
   */
  static async getConsentStatistics(req, res) {
    try {
      const userId = req.user.sub;
      const { timeRange = 30 } = req.query;

      const consentRepo = ConsentRepository.getRepository();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange));

      // Get consent statistics
      const stats = await consentRepo.createQueryBuilder('consent')
        .select([
          'COUNT(*) as total_consents',
          'COUNT(CASE WHEN consent.consentStatus = \'active\' THEN 1 END) as active_consents',
          'COUNT(CASE WHEN consent.consentStatus = \'withdrawn\' THEN 1 END) as withdrawn_consents',
          'COUNT(CASE WHEN consent.consentStatus = \'expired\' THEN 1 END) as expired_consents',
          'COUNT(CASE WHEN consent.allowEmergencyAccess = true THEN 1 END) as emergency_access_allowed'
        ])
        .where('consent.createdAt >= :startDate', { startDate })
        .getRawOne();

      // Get consent scope distribution
      const scopeStats = await consentRepo.createQueryBuilder('consent')
        .select(['consent.consentScope', 'COUNT(*) as count'])
        .where('consent.createdAt >= :startDate', { startDate })
        .andWhere('consent.consentStatus = :status', { status: 'active' })
        .groupBy('consent.consentScope')
        .getRawMany();

      // Get recent consent activity
      const recentActivity = await consentRepo.createQueryBuilder('consent')
        .select(['DATE(consent.createdAt) as date', 'COUNT(*) as count'])
        .where('consent.createdAt >= :startDate', { startDate })
        .groupBy('DATE(consent.createdAt)')
        .orderBy('DATE(consent.createdAt)', 'ASC')
        .getRawMany();

      const statistics = {
        timeRange: parseInt(timeRange),
        overview: {
          totalConsents: parseInt(stats.total_consents) || 0,
          activeConsents: parseInt(stats.active_consents) || 0,
          withdrawnConsents: parseInt(stats.withdrawn_consents) || 0,
          expiredConsents: parseInt(stats.expired_consents) || 0,
          emergencyAccessAllowed: parseInt(stats.emergency_access_allowed) || 0
        },
        scopeDistribution: scopeStats.map(stat => ({
          scope: stat.consent_consentscope || stat.consentScope,
          count: parseInt(stat.count)
        })),
        dailyActivity: recentActivity.map(stat => ({
          date: stat.date,
          count: parseInt(stat.count)
        })),
        generatedAt: new Date()
      };

      // Log statistics access
      await AdvancedAuditService.logEvent({
        eventType: 'consent_statistics_access',
        severity: 'low',
        userId,
        eventDescription: 'User accessed consent statistics',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          timeRange: parseInt(timeRange),
          totalConsents: statistics.overview.totalConsents
        }
      });

      res.json({
        success: true,
        statistics
      });

    } catch (error) {
      console.error('Error getting consent statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get consent statistics'
      });
    }
  }

  /**
   * Validate consent data
   * POST /api/consent/validate
   */
  static async validateConsentData(req, res) {
    try {
      const userId = req.user.sub;
      const consentData = req.body;

      // Use the validation logic from ConsentService
      const validation = ConsentService.validateConsentData ?
        ConsentService.validateConsentData(consentData) :
        this.validateConsentDataLocal(consentData);

      // Log validation attempt
      await AdvancedAuditService.logEvent({
        eventType: 'consent_validation',
        severity: 'low',
        userId,
        eventDescription: `Consent data validation ${validation.isValid ? 'passed' : 'failed'}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          isValid: validation.isValid,
          validationErrors: validation.isValid ? [] : [validation.error],
          patientIdentifier: consentData.patientIdentifier
        }
      });

      res.json({
        success: true,
        validation: {
          isValid: validation.isValid,
          error: validation.error,
          checkedFields: [
            'patientIdentifier',
            'consentScope',
            'allowedPurposes',
            'expirationDate'
          ]
        }
      });

    } catch (error) {
      console.error('Error validating consent data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate consent data'
      });
    }
  }

  /**
   * Get consent templates
   * GET /api/consent/templates?type=general
   */
  static async getConsentTemplates(req, res) {
    try {
      const userId = req.user.sub;
      const { type = 'general' } = req.query;

      // Static consent templates (in production, these would be stored in database)
      const templates = {
        general: {
          name: 'General Healthcare Consent',
          consentScope: 'limited_access',
          allowedPurposes: ['treatment', 'healthcare_operations'],
          allowEmergencyAccess: true,
          description: 'Standard consent for general healthcare activities'
        },
        research: {
          name: 'Research Participation Consent',
          consentScope: 'limited_access',
          allowedPurposes: ['research'],
          allowEmergencyAccess: false,
          description: 'Consent specifically for research participation'
        },
        full_access: {
          name: 'Full Access Consent',
          consentScope: 'full_access',
          allowedPurposes: ['treatment', 'payment', 'healthcare_operations'],
          allowEmergencyAccess: true,
          description: 'Comprehensive consent for all healthcare activities'
        },
        minimal: {
          name: 'Minimal Access Consent',
          consentScope: 'treatment_only',
          allowedPurposes: ['treatment'],
          allowEmergencyAccess: true,
          description: 'Minimal consent for treatment purposes only'
        }
      };

      const template = templates[type] || templates.general;

      // Log template access
      await AdvancedAuditService.logEvent({
        eventType: 'consent_template_access',
        severity: 'low',
        userId,
        eventDescription: `User accessed ${type} consent template`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          templateType: type,
          templateName: template.name
        }
      });

      res.json({
        success: true,
        template,
        availableTypes: Object.keys(templates)
      });

    } catch (error) {
      console.error('Error getting consent templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get consent templates'
      });
    }
  }

  // Helper method for local validation
  static validateConsentDataLocal(data) {
    if (!data.patientIdentifier) {
      return { isValid: false, error: 'Patient identifier is required' };
    }

    const validScopes = ['full_access', 'limited_access', 'treatment_only', 'emergency_only', 'no_access'];
    if (!data.consentScope || !validScopes.includes(data.consentScope)) {
      return { isValid: false, error: 'Valid consent scope is required' };
    }

    if (!data.allowedPurposes || !Array.isArray(data.allowedPurposes) || data.allowedPurposes.length === 0) {
      return { isValid: false, error: 'At least one allowed purpose is required' };
    }

    const validPurposes = ['treatment', 'payment', 'healthcare_operations', 'research', 'public_health', 'quality_assurance', 'emergency'];
    const invalidPurposes = data.allowedPurposes.filter(p => !validPurposes.includes(p));
    if (invalidPurposes.length > 0) {
      return { isValid: false, error: `Invalid purposes: ${invalidPurposes.join(', ')}` };
    }

    if (data.expirationDate && new Date(data.expirationDate) <= new Date()) {
      return { isValid: false, error: 'Expiration date must be in the future' };
    }

    return { isValid: true };
  }
}

module.exports = ConsentController;