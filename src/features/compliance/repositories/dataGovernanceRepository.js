// src/repositories/dataGovernanceRepository.js
const AppDataSource = require('../../../config/database');

class DataGovernanceRepository {
  
  static getPolicyRepository() {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }
    return AppDataSource.getRepository('DataGovernancePolicy');
  }

  static getLineageRepository() {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }
    return AppDataSource.getRepository('DataLineage');
  }

  /**
   * Create new data governance policy
   */
  static async createPolicy(policyData) {
    const repo = this.getPolicyRepository();
    const policy = repo.create(policyData);
    return await repo.save(policy);
  }

  /**
   * Get policy by ID
   */
  static async getPolicyById(policyId) {
    const repo = this.getPolicyRepository();
    
    return await repo.findOne({
      where: { id: policyId },
      relations: ['owner', 'approver']
    });
  }

  /**
   * Get active policies by type
   */
  static async getPoliciesByType(policyType, options = {}) {
    const repo = this.getPolicyRepository();
    const { 
      page = 1, 
      limit = 50,
      status = 'active',
      jurisdiction
    } = options;

    const queryBuilder = repo.createQueryBuilder('policy')
      .leftJoinAndSelect('policy.owner', 'owner')
      .where('policy.policyType = :policyType', { policyType })
      .andWhere('policy.policyStatus = :status', { status });

    if (jurisdiction) {
      queryBuilder.andWhere('policy.applicableJurisdictions @> :jurisdiction', {
        jurisdiction: JSON.stringify([jurisdiction])
      });
    }

    // Check if policy is currently effective
    const now = new Date();
    queryBuilder.andWhere('policy.effectiveDate <= :now', { now });
    queryBuilder.andWhere(
      '(policy.expirationDate IS NULL OR policy.expirationDate > :now)',
      { now }
    );

    queryBuilder.orderBy('policy.createdAt', 'DESC');

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [policies, total] = await queryBuilder.getManyAndCount();

    return {
      policies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      policyType
    };
  }

  /**
   * Get all active policies
   */
  static async getActivePolicies(options = {}) {
    const repo = this.getPolicyRepository();
    const { 
      page = 1, 
      limit = 50,
      jurisdiction,
      complianceFramework
    } = options;

    const queryBuilder = repo.createQueryBuilder('policy')
      .leftJoinAndSelect('policy.owner', 'owner')
      .where('policy.policyStatus = :status', { status: 'active' });

    // Check if policy is currently effective
    const now = new Date();
    queryBuilder.andWhere('policy.effectiveDate <= :now', { now });
    queryBuilder.andWhere(
      '(policy.expirationDate IS NULL OR policy.expirationDate > :now)',
      { now }
    );

    if (jurisdiction) {
      queryBuilder.andWhere('policy.applicableJurisdictions @> :jurisdiction', {
        jurisdiction: JSON.stringify([jurisdiction])
      });
    }

    if (complianceFramework) {
      queryBuilder.andWhere('policy.complianceFrameworks @> :framework', {
        framework: JSON.stringify([complianceFramework])
      });
    }

    queryBuilder.orderBy('policy.policyType', 'ASC')
              .addOrderBy('policy.createdAt', 'DESC');

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [policies, total] = await queryBuilder.getManyAndCount();

    return {
      policies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get policies requiring review
   */
  static async getPoliciesRequiringReview(daysAhead = 30) {
    const repo = this.getPolicyRepository();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await repo.find({
      where: {
        policyStatus: 'active',
        reviewDate: {
          $lte: futureDate,
          $gte: new Date()
        }
      },
      relations: ['owner'],
      order: { reviewDate: 'ASC' }
    });
  }

  /**
   * Update policy enforcement metrics
   */
  static async updatePolicyEnforcement(policyId, enforcementData) {
    const repo = this.getPolicyRepository();
    
    const updateData = {
      enforcementCount: () => 'enforcement_count + 1',
      lastEnforcedAt: new Date(),
      updatedAt: new Date()
    };

    if (enforcementData.violationDetected) {
      updateData.violationCount = () => 'violation_count + 1';
    }

    await repo.update(policyId, updateData);
    
    return await this.getPolicyById(policyId);
  }

  /**
   * Search policies with advanced filters
   */
  static async searchPolicies(searchCriteria, options = {}) {
    const repo = this.getPolicyRepository();
    const {
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = options;

    const queryBuilder = repo.createQueryBuilder('policy')
      .leftJoinAndSelect('policy.owner', 'owner');

    // Apply search filters
    if (searchCriteria.policyName) {
      queryBuilder.andWhere('policy.policyName ILIKE :policyName', {
        policyName: `%${searchCriteria.policyName}%`
      });
    }

    if (searchCriteria.policyType) {
      if (Array.isArray(searchCriteria.policyType)) {
        queryBuilder.andWhere('policy.policyType IN (:...policyTypes)', {
          policyTypes: searchCriteria.policyType
        });
      } else {
        queryBuilder.andWhere('policy.policyType = :policyType', {
          policyType: searchCriteria.policyType
        });
      }
    }

    if (searchCriteria.policyStatus) {
      if (Array.isArray(searchCriteria.policyStatus)) {
        queryBuilder.andWhere('policy.policyStatus IN (:...statuses)', {
          statuses: searchCriteria.policyStatus
        });
      } else {
        queryBuilder.andWhere('policy.policyStatus = :status', {
          status: searchCriteria.policyStatus
        });
      }
    }

    if (searchCriteria.jurisdiction) {
      queryBuilder.andWhere('policy.applicableJurisdictions @> :jurisdiction', {
        jurisdiction: JSON.stringify([searchCriteria.jurisdiction])
      });
    }

    if (searchCriteria.complianceFramework) {
      queryBuilder.andWhere('policy.complianceFrameworks @> :framework', {
        framework: JSON.stringify([searchCriteria.complianceFramework])
      });
    }

    if (searchCriteria.dataType) {
      queryBuilder.andWhere('policy.applicableDataTypes @> :dataType', {
        dataType: JSON.stringify([searchCriteria.dataType])
      });
    }

    if (searchCriteria.isAutomated !== undefined) {
      queryBuilder.andWhere('policy.isAutomated = :isAutomated', {
        isAutomated: searchCriteria.isAutomated
      });
    }

    if (searchCriteria.owner) {
      queryBuilder.andWhere('policy.policyOwner = :owner', {
        owner: searchCriteria.owner
      });
    }

    if (searchCriteria.effectiveDateRange) {
      queryBuilder.andWhere('policy.effectiveDate BETWEEN :startDate AND :endDate', {
        startDate: searchCriteria.effectiveDateRange.startDate,
        endDate: searchCriteria.effectiveDateRange.endDate
      });
    }

    if (searchCriteria.searchText) {
      queryBuilder.andWhere(
        '(policy.policyName ILIKE :searchText OR policy.policyDescription ILIKE :searchText)',
        { searchText: `%${searchCriteria.searchText}%` }
      );
    }

    // Sorting
    queryBuilder.orderBy(`policy.${sortBy}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [policies, total] = await queryBuilder.getManyAndCount();

    return {
      policies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      searchCriteria
    };
  }

  /**
   * Get policy statistics
   */
  static async getPolicyStatistics() {
    const repo = this.getPolicyRepository();

    // Status distribution
    const statusStats = await repo.createQueryBuilder('policy')
      .select(['policy.policyStatus', 'COUNT(*) as count'])
      .groupBy('policy.policyStatus')
      .getRawMany();

    // Type distribution
    const typeStats = await repo.createQueryBuilder('policy')
      .select(['policy.policyType', 'COUNT(*) as count'])
      .where('policy.policyStatus = :status', { status: 'active' })
      .groupBy('policy.policyType')
      .getRawMany();

    // Automation status
    const automationStats = await repo.createQueryBuilder('policy')
      .select([
        'COUNT(CASE WHEN policy.isAutomated = true THEN 1 END) as automated',
        'COUNT(CASE WHEN policy.isAutomated = false THEN 1 END) as manual'
      ])
      .where('policy.policyStatus = :status', { status: 'active' })
      .getRawOne();

    // Enforcement metrics
    const enforcementStats = await repo.createQueryBuilder('policy')
      .select([
        'SUM(policy.enforcementCount) as total_enforcements',
        'SUM(policy.violationCount) as total_violations',
        'AVG(policy.enforcementCount) as avg_enforcements'
      ])
      .where('policy.policyStatus = :status', { status: 'active' })
      .getRawOne();

    // Compliance framework coverage
    const complianceStats = await repo.createQueryBuilder('policy')
      .select(['policy.complianceFrameworks'])
      .where('policy.policyStatus = :status', { status: 'active' })
      .getRawMany();

    // Process compliance frameworks
    const frameworkCounts = {};
    complianceStats.forEach(stat => {
      const frameworks = stat.policy_complianceframeworks || stat.complianceFrameworks || [];
      frameworks.forEach(framework => {
        frameworkCounts[framework] = (frameworkCounts[framework] || 0) + 1;
      });
    });

    return {
      statusDistribution: statusStats.map(stat => ({
        status: stat.policy_policystatus || stat.policyStatus,
        count: parseInt(stat.count)
      })),
      typeDistribution: typeStats.map(stat => ({
        type: stat.policy_policytype || stat.policyType,
        count: parseInt(stat.count)
      })),
      automationMetrics: {
        automated: parseInt(automationStats.automated) || 0,
        manual: parseInt(automationStats.manual) || 0
      },
      enforcementMetrics: {
        totalEnforcements: parseInt(enforcementStats.total_enforcements) || 0,
        totalViolations: parseInt(enforcementStats.total_violations) || 0,
        averageEnforcements: parseFloat(enforcementStats.avg_enforcements) || 0
      },
      complianceFrameworks: Object.entries(frameworkCounts).map(([framework, count]) => ({
        framework,
        count
      }))
    };
  }

  /**
   * Create data lineage record
   */
  static async createDataLineage(lineageData) {
    const repo = this.getLineageRepository();
    const lineage = repo.create(lineageData);
    return await repo.save(lineage);
  }

  /**
   * Get data lineage for source
   */
  static async getDataLineage(sourceId, sourceType, options = {}) {
    const repo = this.getLineageRepository();
    const { 
      page = 1, 
      limit = 50,
      includeDestinations = true,
      transformationType
    } = options;

    const queryBuilder = repo.createQueryBuilder('lineage')
      .leftJoinAndSelect('lineage.transformer', 'transformer')
      .where('lineage.sourceId = :sourceId', { sourceId })
      .andWhere('lineage.sourceType = :sourceType', { sourceType });

    if (transformationType) {
      queryBuilder.andWhere('lineage.transformationType = :transformationType', {
        transformationType
      });
    }

    queryBuilder.orderBy('lineage.transformedAt', 'DESC');

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [lineageRecords, total] = await queryBuilder.getManyAndCount();

    return {
      lineageRecords,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      sourceId,
      sourceType
    };
  }

  /**
   * Trace data lineage chain
   */
  static async traceDataLineageChain(sourceId, sourceType, maxDepth = 10) {
    const lineageChain = [];
    const visited = new Set();
    
    const traceRecursive = async (currentId, currentType, depth) => {
      if (depth > maxDepth || visited.has(`${currentType}:${currentId}`)) {
        return;
      }
      
      visited.add(`${currentType}:${currentId}`);
      
      const repo = this.getLineageRepository();
      const records = await repo.find({
        where: {
          sourceId: currentId,
          sourceType: currentType
        },
        relations: ['transformer'],
        order: { transformedAt: 'ASC' }
      });
      
      for (const record of records) {
        lineageChain.push({
          ...record,
          depth
        });
        
        if (record.destinationId && record.destinationType) {
          await traceRecursive(record.destinationId, record.destinationType, depth + 1);
        }
      }
    };
    
    await traceRecursive(sourceId, sourceType, 0);
    
    return {
      lineageChain,
      totalTransformations: lineageChain.length,
      maxDepthReached: lineageChain.length > 0 ? Math.max(...lineageChain.map(l => l.depth)) : 0
    };
  }

  /**
   * Get anonymization history
   */
  static async getAnonymizationHistory(options = {}) {
    const repo = this.getLineageRepository();
    const { 
      page = 1, 
      limit = 50,
      anonymizationLevel,
      startDate,
      endDate
    } = options;

    const queryBuilder = repo.createQueryBuilder('lineage')
      .leftJoinAndSelect('lineage.transformer', 'transformer')
      .where('lineage.transformationType = :transformationType', {
        transformationType: 'anonymization'
      });

    if (anonymizationLevel) {
      queryBuilder.andWhere('lineage.anonymizationLevel = :anonymizationLevel', {
        anonymizationLevel
      });
    }

    if (startDate) {
      queryBuilder.andWhere('lineage.transformedAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('lineage.transformedAt <= :endDate', { endDate });
    }

    queryBuilder.orderBy('lineage.transformedAt', 'DESC');

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [records, total] = await queryBuilder.getManyAndCount();

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get retention policy candidates
   */
  static async getRetentionCandidates(policyId, dryRun = true) {
    const policy = await this.getPolicyById(policyId);
    
    if (!policy || policy.policyType !== 'retention') {
      throw new Error('Invalid retention policy');
    }

    const rules = policy.policyRules;
    const retentionDays = rules.retentionDays || 2555; // 7 years default
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

    const fileRepo = AppDataSource.getRepository('DocumentFile');
    let queryBuilder = fileRepo.createQueryBuilder('file')
      .leftJoinAndSelect('file.folder', 'folder')
      .where('file.createdAt < :cutoffDate', { cutoffDate })
      .andWhere('file.status != :status', { status: 'deleted' });

    // Apply data type filters
    if (rules.applicableDataTypes && rules.applicableDataTypes.length > 0) {
      queryBuilder.andWhere('file.fhirResourceType IN (:...dataTypes)', {
        dataTypes: rules.applicableDataTypes
      });
    }

    // Apply sensitivity filters
    if (rules.sensitivityLevels && rules.sensitivityLevels.length > 0) {
      queryBuilder.andWhere('file.fhirSensitivityLevel IN (:...sensitivityLevels)', {
        sensitivityLevels: rules.sensitivityLevels
      });
    }

    const candidates = await queryBuilder.getMany();

    return {
      policyId,
      policyName: policy.policyName,
      candidates: candidates.map(file => ({
        fileId: file.id,
        fileName: file.originalFileName,
        createdAt: file.createdAt,
        retentionDaysExceeded: Math.floor(
          (Date.now() - file.createdAt.getTime()) / (24 * 60 * 60 * 1000)
        ) - retentionDays,
        fhirResourceType: file.fhirResourceType,
        sensitivityLevel: file.fhirSensitivityLevel,
        patientIdentifier: file.patientIdentifier
      })),
      totalCandidates: candidates.length,
      retentionAction: rules.retentionAction,
      cutoffDate,
      dryRun
    };
  }

  /**
   * Apply data retention policy
   */
  static async applyRetentionPolicy(policyId, candidateIds, appliedBy) {
    const policy = await this.getPolicyById(policyId);
    
    if (!policy || policy.policyType !== 'retention') {
      throw new Error('Invalid retention policy');
    }

    const rules = policy.policyRules;
    const fileRepo = AppDataSource.getRepository('DocumentFile');
    
    // Start transaction
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const processedFiles = [];
      
      for (const fileId of candidateIds) {
        const file = await queryRunner.manager.findOne('DocumentFile', {
          where: { id: fileId }
        });
        
        if (!file) continue;

        let actionTaken = null;
        
        switch (rules.retentionAction) {
          case 'delete':
            await queryRunner.manager.update('DocumentFile', fileId, {
              status: 'deleted',
              updatedAt: new Date()
            });
            actionTaken = 'deleted';
            break;
            
          case 'archive':
            await queryRunner.manager.update('DocumentFile', fileId, {
              status: 'archived',
              metadata: {
                ...file.metadata,
                archivedAt: new Date(),
                archiveLocation: rules.archiveLocation,
                retentionPolicyId: policyId
              }
            });
            actionTaken = 'archived';
            break;
            
          case 'anonymize':
            // This would trigger anonymization process
            await queryRunner.manager.update('DocumentFile', fileId, {
              metadata: {
                ...file.metadata,
                anonymizationScheduled: new Date(),
                retentionPolicyId: policyId
              }
            });
            actionTaken = 'scheduled_for_anonymization';
            break;
        }

        if (actionTaken) {
          // Create lineage record
          await queryRunner.manager.save('DataLineage', {
            sourceId: fileId,
            sourceType: 'file',
            transformationType: 'data_retention_policy',
            transformationRules: rules,
            transformedBy: appliedBy,
            transformedAt: new Date(),
            purposeOfTransformation: 'compliance_retention',
            metadata: {
              policyId,
              actionTaken,
              retentionDays: rules.retentionDays
            }
          });

          processedFiles.push({
            fileId,
            fileName: file.originalFileName,
            actionTaken,
            processedAt: new Date()
          });
        }
      }

      // Update policy metrics
      await queryRunner.manager.update('DataGovernancePolicy', policyId, {
        enforcementCount: () => 'enforcement_count + 1',
        lastEnforcedAt: new Date()
      });

      await queryRunner.commitTransaction();
      
      return {
        policyId,
        processedFiles,
        totalProcessed: processedFiles.length,
        retentionAction: rules.retentionAction,
        appliedBy,
        appliedAt: new Date()
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get cross-border transfer policies
   */
  static async getCrossBorderPolicies(sourceJurisdiction, destinationJurisdiction) {
    const repo = this.getPolicyRepository();
    
    return await repo.find({
      where: {
        policyType: 'cross_border',
        policyStatus: 'active',
        applicableJurisdictions: { $contains: [sourceJurisdiction] }
      },
      relations: ['owner'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Get data classification policies
   */
  static async getClassificationPolicies(dataType = null) {
    const repo = this.getPolicyRepository();
    
    const queryBuilder = repo.createQueryBuilder('policy')
      .leftJoinAndSelect('policy.owner', 'owner')
      .where('policy.policyType = :policyType', { policyType: 'data_classification' })
      .andWhere('policy.policyStatus = :status', { status: 'active' });

    if (dataType) {
      queryBuilder.andWhere('policy.applicableDataTypes @> :dataType', {
        dataType: JSON.stringify([dataType])
      });
    }

    return await queryBuilder.getMany();
  }

  /**
   * Get privacy preservation policies
   */
  static async getPrivacyPolicies(options = {}) {
    const repo = this.getPolicyRepository();
    const { sensitivityLevel, purposeOfUse } = options;

    const queryBuilder = repo.createQueryBuilder('policy')
      .leftJoinAndSelect('policy.owner', 'owner')
      .where('policy.policyType = :policyType', { policyType: 'privacy_preservation' })
      .andWhere('policy.policyStatus = :status', { status: 'active' });

    if (sensitivityLevel) {
      queryBuilder.andWhere('policy.sensitivityLevels @> :sensitivityLevel', {
        sensitivityLevel: JSON.stringify([sensitivityLevel])
      });
    }

    return await queryBuilder.getMany();
  }

  /**
   * Update policy status
   */
  static async updatePolicyStatus(policyId, newStatus, updatedBy) {
    const repo = this.getPolicyRepository();
    
    const updateData = {
      policyStatus: newStatus,
      updatedAt: new Date()
    };

    if (newStatus === 'deprecated') {
      updateData.expirationDate = new Date();
    }

    await repo.update(policyId, updateData);
    
    return await this.getPolicyById(policyId);
  }

  /**
   * Get policy compliance report
   */
  static async getPolicyComplianceReport(options = {}) {
    const repo = this.getPolicyRepository();
    const { 
      timeRange = 30,
      complianceFramework,
      policyType
    } = options;

    const startDate = new Date(Date.now() - (timeRange * 24 * 60 * 60 * 1000));

    const queryBuilder = repo.createQueryBuilder('policy')
      .leftJoinAndSelect('policy.owner', 'owner')
      .where('policy.policyStatus = :status', { status: 'active' });

    if (complianceFramework) {
      queryBuilder.andWhere('policy.complianceFrameworks @> :framework', {
        framework: JSON.stringify([complianceFramework])
      });
    }

    if (policyType) {
      queryBuilder.andWhere('policy.policyType = :policyType', { policyType });
    }

    const policies = await queryBuilder.getMany();

    // Calculate compliance metrics
    const totalPolicies = policies.length;
    const automatedPolicies = policies.filter(p => p.isAutomated).length;
    const recentlyEnforced = policies.filter(p => 
      p.lastEnforcedAt && p.lastEnforcedAt >= startDate
    ).length;
    const policiesWithViolations = policies.filter(p => p.violationCount > 0).length;
    const policiesRequiringReview = policies.filter(p => 
      p.reviewDate && p.reviewDate <= new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
    ).length;

    return {
      timeRange,
      complianceMetrics: {
        totalActivePolicies: totalPolicies,
        automatedPolicies,
        automationRate: totalPolicies > 0 ? Math.round((automatedPolicies / totalPolicies) * 100) : 0,
        recentlyEnforcedPolicies: recentlyEnforced,
        enforcementRate: totalPolicies > 0 ? Math.round((recentlyEnforced / totalPolicies) * 100) : 0,
        policiesWithViolations,
        violationRate: totalPolicies > 0 ? Math.round((policiesWithViolations / totalPolicies) * 100) : 0,
        policiesRequiringReview
      },
      policyBreakdown: policies.map(policy => ({
        id: policy.id,
        name: policy.policyName,
        type: policy.policyType,
        enforcementCount: policy.enforcementCount,
        violationCount: policy.violationCount,
        lastEnforced: policy.lastEnforcedAt,
        isAutomated: policy.isAutomated,
        complianceFrameworks: policy.complianceFrameworks
      })),
      generatedAt: new Date()
    };
  }

  /**
   * Get data transformation statistics
   */
  static async getDataTransformationStats(timeRange = 30) {
    const repo = this.getLineageRepository();
    const startDate = new Date(Date.now() - (timeRange * 24 * 60 * 60 * 1000));

    // Transformation type distribution
    const transformationStats = await repo.createQueryBuilder('lineage')
      .select(['lineage.transformationType', 'COUNT(*) as count'])
      .where('lineage.transformedAt >= :startDate', { startDate })
      .groupBy('lineage.transformationType')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    // Anonymization level distribution
    const anonymizationStats = await repo.createQueryBuilder('lineage')
      .select(['lineage.anonymizationLevel', 'COUNT(*) as count'])
      .where('lineage.transformedAt >= :startDate', { startDate })
      .andWhere('lineage.transformationType = :transformationType', {
        transformationType: 'anonymization'
      })
      .groupBy('lineage.anonymizationLevel')
      .getRawMany();

    // Privacy budget usage
    const privacyStats = await repo.createQueryBuilder('lineage')
      .select([
        'SUM(lineage.privacyBudgetUsed) as total_budget_used',
        'AVG(lineage.privacyBudgetUsed) as avg_budget_per_operation',
        'COUNT(*) as privacy_operations'
      ])
      .where('lineage.transformedAt >= :startDate', { startDate })
      .andWhere('lineage.privacyBudgetUsed IS NOT NULL')
      .getRawOne();

    // Daily transformation trends
    const dailyTrends = await repo.createQueryBuilder('lineage')
      .select(['DATE(lineage.transformedAt) as date', 'COUNT(*) as count'])
      .where('lineage.transformedAt >= :startDate', { startDate })
      .groupBy('DATE(lineage.transformedAt)')
      .orderBy('DATE(lineage.transformedAt)', 'ASC')
      .getRawMany();

    return {
      timeRange,
      transformationTypes: transformationStats.map(stat => ({
        type: stat.lineage_transformationtype || stat.transformationType,
        count: parseInt(stat.count)
      })),
      anonymizationLevels: anonymizationStats.map(stat => ({
        level: stat.lineage_anonymizationlevel || stat.anonymizationLevel,
        count: parseInt(stat.count)
      })),
      privacyMetrics: {
        totalBudgetUsed: parseFloat(privacyStats.total_budget_used) || 0,
        averageBudgetPerOperation: parseFloat(privacyStats.avg_budget_per_operation) || 0,
        privacyOperations: parseInt(privacyStats.privacy_operations) || 0
      },
      dailyTrends: dailyTrends.map(stat => ({
        date: stat.date,
        count: parseInt(stat.count)
      }))
    };
  }

  /**
   * Delete old lineage records
   */
  static async deleteOldLineageRecords(retentionDays = 2555) { // 7 years default
    const repo = this.getLineageRepository();
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

    const result = await repo.createQueryBuilder()
      .delete()
      .from('DataLineage')
      .where('transformedAt < :cutoffDate', { cutoffDate })
      .execute();

    return {
      deletedCount: result.affected || 0,
      cutoffDate,
      retentionDays
    };
  }

  /**
   * Get policy violation events
   */
  static async getPolicyViolations(options = {}) {
    const repo = this.getPolicyRepository();
    const { 
      page = 1, 
      limit = 50,
      policyType,
      timeRange = 30
    } = options;

    const startDate = new Date(Date.now() - (timeRange * 24 * 60 * 60 * 1000));

    const queryBuilder = repo.createQueryBuilder('policy')
      .leftJoinAndSelect('policy.owner', 'owner')
      .where('policy.violationCount > 0')
      .andWhere('policy.updatedAt >= :startDate', { startDate });

    if (policyType) {
      queryBuilder.andWhere('policy.policyType = :policyType', { policyType });
    }

    queryBuilder.orderBy('policy.violationCount', 'DESC');

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [policies, total] = await queryBuilder.getManyAndCount();

    return {
      violations: policies.map(policy => ({
        policyId: policy.id,
        policyName: policy.policyName,
        policyType: policy.policyType,
        violationCount: policy.violationCount,
        enforcementCount: policy.enforcementCount,
        violationRate: policy.enforcementCount > 0 ? 
          Math.round((policy.violationCount / policy.enforcementCount) * 100) : 0,
        lastEnforced: policy.lastEnforcedAt,
        complianceFrameworks: policy.complianceFrameworks
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      timeRange
    };
  }
}

module.exports = DataGovernanceRepository;