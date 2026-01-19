// ===== COMPONENT 3: COMPLIANCE REPORTS & EXPORT TOOLS =====
// src/services/auditComplianceReports.js

const AppDataSource = require('../../../config/database');
const crypto = require('crypto');
const { AuditEventType, AuditSeverity, ComplianceFramework } = require('../entities/ComprehensiveAuditLog');
const AdvancedAuditService = require('./advancedAuditService');

class AuditComplianceReports {

  /**
   * Generate compliance report based on framework
   */
  static async generateComplianceReport(framework, dateRange, filters = {}) {
    try {
      const auditRepo = AppDataSource.getRepository('ComprehensiveAuditLog');

      // Build query based on framework and filters
      const queryBuilder = auditRepo.createQueryBuilder('audit')
        .where('audit.complianceFrameworks @> :framework', {
          framework: JSON.stringify([framework])
        })
        .andWhere('audit.eventTimestamp BETWEEN :startDate AND :endDate', {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        });

      // Apply additional filters
      if (filters.patientIdentifier) {
        queryBuilder.andWhere('audit.patientIdentifier = :patientId', {
          patientId: filters.patientIdentifier
        });
      }

      if (filters.userId) {
        queryBuilder.andWhere('audit.userId = :userId', { userId: filters.userId });
      }

      if (filters.eventTypes) {
        queryBuilder.andWhere('audit.eventType IN (:...eventTypes)', {
          eventTypes: filters.eventTypes
        });
      }

      if (filters.severity) {
        queryBuilder.andWhere('audit.severity = :severity', { severity: filters.severity });
      }

      // Execute query
      const auditLogs = await queryBuilder.getMany();

      // Generate report based on framework
      let report = {};

      switch (framework) {
        case ComplianceFramework.HIPAA:
          report = await this.generateHIPAAReport(auditLogs, dateRange);
          break;
        case ComplianceFramework.GDPR:
          report = await this.generateGDPRReport(auditLogs, dateRange);
          break;
        case ComplianceFramework.FDA_21CFR11:
          report = await this.generateFDAReport(auditLogs, dateRange);
          break;
        default:
          report = await this.generateGenericReport(auditLogs, dateRange);
      }

      // Add digital signature to report
      report.digitalSignature = this.generateReportSignature(report);
      report.generatedAt = new Date();

      // Log report generation
      await AdvancedAuditService.logEvent({
        eventType: AuditEventType.COMPLIANCE_REPORT,
        severity: AuditSeverity.MEDIUM,
        eventDescription: `Generated ${framework} compliance report`,
        metadata: {
          framework,
          dateRange,
          totalRecords: auditLogs.length,
          reportHash: crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex')
        }
      });

      return {
        success: true,
        report,
        totalRecords: auditLogs.length
      };

    } catch (error) {
      throw new Error(`Failed to generate compliance report: ${error.message}`);
    }
  }

  /**
   * Generate HIPAA compliance report
   */
  static async generateHIPAAReport(auditLogs, dateRange) {
    const report = {
      framework: 'HIPAA',
      period: dateRange,
      summary: {
        totalEvents: auditLogs.length,
        patientDataAccesses: 0,
        emergencyAccesses: 0,
        consentViolations: 0,
        minimumNecessaryViolations: 0,
        unauthorizedAccess: 0,
        dataBreaches: 0
      },
      breachAnalysis: [],
      accessPatterns: {},
      securityIncidents: [],
      recommendations: []
    };

    for (const log of auditLogs) {
      // Count patient data accesses
      if (log.patientIdentifier) {
        report.summary.patientDataAccesses++;

        // Check for consent violations
        if (!log.consentChecked) {
          report.summary.consentViolations++;
        }

        // Check minimum necessary principle
        if (!log.minimumDisclosure) {
          report.summary.minimumNecessaryViolations++;
        }

        // Check for unauthorized access
        if (log.outcome === 'FAILURE' && log.eventType === AuditEventType.PERMISSION_DENIED) {
          report.summary.unauthorizedAccess++;
        }
      }

      // Count emergency accesses
      if (log.isEmergencyAccess) {
        report.summary.emergencyAccesses++;
      }

      // Track access patterns by user
      if (log.userId) {
        if (!report.accessPatterns[log.userId]) {
          report.accessPatterns[log.userId] = {
            totalAccess: 0,
            patientAccess: 0,
            emergencyAccess: 0,
            failedAccess: 0
          };
        }
        report.accessPatterns[log.userId].totalAccess++;

        if (log.patientIdentifier) {
          report.accessPatterns[log.userId].patientAccess++;
        }

        if (log.isEmergencyAccess) {
          report.accessPatterns[log.userId].emergencyAccess++;
        }

        if (log.outcome === 'FAILURE') {
          report.accessPatterns[log.userId].failedAccess++;
        }
      }

      // Identify potential breaches (high-risk events)
      if (log.riskScore >= 80 || log.severity === 'critical') {
        report.breachAnalysis.push({
          eventId: log.id,
          eventType: log.eventType,
          riskScore: log.riskScore,
          description: log.eventDescription,
          timestamp: log.eventTimestamp,
          patientAffected: log.patientIdentifier,
          mitigationRequired: true
        });
      }

      // Security incidents
      if (log.eventType === AuditEventType.PERMISSION_DENIED ||
        log.eventType === AuditEventType.LOGIN_FAILURE) {
        report.securityIncidents.push({
          eventId: log.id,
          eventType: log.eventType,
          timestamp: log.eventTimestamp,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent
        });
      }
    }

    // Generate recommendations
    if (report.summary.consentViolations > 0) {
      report.recommendations.push({
        priority: 'high',
        issue: 'Patient consent not verified',
        count: report.summary.consentViolations,
        recommendation: 'Implement mandatory consent verification for all patient data access',
        compliance: 'HIPAA §164.508 - Authorization for uses and disclosures'
      });
    }

    if (report.summary.minimumNecessaryViolations > 0) {
      report.recommendations.push({
        priority: 'high',
        issue: 'Minimum necessary standard not followed',
        count: report.summary.minimumNecessaryViolations,
        recommendation: 'Ensure all data access follows minimum necessary principle',
        compliance: 'HIPAA §164.502(b) - Minimum necessary standard'
      });
    }

    if (report.summary.emergencyAccesses > 10) {
      report.recommendations.push({
        priority: 'medium',
        issue: 'High emergency access usage',
        count: report.summary.emergencyAccesses,
        recommendation: 'Review emergency access procedures and provide additional training',
        compliance: 'HIPAA §164.308(a)(4) - Information access management'
      });
    }

    // Calculate compliance score
    const totalChecks = 4;
    let passedChecks = 0;

    if (report.summary.consentViolations === 0) passedChecks++;
    if (report.summary.minimumNecessaryViolations === 0) passedChecks++;
    if (report.summary.emergencyAccesses <= 10) passedChecks++;
    if (report.breachAnalysis.length === 0) passedChecks++;

    report.complianceScore = Math.round((passedChecks / totalChecks) * 100);

    return report;
  }

  /**
   * Generate GDPR compliance report
   */
  static async generateGDPRReport(auditLogs, dateRange) {
    const report = {
      framework: 'GDPR',
      period: dateRange,
      summary: {
        totalEvents: auditLogs.length,
        dataSubjectRequests: 0,
        dataExports: 0,
        dataRetentionEvents: 0,
        consentWithdrawals: 0,
        crossBorderTransfers: 0,
        rightToErasure: 0
      },
      rightsExercise: {},
      dataMovement: [],
      dataProcessingActivities: {},
      recommendations: []
    };

    for (const log of auditLogs) {
      // Track data subject rights exercise
      if (log.eventType === AuditEventType.DATA_EXPORT) {
        report.summary.dataExports++;

        if (log.exportDestination) {
          report.dataMovement.push({
            timestamp: log.eventTimestamp,
            destination: log.exportDestination,
            dataSize: log.dataSize,
            purpose: log.purposeOfUse,
            legalBasis: log.metadata?.legalBasis || 'not_specified'
          });

          // Check for cross-border transfers
          if (log.metadata?.crossBorder) {
            report.summary.crossBorderTransfers++;
          }
        }
      }

      if (log.eventType === AuditEventType.CONSENT_WITHDRAWN) {
        report.summary.consentWithdrawals++;
      }

      if (log.eventType === AuditEventType.DATA_RETENTION) {
        report.summary.dataRetentionEvents++;
      }

      if (log.eventType === AuditEventType.FILE_DELETE &&
        log.metadata?.deletionReason === 'right_to_erasure') {
        report.summary.rightToErasure++;
      }

      // Track data processing activities by purpose
      if (log.purposeOfUse) {
        if (!report.dataProcessingActivities[log.purposeOfUse]) {
          report.dataProcessingActivities[log.purposeOfUse] = {
            count: 0,
            dataSubjects: new Set(),
            legalBases: new Set()
          };
        }

        report.dataProcessingActivities[log.purposeOfUse].count++;

        if (log.patientIdentifier) {
          report.dataProcessingActivities[log.purposeOfUse].dataSubjects.add(log.patientIdentifier);
        }

        if (log.metadata?.legalBasis) {
          report.dataProcessingActivities[log.purposeOfUse].legalBases.add(log.metadata.legalBasis);
        }
      }
    }

    // Convert Sets to arrays for JSON serialization
    for (const activity of Object.values(report.dataProcessingActivities)) {
      activity.dataSubjects = activity.dataSubjects.size;
      activity.legalBases = Array.from(activity.legalBases);
    }

    // GDPR-specific recommendations
    if (report.summary.dataExports > 0 && report.summary.crossBorderTransfers === 0) {
      report.recommendations.push({
        priority: 'medium',
        issue: 'Data exports detected without cross-border transfer documentation',
        count: report.summary.dataExports,
        recommendation: 'Ensure all international data transfers have appropriate safeguards',
        compliance: 'GDPR Article 44 - General principle for transfers'
      });
    }

    if (report.summary.consentWithdrawals > 0 && report.summary.rightToErasure === 0) {
      report.recommendations.push({
        priority: 'high',
        issue: 'Consent withdrawals without corresponding data erasure',
        count: report.summary.consentWithdrawals,
        recommendation: 'Implement automated data erasure when consent is withdrawn',
        compliance: 'GDPR Article 17 - Right to erasure'
      });
    }

    return report;
  }

  /**
   * Generate FDA 21 CFR Part 11 report
   */
  static async generateFDAReport(auditLogs, dateRange) {
    const report = {
      framework: 'FDA 21 CFR Part 11',
      period: dateRange,
      summary: {
        totalEvents: auditLogs.length,
        electronicRecordEvents: 0,
        digitalSignatureEvents: 0,
        systemChanges: 0,
        integrityViolations: 0,
        accessControlEvents: 0,
        auditTrailEvents: 0
      },
      electronicRecords: {},
      systemSecurity: [],
      integrityChecks: [],
      recommendations: []
    };

    for (const log of auditLogs) {
      // Track electronic record events
      if (log.resourceType === 'file' && log.encryptionUsed) {
        report.summary.electronicRecordEvents++;

        const recordType = log.fhirResourceType || 'unknown';
        if (!report.electronicRecords[recordType]) {
          report.electronicRecords[recordType] = {
            count: 0,
            encrypted: 0,
            digitallySigned: 0
          };
        }

        report.electronicRecords[recordType].count++;
        report.electronicRecords[recordType].encrypted++;
      }

      // Track digital signature usage
      if (log.digitalSignature) {
        report.summary.digitalSignatureEvents++;

        if (log.fhirResourceType && report.electronicRecords[log.fhirResourceType]) {
          report.electronicRecords[log.fhirResourceType].digitallySigned++;
        }
      }

      // Identify system changes
      if ([
        AuditEventType.KEY_ROTATION,
        AuditEventType.KEY_GENERATION,
        'system_configuration_change'
      ].includes(log.eventType)) {
        report.summary.systemChanges++;

        report.systemSecurity.push({
          timestamp: log.eventTimestamp,
          eventType: log.eventType,
          description: log.eventDescription,
          userId: log.userId,
          riskScore: log.riskScore
        });
      }

      // Track access control events
      if ([
        AuditEventType.LOGIN_SUCCESS,
        AuditEventType.LOGIN_FAILURE,
        AuditEventType.PERMISSION_DENIED
      ].includes(log.eventType)) {
        report.summary.accessControlEvents++;
      }

      // All audit events contribute to audit trail
      report.summary.auditTrailEvents++;
    }

    // FDA-specific recommendations
    const totalRecords = Object.values(report.electronicRecords)
      .reduce((sum, record) => sum + record.count, 0);
    const totalSigned = Object.values(report.electronicRecords)
      .reduce((sum, record) => sum + record.digitallySigned, 0);

    if (totalRecords > 0 && (totalSigned / totalRecords) < 0.9) {
      report.recommendations.push({
        priority: 'high',
        issue: 'Insufficient digital signature coverage',
        recommendation: 'Ensure all electronic records are digitally signed per 21 CFR Part 11',
        compliance: '21 CFR 11.70 - Signature/record linking'
      });
    }

    return report;
  }

  /**
   * Generate generic compliance report
   */
  static async generateGenericReport(auditLogs, dateRange) {
    const eventTypeCounts = {};
    const severityCounts = {};
    const outcomeCounts = {};
    const userActivity = {};
    const hourlyDistribution = {};

    auditLogs.forEach(log => {
      // Event type distribution
      eventTypeCounts[log.eventType] = (eventTypeCounts[log.eventType] || 0) + 1;

      // Severity distribution
      severityCounts[log.severity] = (severityCounts[log.severity] || 0) + 1;

      // Outcome distribution
      outcomeCounts[log.outcome] = (outcomeCounts[log.outcome] || 0) + 1;

      // User activity
      if (log.userId) {
        userActivity[log.userId] = (userActivity[log.userId] || 0) + 1;
      }

      // Hourly distribution
      const hour = new Date(log.eventTimestamp).getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
    });

    // Calculate risk metrics
    const riskScores = auditLogs.map(log => log.riskScore || 0);
    const avgRiskScore = riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length;
    const highRiskEvents = auditLogs.filter(log => (log.riskScore || 0) >= 80).length;

    return {
      framework: 'Generic',
      period: dateRange,
      summary: {
        totalEvents: auditLogs.length,
        eventTypes: Object.keys(eventTypeCounts).length,
        uniqueUsers: Object.keys(userActivity).length,
        avgRiskScore: Math.round(avgRiskScore * 100) / 100,
        highRiskEvents,
        failureRate: Math.round((outcomeCounts.FAILURE || 0) / auditLogs.length * 100)
      },
      breakdown: {
        eventTypes: eventTypeCounts,
        severity: severityCounts,
        outcomes: outcomeCounts,
        topUsers: Object.entries(userActivity)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([userId, count]) => ({ userId, activityCount: count })),
        hourlyDistribution
      }
    };
  }

  /**
   * Automated compliance monitoring
   */
  static async runComplianceMonitoring() {
    try {
      const results = {
        timestamp: new Date(),
        checks: [],
        overallCompliance: 0,
        criticalIssues: [],
        recommendations: []
      };

      // Check 1: Audit log retention
      const auditRepo = AppDataSource.getRepository('ComprehensiveAuditLog');
      const oldLogsCount = await auditRepo.count({
        where: {
          loggedAt: { $lt: new Date(Date.now() - (7 * 365 * 24 * 60 * 60 * 1000)) }
        }
      });

      results.checks.push({
        name: 'Audit Log Retention',
        status: oldLogsCount === 0 ? 'PASS' : 'FAIL',
        details: `${oldLogsCount} logs exceed retention period`,
        compliance: ['hipaa', 'gdpr']
      });

      // Check 2: Encryption coverage
      const fileRepo = AppDataSource.getRepository('DocumentFile');
      const unencryptedSensitiveFiles = await fileRepo.count({
        where: {
          fhirSensitivityLevel: 'very_high',
          isEncrypted: false,
          status: { $ne: 'deleted' }
        }
      });

      results.checks.push({
        name: 'Encryption Coverage',
        status: unencryptedSensitiveFiles === 0 ? 'PASS' : 'FAIL',
        details: `${unencryptedSensitiveFiles} sensitive files not encrypted`,
        compliance: ['hipaa', 'gdpr', 'fda_21cfr11']
      });

      // Check 3: Consent verification
      const unconsentedAccesses = await auditRepo.count({
        where: {
          eventTimestamp: { $gte: new Date(Date.now() - (24 * 60 * 60 * 1000)) },
          patientIdentifier: { $ne: null },
          consentChecked: false
        }
      });

      results.checks.push({
        name: 'Consent Verification',
        status: unconsentedAccesses === 0 ? 'PASS' : 'FAIL',
        details: `${unconsentedAccesses} patient data accesses without consent verification in last 24h`,
        compliance: ['hipaa', 'gdpr']
      });

      // Calculate overall compliance
      const passedChecks = results.checks.filter(check => check.status === 'PASS').length;
      results.overallCompliance = Math.round((passedChecks / results.checks.length) * 100);

      // Identify critical issues
      results.criticalIssues = results.checks
        .filter(check => check.status === 'FAIL')
        .map(check => ({
          issue: check.name,
          details: check.details,
          compliance: check.compliance
        }));

      // Generate recommendations
      if (results.overallCompliance < 80) {
        results.recommendations.push({
          priority: 'high',
          recommendation: 'Overall compliance below 80%. Immediate attention required.',
          actions: ['Review failed compliance checks', 'Implement corrective measures']
        });
      }

      // Log monitoring results
      await AdvancedAuditService.logEvent({
        eventType: AuditEventType.COMPLIANCE_REPORT,
        severity: results.overallCompliance >= 90 ? AuditSeverity.LOW : AuditSeverity.HIGH,
        eventDescription: `Automated compliance monitoring completed`,
        metadata: {
          complianceScore: results.overallCompliance,
          criticalIssues: results.criticalIssues.length,
          checksPerformed: results.checks.length
        }
      });

      return {
        success: true,
        results
      };

    } catch (error) {
      throw new Error(`Failed to run compliance monitoring: ${error.message}`);
    }
  }

  /**
   * Export audit logs for external analysis
   */
  static async exportAuditLogs(criteria, format = 'json') {
    try {
      const auditLogs = await AdvancedAuditService.searchAuditLogs(criteria, { limit: 10000 });

      let exportData;
      let contentType;
      let fileExtension;

      switch (format.toLowerCase()) {
        case 'csv':
          exportData = this.convertToCSV(auditLogs.auditLogs);
          contentType = 'text/csv';
          fileExtension = 'csv';
          break;
        case 'json':
          exportData = JSON.stringify(auditLogs.auditLogs, null, 2);
          contentType = 'application/json';
          fileExtension = 'json';
          break;
        case 'xml':
          exportData = this.convertToXML(auditLogs.auditLogs);
          contentType = 'application/xml';
          fileExtension = 'xml';
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // Log export activity
      await AdvancedAuditService.logEvent({
        eventType: AuditEventType.DATA_EXPORT,
        severity: AuditSeverity.MEDIUM,
        eventDescription: `Exported ${auditLogs.auditLogs.length} audit logs in ${format} format`,
        dataExported: true,
        dataSize: Buffer.byteLength(exportData, 'utf8'),
        metadata: {
          exportFormat: format,
          recordCount: auditLogs.auditLogs.length,
          exportCriteria: criteria
        }
      });

      return {
        success: true,
        data: exportData,
        contentType,
        filename: `audit-export-${new Date().toISOString().split('T')[0]}.${fileExtension}`,
        recordCount: auditLogs.auditLogs.length
      };

    } catch (error) {
      throw new Error(`Failed to export audit logs: ${error.message}`);
    }
  }

  /**
   * Convert audit logs to CSV format
   */
  static convertToCSV(auditLogs) {
    if (auditLogs.length === 0) return '';

    const headers = [
      'id', 'eventType', 'severity', 'eventTimestamp', 'userId', 'patientIdentifier',
      'resourceId', 'eventDescription', 'outcome', 'riskScore', 'ipAddress',
      'isEmergencyAccess', 'consentChecked', 'encryptionUsed'
    ];

    const csvRows = [headers.join(',')];

    for (const log of auditLogs) {
      const row = headers.map(header => {
        let value = log[header];

        // Handle special cases
        if (value === null || value === undefined) value = '';
        if (typeof value === 'string' && value.includes(',')) value = `"${value}"`;
        if (value instanceof Date) value = value.toISOString();

        return value;
      });

      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Convert audit logs to XML format
   */
  static convertToXML(auditLogs) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<auditLogs>\n';

    for (const log of auditLogs) {
      xml += '  <auditLog>\n';

      for (const [key, value] of Object.entries(log)) {
        if (value !== null && value !== undefined) {
          const escapedValue = String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

          xml += `    <${key}>${escapedValue}</${key}>\n`;
        }
      }

      xml += '  </auditLog>\n';
    }

    xml += '</auditLogs>';
    return xml;
  }

  /**
   * Generate report signature for tamper detection
   */
  static generateReportSignature(report) {
    const signingKey = process.env.REPORT_SIGNING_KEY || 'default-report-key';
    const reportString = JSON.stringify(report, Object.keys(report).sort());

    return crypto.createHmac('sha256', signingKey)
      .update(reportString)
      .digest('hex');
  }

  /**
   * Generate executive summary report
   */
  static async generateExecutiveSummary(timeRange = 30) {
    try {
      const auditRepo = AppDataSource.getRepository('ComprehensiveAuditLog');
      const startDate = new Date(Date.now() - (timeRange * 24 * 60 * 60 * 1000));

      // Key metrics
      const metrics = await auditRepo.createQueryBuilder('audit')
        .select([
          'COUNT(*) as total_events',
          'COUNT(DISTINCT audit.userId) as active_users',
          'COUNT(DISTINCT audit.patientIdentifier) as patients_accessed',
          'AVG(audit.riskScore) as avg_risk_score',
          'COUNT(CASE WHEN audit.riskScore >= 80 THEN 1 END) as high_risk_events',
          'COUNT(CASE WHEN audit.isEmergencyAccess = true THEN 1 END) as emergency_accesses'
        ])
        .where('audit.eventTimestamp >= :startDate', { startDate })
        .getRawOne();

      // Compliance scores
      const complianceMonitoring = await this.runComplianceMonitoring();

      // Security incidents
      const securityIncidents = await auditRepo.count({
        where: {
          eventTimestamp: { $gte: startDate },
          eventType: { $in: [AuditEventType.LOGIN_FAILURE, AuditEventType.PERMISSION_DENIED] },
          outcome: 'FAILURE'
        }
      });

      // Trends
      const previousPeriodStart = new Date(startDate.getTime() - (timeRange * 24 * 60 * 60 * 1000));
      const previousMetrics = await auditRepo.createQueryBuilder('audit')
        .select(['COUNT(*) as total_events', 'AVG(audit.riskScore) as avg_risk_score'])
        .where('audit.eventTimestamp BETWEEN :previousStart AND :currentStart', {
          previousStart: previousPeriodStart,
          currentStart: startDate
        })
        .getRawOne();

      const summary = {
        reportPeriod: timeRange,
        generatedAt: new Date(),
        keyMetrics: {
          totalEvents: parseInt(metrics.total_events) || 0,
          activeUsers: parseInt(metrics.active_users) || 0,
          patientsAccessed: parseInt(metrics.patients_accessed) || 0,
          averageRiskScore: Math.round((parseFloat(metrics.avg_risk_score) || 0) * 100) / 100,
          highRiskEvents: parseInt(metrics.high_risk_events) || 0,
          emergencyAccesses: parseInt(metrics.emergency_accesses) || 0,
          securityIncidents
        },
        trends: {
          eventVolumeTrend: this.calculateTrend(
            parseInt(previousMetrics.total_events) || 0,
            parseInt(metrics.total_events) || 0
          ),
          riskScoreTrend: this.calculateTrend(
            parseFloat(previousMetrics.avg_risk_score) || 0,
            parseFloat(metrics.avg_risk_score) || 0
          )
        },
        complianceStatus: {
          overallScore: complianceMonitoring.results.overallCompliance,
          criticalIssues: complianceMonitoring.results.criticalIssues.length,
          passedChecks: complianceMonitoring.results.checks.filter(c => c.status === 'PASS').length,
          totalChecks: complianceMonitoring.results.checks.length
        },
        riskAssessment: {
          level: this.categorizeRiskLevel(parseFloat(metrics.avg_risk_score) || 0),
          highRiskEventRate: Math.round(((parseInt(metrics.high_risk_events) || 0) / (parseInt(metrics.total_events) || 1)) * 100),
          emergencyAccessRate: Math.round(((parseInt(metrics.emergency_accesses) || 0) / (parseInt(metrics.total_events) || 1)) * 100)
        },
        recommendations: this.generateExecutiveRecommendations(metrics, complianceMonitoring.results)
      };

      return {
        success: true,
        summary
      };

    } catch (error) {
      throw new Error(`Failed to generate executive summary: ${error.message}`);
    }
  }

  /**
   * Calculate trend percentage
   */
  static calculateTrend(previous, current) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  /**
   * Categorize risk level
   */
  static categorizeRiskLevel(avgRisk) {
    if (avgRisk >= 80) return 'critical';
    if (avgRisk >= 60) return 'high';
    if (avgRisk >= 40) return 'medium';
    return 'low';
  }

  /**
   * Generate executive recommendations
   */
  static generateExecutiveRecommendations(metrics, complianceResults) {
    const recommendations = [];

    // High risk events
    if (parseInt(metrics.high_risk_events) > 10) {
      recommendations.push({
        priority: 'critical',
        category: 'Security',
        issue: `${metrics.high_risk_events} high-risk security events detected`,
        action: 'Implement immediate security review and enhanced monitoring'
      });
    }

    // Compliance issues
    if (complianceResults.overallCompliance < 90) {
      recommendations.push({
        priority: 'high',
        category: 'Compliance',
        issue: `Compliance score at ${complianceResults.overallCompliance}%`,
        action: 'Address compliance gaps and implement corrective measures'
      });
    }

    // Emergency access
    if (parseInt(metrics.emergency_accesses) > 20) {
      recommendations.push({
        priority: 'medium',
        category: 'Access Control',
        issue: `${metrics.emergency_accesses} emergency access events`,
        action: 'Review emergency access procedures and provide staff training'
      });
    }

    return recommendations;
  }
}

module.exports = AuditComplianceReports;