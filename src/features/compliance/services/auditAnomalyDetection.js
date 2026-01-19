// ===== COMPONENT 2: ANOMALY DETECTION & SECURITY MONITORING =====
// src/services/auditAnomalyDetection.js

const AppDataSource = require('../../../config/database');
const { AuditEventType, AuditSeverity } = require('../entities/ComprehensiveAuditLog');
const AdvancedAuditService = require('./advancedAuditService');

class AuditAnomalyDetection {

  /**
   * Detect audit anomalies and security incidents
   */
  static async detectAnomalies(timeWindow = 24) {
    try {
      const auditRepo = AppDataSource.getRepository('ComprehensiveAuditLog');
      const windowStart = new Date(Date.now() - (timeWindow * 60 * 60 * 1000));

      const anomalies = [];

      // 1. Unusual access patterns
      const accessPatterns = await this.detectUnusualAccessPatterns(auditRepo, windowStart);
      if (accessPatterns.length > 0) {
        anomalies.push({
          type: 'unusual_access_volume',
          severity: AuditSeverity.HIGH,
          description: 'Unusually high access volume detected',
          details: accessPatterns
        });
      }

      // 2. Failed login attempts (brute force)
      const failedLogins = await this.detectBruteForceAttempts(auditRepo, windowStart);
      if (failedLogins.length > 0) {
        anomalies.push({
          type: 'brute_force_attempt',
          severity: AuditSeverity.CRITICAL,
          description: 'Potential brute force attack detected',
          details: failedLogins
        });
      }

      // 3. Emergency access usage
      const emergencyAccess = await this.detectExcessiveEmergencyAccess(auditRepo, windowStart);
      if (emergencyAccess.count > 5) {
        anomalies.push({
          type: 'excessive_emergency_access',
          severity: AuditSeverity.HIGH,
          description: 'Excessive emergency access usage',
          details: emergencyAccess
        });
      }

      // 4. Off-hours access
      const offHoursAccess = await this.detectOffHoursAccess(auditRepo, windowStart);
      if (offHoursAccess.count > 20) {
        anomalies.push({
          type: 'off_hours_access',
          severity: AuditSeverity.MEDIUM,
          description: 'Unusual off-hours access pattern',
          details: offHoursAccess
        });
      }

      // 5. Large data exports
      const dataExports = await this.detectLargeDataExports(auditRepo, windowStart);
      if (dataExports.totalSize > 1000000000) { // 1GB
        anomalies.push({
          type: 'large_data_export',
          severity: AuditSeverity.HIGH,
          description: 'Large volume data export detected',
          details: dataExports
        });
      }

      // 6. Sequential access anomalies
      const sequentialAnomalies = await this.detectSequentialAnomalies(auditRepo, windowStart);
      if (sequentialAnomalies.length > 0) {
        anomalies.push({
          type: 'sequential_access_anomaly',
          severity: AuditSeverity.HIGH,
          description: 'Suspicious sequential access patterns',
          details: sequentialAnomalies
        });
      }

      // 7. Permission escalation attempts
      const escalationAttempts = await this.detectPermissionEscalation(auditRepo, windowStart);
      if (escalationAttempts.count > 15) {
        anomalies.push({
          type: 'permission_escalation',
          severity: AuditSeverity.HIGH,
          description: 'Multiple permission escalation attempts detected',
          details: escalationAttempts
        });
      }

      // Log anomaly detection results
      await AdvancedAuditService.logEvent({
        eventType: 'anomaly_detection_completed',
        severity: anomalies.length > 0 ? AuditSeverity.HIGH : AuditSeverity.LOW,
        eventDescription: `Anomaly detection completed: ${anomalies.length} anomalies found`,
        metadata: {
          timeWindow,
          anomaliesDetected: anomalies.length,
          anomalyTypes: anomalies.map(a => a.type)
        }
      });

      return {
        success: true,
        anomalies,
        timeWindow,
        detectedAt: new Date()
      };

    } catch (error) {
      throw new Error(`Failed to detect anomalies: ${error.message}`);
    }
  }

  /**
   * Detect unusual access patterns
   */
  static async detectUnusualAccessPatterns(auditRepo, windowStart) {
    const accessPatterns = await auditRepo.createQueryBuilder('audit')
      .select(['audit.userId', 'COUNT(*) as access_count', 'audit.ipAddress'])
      .where('audit.eventTimestamp > :windowStart', { windowStart })
      .andWhere('audit.eventType IN (:...accessTypes)', {
        accessTypes: [
          AuditEventType.FILE_DOWNLOAD,
          AuditEventType.PATIENT_DATA_ACCESS,
          AuditEventType.FHIR_RESOURCE_ACCESS
        ]
      })
      .groupBy('audit.userId, audit.ipAddress')
      .having('COUNT(*) > :threshold', { threshold: 100 })
      .getRawMany();

    return accessPatterns.map(pattern => ({
      userId: pattern.audit_userid || pattern.userId,
      accessCount: parseInt(pattern.access_count),
      ipAddress: pattern.audit_ipaddress || pattern.ipAddress,
      riskLevel: this.calculateAccessRiskLevel(parseInt(pattern.access_count))
    }));
  }

  /**
   * Detect brute force login attempts
   */
  static async detectBruteForceAttempts(auditRepo, windowStart) {
    const failedLogins = await auditRepo.createQueryBuilder('audit')
      .select(['audit.ipAddress', 'COUNT(*) as failure_count'])
      .where('audit.eventTimestamp > :windowStart', { windowStart })
      .andWhere('audit.eventType = :eventType', {
        eventType: AuditEventType.LOGIN_FAILURE
      })
      .groupBy('audit.ipAddress')
      .having('COUNT(*) > :threshold', { threshold: 10 })
      .getRawMany();

    return failedLogins.map(attempt => ({
      ipAddress: attempt.audit_ipaddress || attempt.ipAddress,
      failureCount: parseInt(attempt.failure_count),
      threatLevel: this.calculateThreatLevel(parseInt(attempt.failure_count))
    }));
  }

  /**
   * Detect excessive emergency access
   */
  static async detectExcessiveEmergencyAccess(auditRepo, windowStart) {
    const emergencyAccess = await auditRepo.createQueryBuilder('audit')
      .select(['COUNT(*) as total_count', 'COUNT(DISTINCT audit.userId) as unique_users'])
      .where('audit.eventTimestamp > :windowStart', { windowStart })
      .andWhere('audit.isEmergencyAccess = true')
      .getRawOne();

    const userBreakdown = await auditRepo.createQueryBuilder('audit')
      .select(['audit.userId', 'COUNT(*) as access_count'])
      .where('audit.eventTimestamp > :windowStart', { windowStart })
      .andWhere('audit.isEmergencyAccess = true')
      .groupBy('audit.userId')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    return {
      count: parseInt(emergencyAccess.total_count) || 0,
      uniqueUsers: parseInt(emergencyAccess.unique_users) || 0,
      userBreakdown: userBreakdown.map(user => ({
        userId: user.audit_userid || user.userId,
        accessCount: parseInt(user.access_count)
      }))
    };
  }

  /**
   * Detect off-hours access
   */
  static async detectOffHoursAccess(auditRepo, windowStart) {
    const offHoursAccess = await auditRepo.createQueryBuilder('audit')
      .select(['COUNT(*) as total_count'])
      .where('audit.eventTimestamp > :windowStart', { windowStart })
      .andWhere('EXTRACT(HOUR FROM audit.eventTimestamp) NOT BETWEEN 8 AND 18')
      .andWhere('audit.eventType IN (:...sensitiveTypes)', {
        sensitiveTypes: [
          AuditEventType.PATIENT_DATA_ACCESS,
          AuditEventType.FILE_DOWNLOAD
        ]
      })
      .getRawOne();

    const hourlyBreakdown = await auditRepo.createQueryBuilder('audit')
      .select(['EXTRACT(HOUR FROM audit.eventTimestamp) as hour', 'COUNT(*) as count'])
      .where('audit.eventTimestamp > :windowStart', { windowStart })
      .andWhere('EXTRACT(HOUR FROM audit.eventTimestamp) NOT BETWEEN 8 AND 18')
      .groupBy('EXTRACT(HOUR FROM audit.eventTimestamp)')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    return {
      count: parseInt(offHoursAccess.total_count) || 0,
      hourlyBreakdown: hourlyBreakdown.map(entry => ({
        hour: parseInt(entry.hour),
        count: parseInt(entry.count)
      }))
    };
  }

  /**
   * Detect large data exports
   */
  static async detectLargeDataExports(auditRepo, windowStart) {
    const dataExports = await auditRepo.createQueryBuilder('audit')
      .select([
        'SUM(audit.dataSize) as total_size',
        'COUNT(*) as export_count',
        'AVG(audit.dataSize) as avg_size'
      ])
      .where('audit.eventTimestamp > :windowStart', { windowStart })
      .andWhere('audit.dataExported = true')
      .getRawOne();

    const largeExports = await auditRepo.createQueryBuilder('audit')
      .select(['audit.userId', 'audit.dataSize', 'audit.eventTimestamp', 'audit.exportDestination'])
      .where('audit.eventTimestamp > :windowStart', { windowStart })
      .andWhere('audit.dataExported = true')
      .andWhere('audit.dataSize > :threshold', { threshold: 100000000 }) // 100MB
      .orderBy('audit.dataSize', 'DESC')
      .getRawMany();

    return {
      totalSize: parseInt(dataExports.total_size) || 0,
      exportCount: parseInt(dataExports.export_count) || 0,
      averageSize: parseInt(dataExports.avg_size) || 0,
      largeExports: largeExports.map(exp => ({
        userId: exp.audit_userid || exp.userId,
        dataSize: parseInt(exp.audit_datasize || exp.dataSize),
        timestamp: exp.audit_eventtimestamp || exp.eventTimestamp,
        destination: exp.audit_exportdestination || exp.exportDestination
      }))
    };
  }

  /**
   * Detect sequential access anomalies
   */
  static async detectSequentialAnomalies(auditRepo, windowStart) {
    // Find rapid sequential access to multiple patient records
    const rapidAccess = await auditRepo.createQueryBuilder('audit')
      .select([
        'audit.userId',
        'COUNT(DISTINCT audit.patientIdentifier) as patient_count',
        'MIN(audit.eventTimestamp) as first_access',
        'MAX(audit.eventTimestamp) as last_access'
      ])
      .where('audit.eventTimestamp > :windowStart', { windowStart })
      .andWhere('audit.patientIdentifier IS NOT NULL')
      .andWhere('audit.eventType = :eventType', {
        eventType: AuditEventType.PATIENT_DATA_ACCESS
      })
      .groupBy('audit.userId')
      .having('COUNT(DISTINCT audit.patientIdentifier) > 10')
      .getRawMany();

    return rapidAccess.filter(access => {
      const duration = new Date(access.last_access) - new Date(access.first_access);
      const minutes = duration / (1000 * 60);
      return minutes < 60; // Less than 60 minutes for 10+ patients
    }).map(anomaly => ({
      userId: anomaly.audit_userid || anomaly.userId,
      patientCount: parseInt(anomaly.patient_count),
      firstAccess: anomaly.first_access,
      lastAccess: anomaly.last_access,
      duration: new Date(anomaly.last_access) - new Date(anomaly.first_access),
      type: 'rapid_sequential_access',
      riskScore: this.calculateSequentialRiskScore(parseInt(anomaly.patient_count))
    }));
  }

  /**
   * Detect permission escalation attempts
   */
  static async detectPermissionEscalation(auditRepo, windowStart) {
    const escalationAttempts = await auditRepo.createQueryBuilder('audit')
      .select(['COUNT(*) as total_attempts'])
      .where('audit.eventTimestamp > :windowStart', { windowStart })
      .andWhere('audit.eventType = :eventType', { eventType: AuditEventType.PERMISSION_DENIED })
      .andWhere('audit.outcome = :outcome', { outcome: 'FAILURE' })
      .getRawOne();

    const userBreakdown = await auditRepo.createQueryBuilder('audit')
      .select(['audit.userId', 'COUNT(*) as attempt_count', 'audit.ipAddress'])
      .where('audit.eventTimestamp > :windowStart', { windowStart })
      .andWhere('audit.eventType = :eventType', { eventType: AuditEventType.PERMISSION_DENIED })
      .andWhere('audit.outcome = :outcome', { outcome: 'FAILURE' })
      .groupBy('audit.userId, audit.ipAddress')
      .having('COUNT(*) > 5')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    return {
      count: parseInt(escalationAttempts.total_attempts) || 0,
      userBreakdown: userBreakdown.map(user => ({
        userId: user.audit_userid || user.userId,
        attemptCount: parseInt(user.attempt_count),
        ipAddress: user.audit_ipaddress || user.ipAddress,
        threatLevel: this.calculateEscalationThreatLevel(parseInt(user.attempt_count))
      }))
    };
  }

  /**
   * Monitor user behavior patterns
   */
  static async monitorUserBehavior(userId, timeWindow = 168) { // 7 days
    try {
      const auditRepo = AppDataSource.getRepository('ComprehensiveAuditLog');
      const windowStart = new Date(Date.now() - (timeWindow * 60 * 60 * 1000));

      // Get user's activity pattern
      const activityPattern = await auditRepo.createQueryBuilder('audit')
        .select([
          'audit.eventType',
          'COUNT(*) as frequency',
          'AVG(audit.riskScore) as avg_risk',
          'EXTRACT(HOUR FROM audit.eventTimestamp) as hour'
        ])
        .where('audit.userId = :userId', { userId })
        .andWhere('audit.eventTimestamp > :windowStart', { windowStart })
        .groupBy('audit.eventType, EXTRACT(HOUR FROM audit.eventTimestamp)')
        .getRawMany();

      // Calculate baseline behavior
      const baseline = this.calculateUserBaseline(activityPattern);

      // Detect deviations from baseline
      const currentBehavior = await this.getCurrentUserBehavior(auditRepo, userId);
      const deviations = this.detectBehaviorDeviations(baseline, currentBehavior);

      return {
        success: true,
        userId,
        baseline,
        currentBehavior,
        deviations,
        riskLevel: this.calculateUserRiskLevel(deviations)
      };

    } catch (error) {
      throw new Error(`Failed to monitor user behavior: ${error.message}`);
    }
  }

  /**
   * Generate security intelligence report
   */
  static async generateSecurityIntelligence(timeWindow = 24) {
    try {
      const anomalies = await this.detectAnomalies(timeWindow);
      const threatIndicators = await this.identifyThreatIndicators(timeWindow);
      const riskAssessment = await this.performRiskAssessment();

      const intelligence = {
        timestamp: new Date(),
        timeWindow,
        threatLevel: this.calculateOverallThreatLevel(anomalies.anomalies, threatIndicators),
        anomalies: anomalies.anomalies,
        threatIndicators,
        riskAssessment,
        recommendations: this.generateSecurityRecommendations(anomalies.anomalies, threatIndicators)
      };

      // Log intelligence generation
      await AdvancedAuditService.logEvent({
        eventType: 'security_intelligence_generated',
        severity: intelligence.threatLevel === 'high' ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
        eventDescription: 'Security intelligence report generated',
        metadata: {
          threatLevel: intelligence.threatLevel,
          anomalyCount: intelligence.anomalies.length,
          threatIndicatorCount: intelligence.threatIndicators.length
        }
      });

      return {
        success: true,
        intelligence
      };

    } catch (error) {
      throw new Error(`Failed to generate security intelligence: ${error.message}`);
    }
  }

  // Helper methods for risk calculation

  /**
   * Calculate access risk level based on volume
   */
  static calculateAccessRiskLevel(accessCount) {
    if (accessCount > 500) return 'critical';
    if (accessCount > 200) return 'high';
    if (accessCount > 100) return 'medium';
    return 'low';
  }

  /**
   * Calculate threat level for brute force attempts
   */
  static calculateThreatLevel(failureCount) {
    if (failureCount > 50) return 'critical';
    if (failureCount > 25) return 'high';
    if (failureCount > 10) return 'medium';
    return 'low';
  }

  /**
   * Calculate risk score for sequential access
   */
  static calculateSequentialRiskScore(patientCount) {
    const baseScore = 50;
    const multiplier = Math.min(patientCount / 10, 5);
    return Math.min(100, baseScore * multiplier);
  }

  /**
   * Calculate escalation threat level
   */
  static calculateEscalationThreatLevel(attemptCount) {
    if (attemptCount > 20) return 'critical';
    if (attemptCount > 10) return 'high';
    if (attemptCount > 5) return 'medium';
    return 'low';
  }

  /**
   * Calculate user baseline behavior
   */
  static calculateUserBaseline(activityPattern) {
    const eventTypeFrequency = {};
    const hourlyActivity = {};
    let totalActivity = 0;
    let totalRisk = 0;

    activityPattern.forEach(pattern => {
      const eventType = pattern.audit_eventtype || pattern.eventType;
      const frequency = parseInt(pattern.frequency);
      const hour = parseInt(pattern.hour);
      const avgRisk = parseFloat(pattern.avg_risk) || 0;

      eventTypeFrequency[eventType] = (eventTypeFrequency[eventType] || 0) + frequency;
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + frequency;
      totalActivity += frequency;
      totalRisk += avgRisk * frequency;
    });

    return {
      eventTypeFrequency,
      hourlyActivity,
      averageRiskScore: totalActivity > 0 ? totalRisk / totalActivity : 0,
      totalActivity,
      peakHours: Object.entries(hourlyActivity)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    };
  }

  /**
   * Get current user behavior (last 24 hours)
   */
  static async getCurrentUserBehavior(auditRepo, userId) {
    const last24Hours = new Date(Date.now() - (24 * 60 * 60 * 1000));

    const currentActivity = await auditRepo.createQueryBuilder('audit')
      .select([
        'audit.eventType',
        'COUNT(*) as frequency',
        'AVG(audit.riskScore) as avg_risk',
        'EXTRACT(HOUR FROM audit.eventTimestamp) as hour'
      ])
      .where('audit.userId = :userId', { userId })
      .andWhere('audit.eventTimestamp > :last24Hours', { last24Hours })
      .groupBy('audit.eventType, EXTRACT(HOUR FROM audit.eventTimestamp)')
      .getRawMany();

    return this.calculateUserBaseline(currentActivity);
  }

  /**
   * Detect behavior deviations
   */
  static detectBehaviorDeviations(baseline, current) {
    const deviations = [];

    // Check event type frequency deviations
    for (const [eventType, currentFreq] of Object.entries(current.eventTypeFrequency)) {
      const baselineFreq = baseline.eventTypeFrequency[eventType] || 0;
      const deviation = baselineFreq > 0 ? (currentFreq - baselineFreq) / baselineFreq : 1;

      if (Math.abs(deviation) > 0.5) { // 50% deviation threshold
        deviations.push({
          type: 'event_frequency_deviation',
          eventType,
          baseline: baselineFreq,
          current: currentFreq,
          deviation: deviation,
          severity: Math.abs(deviation) > 1 ? 'high' : 'medium'
        });
      }
    }

    // Check risk score deviation
    const riskDeviation = baseline.averageRiskScore > 0 ?
      (current.averageRiskScore - baseline.averageRiskScore) / baseline.averageRiskScore : 0;

    if (Math.abs(riskDeviation) > 0.3) { // 30% risk deviation threshold
      deviations.push({
        type: 'risk_score_deviation',
        baseline: baseline.averageRiskScore,
        current: current.averageRiskScore,
        deviation: riskDeviation,
        severity: riskDeviation > 0.5 ? 'high' : 'medium'
      });
    }

    return deviations;
  }

  /**
   * Calculate user risk level
   */
  static calculateUserRiskLevel(deviations) {
    if (deviations.some(d => d.severity === 'high')) return 'high';
    if (deviations.some(d => d.severity === 'medium')) return 'medium';
    return 'low';
  }

  /**
   * Identify threat indicators
   */
  static async identifyThreatIndicators(timeWindow) {
    const auditRepo = AppDataSource.getRepository('ComprehensiveAuditLog');
    const windowStart = new Date(Date.now() - (timeWindow * 60 * 60 * 1000));

    const indicators = [];

    // Indicator 1: Multiple failed logins from same IP
    const suspiciousIPs = await auditRepo.createQueryBuilder('audit')
      .select(['audit.ipAddress', 'COUNT(*) as failure_count'])
      .where('audit.eventTimestamp > :windowStart', { windowStart })
      .andWhere('audit.eventType = :eventType', { eventType: AuditEventType.LOGIN_FAILURE })
      .groupBy('audit.ipAddress')
      .having('COUNT(*) > 5')
      .getRawMany();

    suspiciousIPs.forEach(ip => {
      indicators.push({
        type: 'suspicious_ip',
        indicator: ip.audit_ipaddress || ip.ipAddress,
        description: `${ip.failure_count} failed login attempts`,
        severity: 'medium',
        confidence: 0.8
      });
    });

    // Indicator 2: Access to multiple patients by single user
    const suspiciousUsers = await auditRepo.createQueryBuilder('audit')
      .select(['audit.userId', 'COUNT(DISTINCT audit.patientIdentifier) as patient_count'])
      .where('audit.eventTimestamp > :windowStart', { windowStart })
      .andWhere('audit.patientIdentifier IS NOT NULL')
      .groupBy('audit.userId')
      .having('COUNT(DISTINCT audit.patientIdentifier) > 50')
      .getRawMany();

    suspiciousUsers.forEach(user => {
      indicators.push({
        type: 'excessive_patient_access',
        indicator: user.audit_userid || user.userId,
        description: `Accessed ${user.patient_count} different patients`,
        severity: 'high',
        confidence: 0.9
      });
    });

    return indicators;
  }

  /**
   * Perform overall risk assessment
   */
  static async performRiskAssessment() {
    const auditRepo = AppDataSource.getRepository('ComprehensiveAuditLog');
    const last24Hours = new Date(Date.now() - (24 * 60 * 60 * 1000));

    // Get risk metrics
    const riskMetrics = await auditRepo.createQueryBuilder('audit')
      .select([
        'AVG(audit.riskScore) as avg_risk',
        'MAX(audit.riskScore) as max_risk',
        'COUNT(CASE WHEN audit.riskScore >= 80 THEN 1 END) as high_risk_events',
        'COUNT(*) as total_events'
      ])
      .where('audit.eventTimestamp > :last24Hours', { last24Hours })
      .getRawOne();

    const avgRisk = parseFloat(riskMetrics.avg_risk) || 0;
    const maxRisk = parseInt(riskMetrics.max_risk) || 0;
    const highRiskEvents = parseInt(riskMetrics.high_risk_events) || 0;
    const totalEvents = parseInt(riskMetrics.total_events) || 0;

    return {
      overallRiskScore: avgRisk,
      maxRiskEvent: maxRisk,
      highRiskEventCount: highRiskEvents,
      riskTrend: await this.calculateRiskTrend(),
      riskLevel: this.categorizeRiskLevel(avgRisk),
      criticalityIndex: totalEvents > 0 ? (highRiskEvents / totalEvents) * 100 : 0
    };
  }

  /**
   * Calculate overall threat level
   */
  static calculateOverallThreatLevel(anomalies, threatIndicators) {
    const criticalAnomalies = anomalies.filter(a => a.severity === AuditSeverity.CRITICAL).length;
    const highSeverityIndicators = threatIndicators.filter(t => t.severity === 'high').length;

    if (criticalAnomalies > 0 || highSeverityIndicators > 2) return 'critical';
    if (anomalies.length > 3 || highSeverityIndicators > 0) return 'high';
    if (anomalies.length > 0) return 'medium';
    return 'low';
  }

  /**
   * Generate security recommendations
   */
  static generateSecurityRecommendations(anomalies, threatIndicators) {
    const recommendations = [];

    // Recommendations based on anomalies
    if (anomalies.some(a => a.type === 'brute_force_attempt')) {
      recommendations.push({
        priority: 'critical',
        category: 'access_control',
        recommendation: 'Implement IP blocking for sources with multiple failed login attempts',
        action: 'Configure automated IP blocking after 10 failed attempts'
      });
    }

    if (anomalies.some(a => a.type === 'excessive_emergency_access')) {
      recommendations.push({
        priority: 'high',
        category: 'policy_enforcement',
        recommendation: 'Review emergency access procedures and provide additional training',
        action: 'Conduct emergency access audit and update procedures'
      });
    }

    if (anomalies.some(a => a.type === 'large_data_export')) {
      recommendations.push({
        priority: 'high',
        category: 'data_protection',
        recommendation: 'Implement additional controls for large data exports',
        action: 'Require approval for exports over 100MB'
      });
    }

    // Recommendations based on threat indicators
    if (threatIndicators.some(t => t.type === 'suspicious_ip')) {
      recommendations.push({
        priority: 'medium',
        category: 'monitoring',
        recommendation: 'Enhanced monitoring of suspicious IP addresses',
        action: 'Add IPs to watchlist and enable real-time alerts'
      });
    }

    return recommendations;
  }

  /**
   * Calculate risk trend
   */
  static async calculateRiskTrend() {
    // Simplified risk trend calculation
    // In production, this would analyze historical data
    return {
      direction: 'stable',
      change: 0,
      period: '7_days'
    };
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
}

module.exports = AuditAnomalyDetection;