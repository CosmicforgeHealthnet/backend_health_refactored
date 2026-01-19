// src/repositories/accessLogRepository.js
const AppDataSource = require('../../../config/database');

class AccessLogRepository {

  static getFolderLogRepository() {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }
    return AppDataSource.getRepository('FolderAccessLog');
  }

  static getFileLogRepository() {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }
    return AppDataSource.getRepository('FileAccessLog');
  }

  /**
   * Log folder access
   */
  static async logFolderAccess(folderId, userId, accessType, ipAddress, userAgent, metadata = {}) {
    const repo = this.getFolderLogRepository();

    const log = repo.create({
      folder: { id: folderId },
      user: { id: userId },
      accessType,
      ipAddress,
      userAgent,
      metadata: {
        ...metadata,
        timestamp: Date.now()
      }
    });

    return await repo.save(log);
  }

  /**
   * Log file access
   */
  static async logFileAccess(fileId, userId, accessType, ipAddress, userAgent, duration = null, metadata = {}) {
    const repo = this.getFileLogRepository();

    const log = repo.create({
      file: { id: fileId },
      user: { id: userId },
      accessType,
      ipAddress,
      userAgent,
      downloadDuration: duration,
      metadata: {
        ...metadata,
        timestamp: Date.now()
      }
    });

    return await repo.save(log);
  }

  /**
   * Get folder access logs
   */
  static async getFolderAccessLogs(folderId, userId, options = {}) {
    const repo = this.getFolderLogRepository();
    const {
      page = 1,
      limit = 50,
      accessType,
      startDate,
      endDate
    } = options;

    const queryBuilder = repo.createQueryBuilder('log')
      .leftJoinAndSelect('log.folder', 'folder')
      .leftJoinAndSelect('log.user', 'user')
      .leftJoinAndSelect('folder.owner', 'owner')
      .where('folder.id = :folderId', { folderId })
      .andWhere('owner.id = :userId', { userId });

    if (accessType) {
      queryBuilder.andWhere('log.accessType = :accessType', { accessType });
    }

    if (startDate) {
      queryBuilder.andWhere('log.accessedAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('log.accessedAt <= :endDate', { endDate });
    }

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('log.accessedAt', 'DESC');

    const [logs, total] = await queryBuilder.getManyAndCount();

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get file access logs
   */
  static async getFileAccessLogs(fileId, userId, options = {}) {
    const repo = this.getFileLogRepository();
    const {
      page = 1,
      limit = 50,
      accessType
    } = options;

    const queryBuilder = repo.createQueryBuilder('log')
      .leftJoinAndSelect('log.file', 'file')
      .leftJoinAndSelect('log.user', 'user')
      .leftJoinAndSelect('file.folder', 'folder')
      .leftJoinAndSelect('folder.owner', 'owner')
      .where('file.id = :fileId', { fileId })
      .andWhere('owner.id = :userId', { userId });

    if (accessType) {
      queryBuilder.andWhere('log.accessType = :accessType', { accessType });
    }

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('log.accessedAt', 'DESC');

    const [logs, total] = await queryBuilder.getManyAndCount();

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get user activity summary
   */
  static async getUserActivitySummary(userId, days = 30) {
    const folderRepo = this.getFolderLogRepository();
    const fileRepo = this.getFileLogRepository();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Folder activity
    const folderActivity = await folderRepo.createQueryBuilder('log')
      .leftJoin('log.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .select([
        'log.accessType',
        'COUNT(*) as count'
      ])
      .where('owner.id = :userId', { userId })
      .andWhere('log.accessedAt >= :startDate', { startDate })
      .groupBy('log.accessType')
      .getRawMany();

    // File activity
    const fileActivity = await fileRepo.createQueryBuilder('log')
      .leftJoin('log.file', 'file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .select([
        'log.accessType',
        'COUNT(*) as count',
        'AVG(log.downloadDuration) as avg_duration'
      ])
      .where('owner.id = :userId', { userId })
      .andWhere('log.accessedAt >= :startDate', { startDate })
      .groupBy('log.accessType')
      .getRawMany();

    return {
      period: `${days} days`,
      folderActivity,
      fileActivity,
      generatedAt: new Date()
    };
  }

  /**
   * Get access statistics
   */
  static async getAccessStats(userId, resourceType = 'both', days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = {};

    if (resourceType === 'both' || resourceType === 'folder') {
      const folderRepo = this.getFolderLogRepository();

      const folderStats = await folderRepo.createQueryBuilder('log')
        .leftJoin('log.folder', 'folder')
        .leftJoin('folder.owner', 'owner')
        .select([
          'COUNT(*) as total_accesses',
          'COUNT(DISTINCT folder.id) as unique_folders',
          'COUNT(DISTINCT DATE(log.accessedAt)) as active_days'
        ])
        .where('owner.id = :userId', { userId })
        .andWhere('log.accessedAt >= :startDate', { startDate })
        .getRawOne();

      stats.folders = {
        totalAccesses: parseInt(folderStats.total_accesses) || 0,
        uniqueFolders: parseInt(folderStats.unique_folders) || 0,
        activeDays: parseInt(folderStats.active_days) || 0
      };
    }

    if (resourceType === 'both' || resourceType === 'file') {
      const fileRepo = this.getFileLogRepository();

      const fileStats = await fileRepo.createQueryBuilder('log')
        .leftJoin('log.file', 'file')
        .leftJoin('file.folder', 'folder')
        .leftJoin('folder.owner', 'owner')
        .select([
          'COUNT(*) as total_accesses',
          'COUNT(DISTINCT file.id) as unique_files',
          'SUM(CASE WHEN log.accessType = \'download\' THEN 1 ELSE 0 END) as downloads',
          'AVG(log.downloadDuration) as avg_download_time'
        ])
        .where('owner.id = :userId', { userId })
        .andWhere('log.accessedAt >= :startDate', { startDate })
        .getRawOne();

      stats.files = {
        totalAccesses: parseInt(fileStats.total_accesses) || 0,
        uniqueFiles: parseInt(fileStats.unique_files) || 0,
        downloads: parseInt(fileStats.downloads) || 0,
        avgDownloadTime: parseFloat(fileStats.avg_download_time) || 0
      };
    }

    return {
      period: `${days} days`,
      ...stats,
      generatedAt: new Date()
    };
  }

  /**
 * Log patient-specific access
 */
  static async logPatientAccess(patientIdentifier, userId, accessType, ipAddress, userAgent, metadata = {}) {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }

    const logRepo = AppDataSource.getRepository('PatientAccessLog'); // You'll need this new entity
    const log = logRepo.create({
      patientIdentifier,
      user: { id: userId },
      accessType,
      ipAddress,
      userAgent,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        fhirContext: true
      }
    });
    await logRepo.save(log);
  }

  /**
   * Log resource type access
   */
  static async logResourceAccess(userId, resourceType, accessType, ipAddress, userAgent, metadata = {}) {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }

    const logRepo = AppDataSource.getRepository('ResourceAccessLog'); // You'll need this new entity
    const log = logRepo.create({
      resourceType,
      user: { id: userId },
      accessType,
      ipAddress,
      userAgent,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        fhirContext: true
      }
    });
    await logRepo.save(log);
  }

  /**
   * Log FHIR search operations
   */
  static async logFHIRSearch(userId, searchCriteria, resultCount, ipAddress, userAgent) {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }

    const logRepo = AppDataSource.getRepository('FHIRSearchLog'); // You'll need this new entity
    const log = logRepo.create({
      user: { id: userId },
      searchCriteria,
      resultCount,
      ipAddress,
      userAgent,
      metadata: {
        timestamp: Date.now(),
        fhirContext: true
      }
    });
    await logRepo.save(log);
  }

  /**
   * Log bulk operations
   */
  static async logBulkAction(userId, actionType, ipAddress, userAgent, metadata = {}) {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }

    const logRepo = AppDataSource.getRepository('BulkActionLog'); // You'll need this new entity
    const log = logRepo.create({
      user: { id: userId },
      actionType,
      ipAddress,
      userAgent,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        fhirContext: true
      }
    });
    await logRepo.save(log);
  }

  /**
  * Get suspicious activity
  */
  static async getSuspiciousActivity(userId, hours = 24) {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const fileRepo = this.getFileLogRepository();

    // Look for unusual download patterns
    const suspiciousActivity = await fileRepo.createQueryBuilder('log')
      .leftJoin('log.file', 'file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .select([
        'log.ipAddress',
        'log.userAgent',
        'COUNT(*) as access_count',
        'COUNT(DISTINCT file.id) as unique_files',
        'MIN(log.accessedAt) as first_access',
        'MAX(log.accessedAt) as last_access'
      ])
      .where('owner.id = :userId', { userId })
      .andWhere('log.accessedAt >= :startDate', { startDate })
      .andWhere('log.accessType = :accessType', { accessType: 'download' })
      .groupBy('log.ipAddress, log.userAgent')
      .having('COUNT(*) > :threshold', { threshold: 50 }) // More than 50 downloads
      .getRawMany();

    return suspiciousActivity.map(activity => ({
      ...activity,
      riskLevel: activity.access_count > 100 ? 'high' : 'medium',
      accessCount: parseInt(activity.access_count),
      uniqueFiles: parseInt(activity.unique_files)
    }));
  }
}

module.exports = AccessLogRepository;