// src/repositories/encryptionKeyRepository.js
const AppDataSource = require('../../../config/database');

class EncryptionKeyRepository {
  
  static getRepository() {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }
    return AppDataSource.getRepository('EncryptionKey');
  }

  /**
   * Create new encryption key
   */
  static async createKey(keyData) {
    const repo = this.getRepository();
    const key = repo.create(keyData);
    return await repo.save(key);
  }

  /**
   * Get key by identifier
   */
  static async getKeyByIdentifier(keyIdentifier) {
    const repo = this.getRepository();
    
    return await repo.findOne({
      where: { 
        keyIdentifier,
        keyStatus: 'active'
      },
      relations: ['createdByUser']
    });
  }

  /**
   * Get key by ID with full details
   */
  static async getKeyById(keyId) {
    const repo = this.getRepository();
    
    return await repo.findOne({
      where: { id: keyId },
      relations: ['createdByUser', 'parentKey', 'rotatedFromKey']
    });
  }

  /**
   * Get FHIR context-specific key
   */
  static async getFHIRContextKey(context) {
    const repo = this.getRepository();
    
    const queryBuilder = repo.createQueryBuilder('key')
      .where('key.keyStatus = :status', { status: 'active' });

    // Apply context filters
    if (context.patientIdentifier) {
      queryBuilder.andWhere('key.patientIdentifier = :patientId', {
        patientId: context.patientIdentifier
      });
    }

    if (context.fhirResourceType) {
      queryBuilder.andWhere('key.fhirResourceType = :resourceType', {
        resourceType: context.fhirResourceType
      });
    }

    if (context.sensitivityLevel) {
      queryBuilder.andWhere('key.sensitivityLevel = :sensitivityLevel', {
        sensitivityLevel: context.sensitivityLevel
      });
    }

    if (context.purposeOfUse) {
      queryBuilder.andWhere('key.purposeOfUse = :purposeOfUse', {
        purposeOfUse: context.purposeOfUse
      });
    }

    if (context.keyType) {
      queryBuilder.andWhere('key.keyType = :keyType', {
        keyType: context.keyType
      });
    }

    // Order by most specific match first
    queryBuilder.orderBy('key.createdAt', 'DESC');

    return await queryBuilder.getOne();
  }

  /**
   * Get master key
   */
  static async getMasterKey() {
    const repo = this.getRepository();
    
    return await repo.findOne({
      where: {
        keyType: 'master',
        keyStatus: 'active'
      },
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Update key usage tracking
   */
  static async updateKeyUsage(keyId) {
    const repo = this.getRepository();
    
    await repo.update(keyId, {
      usageCount: () => 'usage_count + 1',
      lastUsedAt: new Date()
    });
  }

  /**
   * Rotate key (mark old as rotated, create new)
   */
  static async rotateKey(keyId, newKeyData, rotatedBy) {
    const repo = this.getRepository();
    
    // Start transaction
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get old key
      const oldKey = await queryRunner.manager.findOne('EncryptionKey', {
        where: { id: keyId }
      });

      if (!oldKey) {
        throw new Error('Key not found for rotation');
      }

      // Mark old key as rotated
      await queryRunner.manager.update('EncryptionKey', keyId, {
        keyStatus: 'rotated',
        updatedAt: new Date()
      });

      // Create new key
      const newKey = queryRunner.manager.create('EncryptionKey', {
        ...newKeyData,
        rotatedFromKeyId: keyId,
        version: oldKey.version + 1,
        createdBy: rotatedBy,
        effectiveDate: new Date()
      });

      const savedNewKey = await queryRunner.manager.save(newKey);

      await queryRunner.commitTransaction();
      
      return {
        oldKey,
        newKey: savedNewKey,
        rotatedAt: new Date()
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get keys requiring rotation
   */
  static async getKeysRequiringRotation() {
    const repo = this.getRepository();
    const now = new Date();

    // Keys that have expired
    const expiredKeys = await repo.find({
      where: {
        keyStatus: 'active',
        expirationDate: { $lte: now }
      },
      relations: ['createdByUser']
    });

    // Keys that have exceeded usage limits
    const overusedKeys = await repo.createQueryBuilder('key')
      .leftJoinAndSelect('key.createdByUser', 'user')
      .where('key.keyStatus = :status', { status: 'active' })
      .andWhere('key.maxUsageCount IS NOT NULL')
      .andWhere('key.usageCount >= key.maxUsageCount')
      .getMany();

    // Keys scheduled for rotation
    const scheduledKeys = await repo.createQueryBuilder('key')
      .leftJoinAndSelect('key.createdByUser', 'user')
      .where('key.keyStatus = :status', { status: 'active' })
      .andWhere('key.rotationSchedule IS NOT NULL')
      .getMany();

    return {
      expiredKeys,
      overusedKeys,
      scheduledKeys,
      totalRequiringRotation: expiredKeys.length + overusedKeys.length + scheduledKeys.length
    };
  }

  /**
   * Get keys by type
   */
  static async getKeysByType(keyType, options = {}) {
    const repo = this.getRepository();
    const { 
      page = 1, 
      limit = 50,
      status = 'active',
      includeExpired = false
    } = options;

    const queryBuilder = repo.createQueryBuilder('key')
      .leftJoinAndSelect('key.createdByUser', 'user')
      .where('key.keyType = :keyType', { keyType });

    if (status) {
      queryBuilder.andWhere('key.keyStatus = :status', { status });
    }

    if (!includeExpired) {
      queryBuilder.andWhere(
        '(key.expirationDate IS NULL OR key.expirationDate > :now)',
        { now: new Date() }
      );
    }

    queryBuilder.orderBy('key.createdAt', 'DESC');

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [keys, total] = await queryBuilder.getManyAndCount();

    return {
      keys,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      keyType
    };
  }

  /**
   * Get keys for specific patient
   */
  static async getPatientKeys(patientIdentifier, options = {}) {
    const repo = this.getRepository();
    const { 
      includeInactive = false,
      keyType
    } = options;

    const queryBuilder = repo.createQueryBuilder('key')
      .leftJoinAndSelect('key.createdByUser', 'user')
      .where('key.patientIdentifier = :patientId', {
        patientId: patientIdentifier
      });

    if (!includeInactive) {
      queryBuilder.andWhere('key.keyStatus = :status', { status: 'active' });
    }

    if (keyType) {
      queryBuilder.andWhere('key.keyType = :keyType', { keyType });
    }

    queryBuilder.orderBy('key.createdAt', 'DESC');

    return await queryBuilder.getMany();
  }

  /**
   * Get key statistics
   */
  static async getKeyStatistics() {
    const repo = this.getRepository();

    // Key status distribution
    const statusStats = await repo.createQueryBuilder('key')
      .select(['key.keyStatus', 'COUNT(*) as count'])
      .groupBy('key.keyStatus')
      .getRawMany();

    // Key type distribution
    const typeStats = await repo.createQueryBuilder('key')
      .select(['key.keyType', 'COUNT(*) as count'])
      .where('key.keyStatus = :status', { status: 'active' })
      .groupBy('key.keyType')
      .getRawMany();

    // Algorithm distribution
    const algorithmStats = await repo.createQueryBuilder('key')
      .select(['key.algorithm', 'COUNT(*) as count'])
      .where('key.keyStatus = :status', { status: 'active' })
      .groupBy('key.algorithm')
      .getRawMany();

    // Usage statistics
    const usageStats = await repo.createQueryBuilder('key')
      .select([
        'AVG(key.usageCount) as avg_usage',
        'MAX(key.usageCount) as max_usage',
        'SUM(key.usageCount) as total_usage'
      ])
      .where('key.keyStatus = :status', { status: 'active' })
      .getRawOne();

    // Expiration overview
    const now = new Date();
    const next30Days = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    const expirationStats = await repo.createQueryBuilder('key')
      .select([
        'COUNT(CASE WHEN key.expirationDate < :now THEN 1 END) as expired',
        'COUNT(CASE WHEN key.expirationDate BETWEEN :now AND :next30 THEN 1 END) as expiring_soon',
        'COUNT(CASE WHEN key.expirationDate IS NULL THEN 1 END) as no_expiration'
      ])
      .where('key.keyStatus = :status', { status: 'active' })
      .setParameters({ now, next30: next30Days })
      .getRawOne();

    return {
      statusDistribution: statusStats.map(stat => ({
        status: stat.key_keystatus || stat.keyStatus,
        count: parseInt(stat.count)
      })),
      typeDistribution: typeStats.map(stat => ({
        type: stat.key_keytype || stat.keyType,
        count: parseInt(stat.count)
      })),
      algorithmDistribution: algorithmStats.map(stat => ({
        algorithm: stat.key_algorithm || stat.algorithm,
        count: parseInt(stat.count)
      })),
      usageMetrics: {
        averageUsage: parseFloat(usageStats.avg_usage) || 0,
        maxUsage: parseInt(usageStats.max_usage) || 0,
        totalUsage: parseInt(usageStats.total_usage) || 0
      },
      expirationOverview: {
        expired: parseInt(expirationStats.expired) || 0,
        expiringSoon: parseInt(expirationStats.expiring_soon) || 0,
        noExpiration: parseInt(expirationStats.no_expiration) || 0
      }
    };
  }

  /**
   * Update key status
   */
  static async updateKeyStatus(keyId, newStatus, updatedBy) {
    const repo = this.getRepository();
    
    const updateData = {
      keyStatus: newStatus,
      updatedAt: new Date()
    };

    if (newStatus === 'revoked' || newStatus === 'expired') {
      updateData.expirationDate = new Date();
    }

    await repo.update(keyId, updateData);
    
    return await this.getKeyById(keyId);
  }

  /**
   * Search keys with advanced filters
   */
  static async searchKeys(searchCriteria, options = {}) {
    const repo = this.getRepository();
    const {
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = options;

    const queryBuilder = repo.createQueryBuilder('key')
      .leftJoinAndSelect('key.createdByUser', 'user');

    // Apply search filters
    if (searchCriteria.keyIdentifier) {
      queryBuilder.andWhere('key.keyIdentifier ILIKE :keyId', {
        keyId: `%${searchCriteria.keyIdentifier}%`
      });
    }

    if (searchCriteria.keyType) {
      if (Array.isArray(searchCriteria.keyType)) {
        queryBuilder.andWhere('key.keyType IN (:...keyTypes)', {
          keyTypes: searchCriteria.keyType
        });
      } else {
        queryBuilder.andWhere('key.keyType = :keyType', {
          keyType: searchCriteria.keyType
        });
      }
    }

    if (searchCriteria.keyStatus) {
      if (Array.isArray(searchCriteria.keyStatus)) {
        queryBuilder.andWhere('key.keyStatus IN (:...statuses)', {
          statuses: searchCriteria.keyStatus
        });
      } else {
        queryBuilder.andWhere('key.keyStatus = :status', {
          status: searchCriteria.keyStatus
        });
      }
    }

    if (searchCriteria.patientIdentifier) {
      queryBuilder.andWhere('key.patientIdentifier = :patientId', {
        patientId: searchCriteria.patientIdentifier
      });
    }

    if (searchCriteria.fhirResourceType) {
      queryBuilder.andWhere('key.fhirResourceType = :resourceType', {
        resourceType: searchCriteria.fhirResourceType
      });
    }

    if (searchCriteria.sensitivityLevel) {
      queryBuilder.andWhere('key.sensitivityLevel = :sensitivity', {
        sensitivity: searchCriteria.sensitivityLevel
      });
    }

    if (searchCriteria.algorithm) {
      queryBuilder.andWhere('key.algorithm = :algorithm', {
        algorithm: searchCriteria.algorithm
      });
    }

    if (searchCriteria.createdBy) {
      queryBuilder.andWhere('key.createdBy = :createdBy', {
        createdBy: searchCriteria.createdBy
      });
    }

    if (searchCriteria.dateRange) {
      queryBuilder.andWhere('key.createdAt BETWEEN :startDate AND :endDate', {
        startDate: searchCriteria.dateRange.startDate,
        endDate: searchCriteria.dateRange.endDate
      });
    }

    if (searchCriteria.expiringWithin) {
      const futureDate = new Date(Date.now() + (searchCriteria.expiringWithin * 24 * 60 * 60 * 1000));
      queryBuilder.andWhere('key.expirationDate <= :futureDate', { futureDate });
    }

    if (searchCriteria.minUsageCount !== undefined) {
      queryBuilder.andWhere('key.usageCount >= :minUsage', {
        minUsage: searchCriteria.minUsageCount
      });
    }

    if (searchCriteria.maxUsageCount !== undefined) {
      queryBuilder.andWhere('key.usageCount <= :maxUsage', {
        maxUsage: searchCriteria.maxUsageCount
      });
    }

    // Sorting
    queryBuilder.orderBy(`key.${sortBy}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [keys, total] = await queryBuilder.getManyAndCount();

    return {
      keys,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      searchCriteria
    };
  }

  /**
   * Get key rotation history
   */
  static async getKeyRotationHistory(originalKeyId, options = {}) {
    const repo = this.getRepository();
    const { includeRotatedFrom = true } = options;

    const rotationChain = [];
    let currentKeyId = originalKeyId;
    
    // Follow the rotation chain forward
    while (currentKeyId) {
      const key = await repo.findOne({
        where: { id: currentKeyId },
        relations: ['createdByUser']
      });
      
      if (!key) break;
      
      rotationChain.push(key);
      
      // Find next key in chain
      const nextKey = await repo.findOne({
        where: { rotatedFromKeyId: currentKeyId }
      });
      
      currentKeyId = nextKey ? nextKey.id : null;
    }

    // If requested, also get the keys this one was rotated from
    if (includeRotatedFrom && rotationChain.length > 0) {
      const firstKey = rotationChain[0];
      if (firstKey.rotatedFromKeyId) {
        const previousKeys = await this.getKeyRotationHistory(
          firstKey.rotatedFromKeyId, 
          { includeRotatedFrom: false }
        );
        rotationChain.unshift(...previousKeys.rotationChain);
      }
    }

    return {
      rotationChain,
      totalRotations: rotationChain.length - 1,
      currentKey: rotationChain[rotationChain.length - 1],
      originalKey: rotationChain[0]
    };
  }

  /**
   * Bulk update key status
   */
  static async bulkUpdateKeyStatus(keyIds, newStatus, updatedBy) {
    const repo = this.getRepository();
    
    const updateData = {
      keyStatus: newStatus,
      updatedAt: new Date()
    };

    if (newStatus === 'revoked' || newStatus === 'expired') {
      updateData.expirationDate = new Date();
    }

    const result = await repo.update(keyIds, updateData);
    
    return {
      affectedKeys: result.affected || 0,
      updatedStatus: newStatus,
      updatedBy,
      updatedAt: new Date()
    };
  }

  /**
   * Delete expired keys (hard delete for cleanup)
   */
  static async deleteExpiredKeys(retentionDays = 2555) { // 7 years default
    const repo = this.getRepository();
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

    // Only delete keys that have been expired/revoked for the retention period
    const result = await repo.createQueryBuilder()
      .delete()
      .from('EncryptionKey')
      .where('keyStatus IN (:...statuses)', { statuses: ['expired', 'revoked'] })
      .andWhere('updatedAt < :cutoffDate', { cutoffDate })
      .execute();

    return {
      deletedCount: result.affected || 0,
      cutoffDate,
      retentionDays
    };
  }

  /**
   * Get key compliance status
   */
  static async getKeyComplianceStatus(keyId) {
    const repo = this.getRepository();
    
    const key = await repo.findOne({
      where: { id: keyId },
      relations: ['createdByUser']
    });

    if (!key) {
      throw new Error('Key not found');
    }

    const compliance = {
      keyId,
      isCompliant: true,
      issues: [],
      recommendations: []
    };

    // Check if key is expired
    if (key.expirationDate && new Date() > key.expirationDate) {
      compliance.isCompliant = false;
      compliance.issues.push('Key has expired');
      compliance.recommendations.push('Rotate expired key immediately');
    }

    // Check if key has exceeded usage limits
    if (key.maxUsageCount && key.usageCount >= key.maxUsageCount) {
      compliance.isCompliant = false;
      compliance.issues.push('Key has exceeded maximum usage count');
      compliance.recommendations.push('Rotate overused key');
    }

    // Check key strength
    if (key.keyStrength && key.keyStrength < 80) {
      compliance.isCompliant = false;
      compliance.issues.push('Key strength below recommended threshold');
      compliance.recommendations.push('Generate new key with higher strength');
    }

    // Check algorithm compliance
    const deprecatedAlgorithms = ['aes-256-cbc']; // Example
    if (deprecatedAlgorithms.includes(key.algorithm)) {
      compliance.isCompliant = false;
      compliance.issues.push('Using deprecated encryption algorithm');
      compliance.recommendations.push('Upgrade to modern encryption algorithm');
    }

    return compliance;
  }

  /**
   * Get keys by compliance framework
   */
  static async getKeysByComplianceFramework(framework, options = {}) {
    const repo = this.getRepository();
    const { page = 1, limit = 50 } = options;

    const queryBuilder = repo.createQueryBuilder('key')
      .leftJoinAndSelect('key.createdByUser', 'user')
      .where('key.complianceFlags @> :framework', {
        framework: JSON.stringify({ [framework]: true })
      })
      .andWhere('key.keyStatus = :status', { status: 'active' });

    queryBuilder.orderBy('key.createdAt', 'DESC');

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [keys, total] = await queryBuilder.getManyAndCount();

    return {
      keys,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      framework
    };
  }
}

module.exports = EncryptionKeyRepository;