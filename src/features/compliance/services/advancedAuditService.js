// ===== COMPONENT 1: CORE AUDIT SERVICE =====
// src/services/advancedAuditService.js

const AppDataSource = require('../../../config/database');
const crypto = require('crypto');
const { AuditEventType, AuditSeverity, ComplianceFramework } = require('../entities/ComprehensiveAuditLog');

class AdvancedAuditService {

  /**
   * Log comprehensive audit event
   */
  static async logEvent(eventData) {
    try {
      // Enrich event data with compliance and security context
      const enrichedEvent = await this.enrichEventData(eventData);

      // Calculate risk score
      enrichedEvent.riskScore = this.calculateRiskScore(enrichedEvent);

      // Generate digital signature and checksum
      enrichedEvent.digitalSignature = this.generateDigitalSignature(enrichedEvent);
      enrichedEvent.checksumHash = this.generateChecksum(enrichedEvent);

      // Determine compliance frameworks
      enrichedEvent.complianceFrameworks = this.determineComplianceFrameworks(enrichedEvent);

      // Set retention period
      enrichedEvent.retentionPeriod = this.calculateRetentionPeriod(enrichedEvent);

      const auditRepo = AppDataSource.getRepository('ComprehensiveAuditLog');
      const auditLog = auditRepo.create(enrichedEvent);

      const savedLog = await auditRepo.save(auditLog);

      // Real-time alerting for high-risk events
      if (enrichedEvent.riskScore >= 80 || enrichedEvent.severity === AuditSeverity.CRITICAL) {
        await this.triggerSecurityAlert(savedLog);
      }

      return savedLog;

    } catch (error) {
      // Log the error but don't fail the original operation
      console.error('Failed to log audit event:', error);

      // Fallback logging
      await this.logFailsafeEvent({
        eventType: AuditEventType.SYSTEM_ERROR,
        severity: AuditSeverity.HIGH,
        eventDescription: `Audit logging failed: ${error.message}`,
        metadata: { originalEvent: eventData }
      });
    }
  }

  /**
   * Search audit logs with advanced filtering
   */
  static async searchAuditLogs(searchCriteria, options = {}) {
    try {
      const auditRepo = AppDataSource.getRepository('ComprehensiveAuditLog');
      const {
        page = 1,
        limit = 100,
        sortBy = 'eventTimestamp',
        sortOrder = 'DESC'
      } = options;

      const queryBuilder = auditRepo.createQueryBuilder('audit')
        .leftJoinAndSelect('audit.user', 'user')
        .leftJoinAndSelect('audit.resource', 'resource')
        .leftJoinAndSelect('audit.consent', 'consent');

      // Apply search criteria
      if (searchCriteria.eventTypes) {
        queryBuilder.andWhere('audit.eventType IN (:...eventTypes)', {
          eventTypes: searchCriteria.eventTypes
        });
      }

      if (searchCriteria.patientIdentifier) {
        queryBuilder.andWhere('audit.patientIdentifier = :patientId', {
          patientId: searchCriteria.patientIdentifier
        });
      }

      if (searchCriteria.userId) {
        queryBuilder.andWhere('audit.userId = :userId', {
          userId: searchCriteria.userId
        });
      }

      if (searchCriteria.severity) {
        queryBuilder.andWhere('audit.severity = :severity', {
          severity: searchCriteria.severity
        });
      }

      if (searchCriteria.dateRange) {
        queryBuilder.andWhere('audit.eventTimestamp BETWEEN :startDate AND :endDate', {
          startDate: searchCriteria.dateRange.startDate,
          endDate: searchCriteria.dateRange.endDate
        });
      }

      if (searchCriteria.ipAddress) {
        queryBuilder.andWhere('audit.ipAddress = :ipAddress', {
          ipAddress: searchCriteria.ipAddress
        });
      }

      if (searchCriteria.outcome) {
        queryBuilder.andWhere('audit.outcome = :outcome', {
          outcome: searchCriteria.outcome
        });
      }

      if (searchCriteria.emergencyAccess !== undefined) {
        queryBuilder.andWhere('audit.isEmergencyAccess = :emergencyAccess', {
          emergencyAccess: searchCriteria.emergencyAccess
        });
      }

      if (searchCriteria.riskScoreMin !== undefined) {
        queryBuilder.andWhere('audit.riskScore >= :riskScoreMin', {
          riskScoreMin: searchCriteria.riskScoreMin
        });
      }

      if (searchCriteria.complianceFramework) {
        queryBuilder.andWhere('audit.complianceFrameworks @> :framework', {
          framework: JSON.stringify([searchCriteria.complianceFramework])
        });
      }

      if (searchCriteria.searchText) {
        queryBuilder.andWhere(
          '(audit.eventDescription ILIKE :searchText OR audit.outcomeReason ILIKE :searchText)',
          { searchText: `%${searchCriteria.searchText}%` }
        );
      }

      // Sorting
      queryBuilder.orderBy(`audit.${sortBy}`, sortOrder);

      // Pagination
      const skip = (page - 1) * limit;
      queryBuilder.skip(skip).take(limit);

      const [auditLogs, total] = await queryBuilder.getManyAndCount();

      return {
        success: true,
        auditLogs: auditLogs.map(log => this.sanitizeAuditLog(log)),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        },
        searchCriteria
      };

    } catch (error) {
      throw new Error(`Failed to search audit logs: ${error.message}`);
    }
  }

  /**
   * Verify audit log integrity
   */
  static async verifyIntegrity(batchSize = 1000) {
    try {
      const auditRepo = AppDataSource.getRepository('ComprehensiveAuditLog');
      const totalLogs = await auditRepo.count();

      let verifiedCount = 0;
      let corruptedLogs = [];

      for (let offset = 0; offset < totalLogs; offset += batchSize) {
        const logs = await auditRepo.find({
          skip: offset,
          take: batchSize,
          order: { loggedAt: 'ASC' }
        });

        for (const log of logs) {
          const calculatedChecksum = this.generateChecksum({
            ...log,
            checksumHash: undefined,
            digitalSignature: undefined
          });

          if (calculatedChecksum !== log.checksumHash) {
            corruptedLogs.push({
              id: log.id,
              eventTimestamp: log.eventTimestamp,
              eventType: log.eventType,
              expectedChecksum: calculatedChecksum,
              actualChecksum: log.checksumHash
            });
          } else {
            verifiedCount++;
          }
        }
      }

      const integrityReport = {
        totalLogs,
        verifiedLogs: verifiedCount,
        corruptedLogs: corruptedLogs.length,
        integrityPercentage: Math.round((verifiedCount / totalLogs) * 100),
        corruptedEntries: corruptedLogs,
        verifiedAt: new Date()
      };

      // Log integrity check
      await this.logEvent({
        eventType: 'integrity_verification',
        severity: corruptedLogs.length > 0 ? AuditSeverity.HIGH : AuditSeverity.LOW,
        eventDescription: `Audit log integrity verification completed`,
        metadata: integrityReport
      });

      return {
        success: true,
        integrityReport
      };

    } catch (error) {
      throw new Error(`Failed to verify audit log integrity: ${error.message}`);
    }
  }

  /**
   * Get audit statistics and trends
   */
  static async getAuditStatistics(timeRange = 30) {
    try {
      const auditRepo = AppDataSource.getRepository('ComprehensiveAuditLog');
      const startDate = new Date(Date.now() - (timeRange * 24 * 60 * 60 * 1000));

      // Event type distribution
      const eventTypeStats = await auditRepo.createQueryBuilder('audit')
        .select(['audit.eventType', 'COUNT(*) as count'])
        .where('audit.eventTimestamp >= :startDate', { startDate })
        .groupBy('audit.eventType')
        .orderBy('COUNT(*)', 'DESC')
        .getRawMany();

      // Severity distribution
      const severityStats = await auditRepo.createQueryBuilder('audit')
        .select(['audit.severity', 'COUNT(*) as count'])
        .where('audit.eventTimestamp >= :startDate', { startDate })
        .groupBy('audit.severity')
        .getRawMany();

      // Daily trends
      const dailyTrends = await auditRepo.createQueryBuilder('audit')
        .select(['DATE(audit.eventTimestamp) as date', 'COUNT(*) as count'])
        .where('audit.eventTimestamp >= :startDate', { startDate })
        .groupBy('DATE(audit.eventTimestamp)')
        .orderBy('DATE(audit.eventTimestamp)', 'ASC')
        .getRawMany();

      // Risk score distribution
      const riskStats = await auditRepo.createQueryBuilder('audit')
        .select([
          'AVG(audit.riskScore) as avg_risk',
          'MAX(audit.riskScore) as max_risk',
          'COUNT(CASE WHEN audit.riskScore >= 80 THEN 1 END) as high_risk_events'
        ])
        .where('audit.eventTimestamp >= :startDate', { startDate })
        .getRawOne();

      return {
        success: true,
        timeRange,
        statistics: {
          eventTypes: eventTypeStats.map(stat => ({
            eventType: stat.audit_eventtype || stat.eventType,
            count: parseInt(stat.count)
          })),
          severity: severityStats.map(stat => ({
            severity: stat.audit_severity || stat.severity,
            count: parseInt(stat.count)
          })),
          dailyTrends: dailyTrends.map(stat => ({
            date: stat.date,
            count: parseInt(stat.count)
          })),
          riskMetrics: {
            averageRisk: parseFloat(riskStats.avg_risk) || 0,
            maxRisk: parseInt(riskStats.max_risk) || 0,
            highRiskEvents: parseInt(riskStats.high_risk_events) || 0
          }
        }
      };

    } catch (error) {
      throw new Error(`Failed to get audit statistics: ${error.message}`);
    }
  }

  // Core helper methods

  /**
   * Enrich event data with additional context
   */
  static async enrichEventData(eventData) {
    const enriched = {
      ...eventData,
      eventTimestamp: eventData.eventTimestamp || new Date(),
      outcome: eventData.outcome || 'SUCCESS',
      authenticationMethod: eventData.authenticationMethod || 'bearer_token',
      minimumDisclosure: eventData.minimumDisclosure !== false
    };

    // Add user role if not provided
    if (eventData.userId && !eventData.userRole) {
      try {
        const userRepo = AppDataSource.getRepository('User');
        const user = await userRepo.findOne({ where: { id: eventData.userId } });
        if (user) {
          enriched.userRole = user.role || 'user';
        }
      } catch (error) {
        // Continue if user lookup fails
      }
    }

    // Add session information
    if (!enriched.sessionId) {
      enriched.sessionId = this.generateSessionId();
    }

    return enriched;
  }

  /**
   * Calculate risk score for audit event
   */
  static calculateRiskScore(eventData) {
    let score = 0;
    const riskFactors = [];

    // Base score by event type
    const eventTypeRisk = {
      [AuditEventType.EMERGENCY_ACCESS]: 40,
      [AuditEventType.PERMISSION_DENIED]: 30,
      [AuditEventType.LOGIN_FAILURE]: 20,
      [AuditEventType.DATA_EXPORT]: 25,
      [AuditEventType.FILE_DELETE]: 15,
      [AuditEventType.PATIENT_DATA_ACCESS]: 10,
      [AuditEventType.CONSENT_WITHDRAWN]: 20,
      [AuditEventType.KEY_ROTATION]: 5
    };

    score += eventTypeRisk[eventData.eventType] || 5;
    if (eventTypeRisk[eventData.eventType]) {
      riskFactors.push(`High-risk event type: ${eventData.eventType}`);
    }

    // Failed outcome
    if (eventData.outcome === 'FAILURE') {
      score += 20;
      riskFactors.push('Failed operation');
    }

    // Off-hours access
    const hour = new Date(eventData.eventTimestamp).getHours();
    if (hour < 8 || hour > 18) {
      score += 15;
      riskFactors.push('Off-hours access');
    }

    // Emergency access
    if (eventData.isEmergencyAccess) {
      score += 25;
      riskFactors.push('Emergency access used');
    }

    // Large data size
    if (eventData.dataSize && eventData.dataSize > 100000000) { // 100MB
      score += 20;
      riskFactors.push('Large data volume');
    }

    // No consent check for patient data
    if (eventData.patientIdentifier && !eventData.consentChecked) {
      score += 30;
      riskFactors.push('Patient data accessed without consent verification');
    }

    // External IP
    if (eventData.ipAddress && this.isExternalIP(eventData.ipAddress)) {
      score += 15;
      riskFactors.push('External IP address');
    }

    eventData.riskFactors = riskFactors;
    return Math.min(100, score);
  }

  /**
   * Determine applicable compliance frameworks
   */
  static determineComplianceFrameworks(eventData) {
    const frameworks = [];

    // HIPAA applies to all patient data events
    if (eventData.patientIdentifier || eventData.fhirResourceType) {
      frameworks.push(ComplianceFramework.HIPAA);
    }

    // GDPR applies to all personal data events
    if (eventData.userId || eventData.patientIdentifier) {
      frameworks.push(ComplianceFramework.GDPR);
    }

    // FDA 21 CFR Part 11 for electronic records
    if (eventData.resourceType === 'file' && eventData.encryptionUsed) {
      frameworks.push(ComplianceFramework.FDA_21CFR11);
    }

    // ISO 27001 for security events
    if ([
      AuditEventType.LOGIN_FAILURE,
      AuditEventType.PERMISSION_DENIED,
      AuditEventType.EMERGENCY_ACCESS
    ].includes(eventData.eventType)) {
      frameworks.push(ComplianceFramework.ISO27001);
    }

    return frameworks;
  }

  /**
   * Calculate retention period based on compliance requirements
   */
  static calculateRetentionPeriod(eventData) {
    const frameworks = eventData.complianceFrameworks || [];

    let maxRetention = 2555; // 7 years default

    if (frameworks.includes(ComplianceFramework.HIPAA)) {
      maxRetention = Math.max(maxRetention, 2555); // 7 years
    }

    if (frameworks.includes(ComplianceFramework.GDPR)) {
      maxRetention = Math.max(maxRetention, 1825); // 5 years
    }

    if (frameworks.includes(ComplianceFramework.FDA_21CFR11)) {
      maxRetention = Math.max(maxRetention, 3650); // 10 years
    }

    // High-risk events have longer retention
    if (eventData.riskScore >= 70) {
      maxRetention = Math.max(maxRetention, 3650); // 10 years
    }

    return maxRetention;
  }

  /**
   * Generate digital signature for tamper detection
   */
  static generateDigitalSignature(eventData) {
    const signingKey = process.env.AUDIT_SIGNING_KEY || 'default-signing-key';
    const dataToSign = JSON.stringify({
      eventType: eventData.eventType,
      userId: eventData.userId,
      patientIdentifier: eventData.patientIdentifier,
      eventTimestamp: eventData.eventTimestamp,
      outcome: eventData.outcome
    });

    return crypto.createHmac('sha256', signingKey)
      .update(dataToSign)
      .digest('hex');
  }

  /**
   * Generate checksum for integrity verification
   */
  static generateChecksum(eventData) {
    const checksumData = JSON.stringify(eventData, Object.keys(eventData).sort());
    return crypto.createHash('sha256').update(checksumData).digest('hex');
  }

  /**
   * Generate session ID
   */
  static generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Check if IP is external (not private)
   */
  static isExternalIP(ip) {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^localhost$/i
    ];

    return !privateRanges.some(range => range.test(ip));
  }

  /**
   * Sanitize audit log for API response
   */
  static sanitizeAuditLog(log) {
    // Remove sensitive fields before sending to API
    const sanitized = { ...log };

    // Remove checksum and signature for security
    delete sanitized.checksumHash;
    delete sanitized.digitalSignature;

    // Limit metadata if too large
    if (sanitized.metadata && JSON.stringify(sanitized.metadata).length > 5000) {
      sanitized.metadata = {
        ...sanitized.metadata,
        _truncated: true,
        _originalSize: JSON.stringify(log.metadata).length
      };
    }

    return sanitized;
  }

  /**
   * Failsafe event logging
   */
  static async logFailsafeEvent(eventData) {
    try {
      // Simple logging when main audit system fails
      const simpleLog = {
        timestamp: new Date().toISOString(),
        event: eventData.eventType,
        description: eventData.eventDescription,
        severity: eventData.severity,
        failsafe: true
      };

      console.error('⚠️ FAILSAFE AUDIT LOG:', simpleLog);

    } catch (error) {
      console.error('💥 CRITICAL: All audit logging failed:', error);
    }
  }

  /**
   * Trigger security alert for high-risk events
   */
  static async triggerSecurityAlert(auditLog) {
    try {
      const alertData = {
        alertId: crypto.randomUUID(),
        eventId: auditLog.id,
        eventType: auditLog.eventType,
        severity: auditLog.severity,
        riskScore: auditLog.riskScore,
        description: auditLog.eventDescription,
        timestamp: auditLog.eventTimestamp
      };

      console.warn('🚨 SECURITY ALERT:', alertData);

      // Log the alert itself
      await this.logEvent({
        eventType: 'security_alert_triggered',
        severity: AuditSeverity.HIGH,
        eventDescription: `Security alert triggered for event ${auditLog.id}`,
        metadata: {
          originalEventId: auditLog.id,
          alertReason: 'High risk score or critical severity',
          riskScore: auditLog.riskScore
        }
      });

    } catch (error) {
      console.error('Failed to trigger security alert:', error);
    }
  }
}

module.exports = AdvancedAuditService;