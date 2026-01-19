// src/repositories/documentFileRepository.js
const AppDataSource = require('../../../config/database');

class DocumentFileRepository {

  static getRepository() {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }
    return AppDataSource.getRepository('DocumentFile');
  }
  /**
   * Create a new file record
   */
  static async createFile(fileData) {
    const repo = this.getRepository();
    const file = repo.create(fileData);
    return await repo.save(file);
  }

  /**
   * Get file by ID with access check
   */
  static async getFileById(fileId, userId) {
    const repo = this.getRepository();

    return await repo.createQueryBuilder('file')
      .leftJoinAndSelect('file.folder', 'folder')
      .leftJoinAndSelect('folder.owner', 'owner')
      .where('file.id = :fileId', { fileId })
      .andWhere('owner.id = :userId', { userId })
      .andWhere('file.status != :status', { status: 'deleted' })
      .getOne();
  }

  /**
   * Get files in a folder
   */
  static async getFolderFiles(folderId, userId, options = {}) {
    const repo = this.getRepository();
    const {
      page = 1,
      limit = 50,
      documentType,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = options;

    const queryBuilder = repo.createQueryBuilder('file')
      .leftJoinAndSelect('file.folder', 'folder')
      .leftJoinAndSelect('folder.owner', 'owner')
      .where('folder.id = :folderId', { folderId })
      .andWhere('owner.id = :userId', { userId })
      .andWhere('file.status != :status', { status: 'deleted' });

    // Filter by document type
    if (documentType) {
      queryBuilder.andWhere('file.documentType = :documentType', { documentType });
    }

    // Sorting
    queryBuilder.orderBy(`file.${sortBy}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [files, total] = await queryBuilder.getManyAndCount();

    return {
      files,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Update file record
   */
  static async updateFile(fileId, userId, updateData) {
    const repo = this.getRepository();

    // Ensure user owns the file
    const file = await this.getFileById(fileId, userId);
    if (!file) {
      throw new Error('File not found or access denied');
    }

    await repo.update(fileId, updateData);
    return await this.getFileById(fileId, userId);
  }

  /**
   * Delete file (soft delete)
   */
  static async deleteFile(fileId, userId) {
    const repo = this.getRepository();

    const file = await this.getFileById(fileId, userId);
    if (!file) {
      throw new Error('File not found or access denied');
    }

    await repo.update(fileId, {
      status: 'deleted',
      updatedAt: new Date()
    });

    return file; // Return file info for cleanup
  }

  /**
   * Get files by document type
   */
  static async getFilesByDocumentType(userId, documentType, limit = 20) {
    const repo = this.getRepository();

    return await repo.createQueryBuilder('file')
      .leftJoinAndSelect('file.folder', 'folder')
      .leftJoinAndSelect('folder.owner', 'owner')
      .where('owner.id = :userId', { userId })
      .andWhere('file.documentType = :documentType', { documentType })
      .andWhere('file.status = :status', { status: 'ready' })
      .orderBy('file.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Update file access tracking
   */
  static async trackFileAccess(fileId, userId) {
    const repo = this.getRepository();

    await repo.update(fileId, {
      downloadCount: () => 'download_count + 1',
      lastAccessedAt: new Date()
    });
  }

  /**
   * Get file statistics
   */
  static async getFileStats(userId) {
    const repo = this.getRepository();

    const stats = await repo.createQueryBuilder('file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .select([
        'COUNT(*) as total_files',
        'SUM(file.fileSize) as total_size',
        'COUNT(CASE WHEN file.status = \'ready\' THEN 1 END) as ready_files',
        'COUNT(CASE WHEN file.isEncrypted = true THEN 1 END) as encrypted_files',
        'COUNT(DISTINCT file.documentType) as document_types'
      ])
      .where('owner.id = :userId', { userId })
      .andWhere('file.status != :status', { status: 'deleted' })
      .getRawOne();

    return {
      totalFiles: parseInt(stats.total_files) || 0,
      totalSize: parseInt(stats.total_size) || 0,
      readyFiles: parseInt(stats.ready_files) || 0,
      encryptedFiles: parseInt(stats.encrypted_files) || 0,
      documentTypes: parseInt(stats.document_types) || 0
    };
  }

  /**
   * Search files across all folders
   */
  static async searchFiles(userId, searchTerm, options = {}) {
    const repo = this.getRepository();
    const {
      page = 1,
      limit = 20,
      documentType,
      folderType
    } = options;

    const queryBuilder = repo.createQueryBuilder('file')
      .leftJoinAndSelect('file.folder', 'folder')
      .leftJoinAndSelect('folder.owner', 'owner')
      .where('owner.id = :userId', { userId })
      .andWhere('file.status != :status', { status: 'deleted' })
      .andWhere(
        '(file.originalFileName ILIKE :search OR file.documentType ILIKE :search)',
        { search: `%${searchTerm}%` }
      );

    if (documentType) {
      queryBuilder.andWhere('file.documentType = :documentType', { documentType });
    }

    if (folderType) {
      queryBuilder.andWhere('folder.folderType = :folderType', { folderType });
    }

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('file.createdAt', 'DESC');

    const [files, total] = await queryBuilder.getManyAndCount();

    return {
      files,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get files by hash (duplicate detection)
   */
  static async getFilesByHash(userId, fileHash) {
    const repo = this.getRepository();

    return await repo.createQueryBuilder('file')
      .leftJoinAndSelect('file.folder', 'folder')
      .leftJoinAndSelect('folder.owner', 'owner')
      .where('owner.id = :userId', { userId })
      .andWhere('file.fileHash = :fileHash', { fileHash })
      .andWhere('file.status != :status', { status: 'deleted' })
      .getMany();
  }

  /**
   * Get recent files
   */
  static async getRecentFiles(userId, limit = 10) {
    const repo = this.getRepository();

    return await repo.createQueryBuilder('file')
      .leftJoinAndSelect('file.folder', 'folder')
      .leftJoinAndSelect('folder.owner', 'owner')
      .where('owner.id = :userId', { userId })
      .andWhere('file.status = :status', { status: 'ready' })
      .orderBy('file.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Bulk update files
   */
  static async bulkUpdateFiles(fileIds, userId, updateData) {
    const repo = this.getRepository();

    // Verify all files belong to user
    const files = await repo.createQueryBuilder('file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .where('file.id IN (:...fileIds)', { fileIds })
      .andWhere('owner.id = :userId', { userId })
      .getMany();

    if (files.length !== fileIds.length) {
      throw new Error('Some files not found or access denied');
    }

    await repo.update(fileIds, updateData);
    return files.length;
  }

  /**
 * Get all files for a specific patient
 */
  static async getPatientFiles(userId, patientIdentifier, options = {}) {
    const repo = this.getRepository();
    const {
      page = 1,
      limit = 50,
      fhirResourceType,
      fhirSensitivityLevel,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = options;

    const queryBuilder = repo.createQueryBuilder('file')
      .leftJoinAndSelect('file.folder', 'folder')
      .leftJoinAndSelect('folder.owner', 'owner')
      .where('owner.id = :userId', { userId })
      .andWhere('file.patientIdentifier = :patientIdentifier', { patientIdentifier })
      .andWhere('file.status != :status', { status: 'deleted' });

    // Filter by FHIR resource type
    if (fhirResourceType) {
      queryBuilder.andWhere('file.fhirResourceType = :fhirResourceType', { fhirResourceType });
    }

    // Filter by sensitivity level
    if (fhirSensitivityLevel) {
      queryBuilder.andWhere('file.fhirSensitivityLevel = :fhirSensitivityLevel', { fhirSensitivityLevel });
    }

    // Sorting
    queryBuilder.orderBy(`file.${sortBy}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [files, total] = await queryBuilder.getManyAndCount();

    return {
      files,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      patientIdentifier
    };
  }

  /**
   * Get files by FHIR resource type
   */
  static async getFilesByFHIRResourceType(userId, fhirResourceType, options = {}) {
    const repo = this.getRepository();
    const {
      page = 1,
      limit = 50,
      patientIdentifier,
      fhirSensitivityLevel,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = options;

    const queryBuilder = repo.createQueryBuilder('file')
      .leftJoinAndSelect('file.folder', 'folder')
      .leftJoinAndSelect('folder.owner', 'owner')
      .where('owner.id = :userId', { userId })
      .andWhere('file.fhirResourceType = :fhirResourceType', { fhirResourceType })
      .andWhere('file.status != :status', { status: 'deleted' });

    // Filter by patient
    if (patientIdentifier) {
      queryBuilder.andWhere('file.patientIdentifier = :patientIdentifier', { patientIdentifier });
    }

    // Filter by sensitivity level
    if (fhirSensitivityLevel) {
      queryBuilder.andWhere('file.fhirSensitivityLevel = :fhirSensitivityLevel', { fhirSensitivityLevel });
    }

    queryBuilder.orderBy(`file.${sortBy}`, sortOrder);

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [files, total] = await queryBuilder.getManyAndCount();

    return {
      files,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      fhirResourceType
    };
  }

  /**
   * Get patient summary (all resource types for a patient)
   */
  static async getPatientSummary(userId, patientIdentifier) {
    const repo = this.getRepository();

    const summary = await repo.createQueryBuilder('file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .select([
        'file.fhirResourceType as resource_type',
        'COUNT(*) as count',
        'MAX(file.createdAt) as latest_date',
        'file.fhirSensitivityLevel as sensitivity_level'
      ])
      .where('owner.id = :userId', { userId })
      .andWhere('file.patientIdentifier = :patientIdentifier', { patientIdentifier })
      .andWhere('file.fhirResourceType IS NOT NULL')
      .andWhere('file.status != :status', { status: 'deleted' })
      .groupBy('file.fhirResourceType, file.fhirSensitivityLevel')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    // Get total file count for patient
    const totalFiles = await repo.createQueryBuilder('file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .where('owner.id = :userId', { userId })
      .andWhere('file.patientIdentifier = :patientIdentifier', { patientIdentifier })
      .andWhere('file.status != :status', { status: 'deleted' })
      .getCount();

    return {
      patientIdentifier,
      totalFiles,
      resourceSummary: summary.map(item => ({
        resourceType: item.resource_type,
        count: parseInt(item.count),
        latestDate: item.latest_date,
        sensitivityLevel: item.sensitivity_level
      }))
    };
  }

  /**
   * Search FHIR files with advanced filters
   */
  static async searchFHIRFiles(userId, searchOptions = {}) {
    const repo = this.getRepository();
    const {
      patientIdentifier,
      fhirResourceType,
      fhirSensitivityLevel,
      securityLabels,
      dateFrom,
      dateTo,
      searchTerm,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = searchOptions;

    const queryBuilder = repo.createQueryBuilder('file')
      .leftJoinAndSelect('file.folder', 'folder')
      .leftJoinAndSelect('folder.owner', 'owner')
      .where('owner.id = :userId', { userId })
      .andWhere('file.fhirResourceType IS NOT NULL')
      .andWhere('file.status != :status', { status: 'deleted' });

    // Patient filter
    if (patientIdentifier) {
      queryBuilder.andWhere('file.patientIdentifier = :patientIdentifier', { patientIdentifier });
    }

    // Resource type filter
    if (fhirResourceType) {
      if (Array.isArray(fhirResourceType)) {
        queryBuilder.andWhere('file.fhirResourceType IN (:...fhirResourceTypes)', { fhirResourceTypes: fhirResourceType });
      } else {
        queryBuilder.andWhere('file.fhirResourceType = :fhirResourceType', { fhirResourceType });
      }
    }

    // Sensitivity level filter
    if (fhirSensitivityLevel) {
      if (Array.isArray(fhirSensitivityLevel)) {
        queryBuilder.andWhere('file.fhirSensitivityLevel IN (:...sensitivityLevels)', { sensitivityLevels: fhirSensitivityLevel });
      } else {
        queryBuilder.andWhere('file.fhirSensitivityLevel = :fhirSensitivityLevel', { fhirSensitivityLevel });
      }
    }

    // Security labels filter (JSON search)
    if (securityLabels && securityLabels.length > 0) {
      const labelConditions = securityLabels.map((label, index) =>
        `file.fhirSecurityLabels @> :label${index}`
      ).join(' OR ');

      queryBuilder.andWhere(`(${labelConditions})`);

      securityLabels.forEach((label, index) => {
        queryBuilder.setParameter(`label${index}`, JSON.stringify([{ code: label }]));
      });
    }

    // Date range filter
    if (dateFrom) {
      queryBuilder.andWhere('file.createdAt >= :dateFrom', { dateFrom: new Date(dateFrom) });
    }

    if (dateTo) {
      queryBuilder.andWhere('file.createdAt <= :dateTo', { dateTo: new Date(dateTo) });
    }

    // Text search
    if (searchTerm) {
      queryBuilder.andWhere(
        '(file.originalFileName ILIKE :search OR file.fhirResourceId ILIKE :search)',
        { search: `%${searchTerm}%` }
      );
    }

    // Sorting
    queryBuilder.orderBy(`file.${sortBy}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [files, total] = await queryBuilder.getManyAndCount();

    return {
      files,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      searchCriteria: searchOptions
    };
  }

  /**
   * Get all patients with FHIR data for a user
   */
  static async getUserPatients(userId, options = {}) {
    const repo = this.getRepository();
    const { page = 1, limit = 50 } = options;

    const queryBuilder = repo.createQueryBuilder('file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .select([
        'file.patientIdentifier as patient_identifier',
        'COUNT(*) as file_count',
        'COUNT(CASE WHEN file.fhirResourceType = \'Patient\' THEN 1 END) as patient_records',
        'MAX(file.createdAt) as latest_activity',
        'array_agg(DISTINCT file.fhirResourceType) as resource_types',
        'MAX(file.fhirSensitivityLevel) as max_sensitivity'
      ])
      .where('owner.id = :userId', { userId })
      .andWhere('file.patientIdentifier IS NOT NULL')
      .andWhere('file.status != :status', { status: 'deleted' })
      .groupBy('file.patientIdentifier')
      .orderBy('MAX(file.createdAt)', 'DESC');

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.offset(skip).limit(limit);

    const patients = await queryBuilder.getRawMany();

    // Get total count
    const totalQuery = repo.createQueryBuilder('file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .select('COUNT(DISTINCT file.patientIdentifier)')
      .where('owner.id = :userId', { userId })
      .andWhere('file.patientIdentifier IS NOT NULL')
      .andWhere('file.status != :status', { status: 'deleted' });

    const [{ count: total }] = await totalQuery.getRawMany();

    return {
      patients: patients.map(patient => ({
        patientIdentifier: patient.patient_identifier,
        fileCount: parseInt(patient.file_count),
        patientRecords: parseInt(patient.patient_records),
        latestActivity: patient.latest_activity,
        resourceTypes: patient.resource_types.filter(type => type !== null),
        maxSensitivity: patient.max_sensitivity
      })),
      total: parseInt(total),
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get FHIR statistics for a user
   */
  static async getFHIRStats(userId) {
    const repo = this.getRepository();

    // Resource type distribution
    const resourceStats = await repo.createQueryBuilder('file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .select([
        'file.fhirResourceType as resource_type',
        'COUNT(*) as count',
        'file.fhirSensitivityLevel as sensitivity_level'
      ])
      .where('owner.id = :userId', { userId })
      .andWhere('file.fhirResourceType IS NOT NULL')
      .andWhere('file.status != :status', { status: 'deleted' })
      .groupBy('file.fhirResourceType, file.fhirSensitivityLevel')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    // Patient count
    const patientCount = await repo.createQueryBuilder('file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .select('COUNT(DISTINCT file.patientIdentifier)')
      .where('owner.id = :userId', { userId })
      .andWhere('file.patientIdentifier IS NOT NULL')
      .andWhere('file.status != :status', { status: 'deleted' })
      .getRawOne();

    // Total FHIR files
    const fhirFileCount = await repo.createQueryBuilder('file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .where('owner.id = :userId', { userId })
      .andWhere('file.fhirResourceType IS NOT NULL')
      .andWhere('file.status != :status', { status: 'deleted' })
      .getCount();

    // Sensitivity distribution
    const sensitivityStats = await repo.createQueryBuilder('file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .select([
        'file.fhirSensitivityLevel as sensitivity_level',
        'COUNT(*) as count'
      ])
      .where('owner.id = :userId', { userId })
      .andWhere('file.fhirResourceType IS NOT NULL')
      .andWhere('file.status != :status', { status: 'deleted' })
      .groupBy('file.fhirSensitivityLevel')
      .getRawMany();

    return {
      totalFHIRFiles: fhirFileCount,
      totalPatients: parseInt(patientCount.count),
      resourceTypeDistribution: resourceStats.map(stat => ({
        resourceType: stat.resource_type,
        count: parseInt(stat.count),
        sensitivityLevel: stat.sensitivity_level
      })),
      sensitivityDistribution: sensitivityStats.map(stat => ({
        sensitivityLevel: stat.sensitivity_level,
        count: parseInt(stat.count)
      }))
    };
  }

  /**
   * Get related files for a patient (files with same patient identifier)
   */
  static async getRelatedFiles(userId, fileId, limit = 10) {
    const repo = this.getRepository();

    // First get the current file to find its patient identifier
    const currentFile = await repo.createQueryBuilder('file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .where('file.id = :fileId', { fileId })
      .andWhere('owner.id = :userId', { userId })
      .getOne();

    if (!currentFile || !currentFile.patientIdentifier) {
      return { files: [], total: 0 };
    }

    // Get related files
    const [files, total] = await repo.createQueryBuilder('file')
      .leftJoinAndSelect('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .where('owner.id = :userId', { userId })
      .andWhere('file.patientIdentifier = :patientIdentifier', {
        patientIdentifier: currentFile.patientIdentifier
      })
      .andWhere('file.id != :fileId', { fileId }) // Exclude current file
      .andWhere('file.status != :status', { status: 'deleted' })
      .orderBy('file.createdAt', 'DESC')
      .take(limit)
      .getManyAndCount();

    return {
      files,
      total,
      patientIdentifier: currentFile.patientIdentifier,
      currentFileId: fileId
    };
  }

  /**
   * Bulk operations for FHIR files
   */
  static async bulkUpdateFHIRFiles(userId, fileIds, updateData) {
    const repo = this.getRepository();

    // Verify all files belong to user and are FHIR files
    const files = await repo.createQueryBuilder('file')
      .leftJoin('file.folder', 'folder')
      .leftJoin('folder.owner', 'owner')
      .where('file.id IN (:...fileIds)', { fileIds })
      .andWhere('owner.id = :userId', { userId })
      .andWhere('file.fhirResourceType IS NOT NULL')
      .getMany();

    if (files.length !== fileIds.length) {
      throw new Error('Some files not found, not accessible, or not FHIR resources');
    }

    // Filter update data to only FHIR fields
    const allowedFHIRFields = [
      'fhirSensitivityLevel',
      'fhirSecurityLabels',
      'consentDirectives',
      'purposeOfUse'
    ];

    const filteredUpdateData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFHIRFields.includes(key)) {
        filteredUpdateData[key] = updateData[key];
      }
    });

    if (Object.keys(filteredUpdateData).length === 0) {
      throw new Error('No valid FHIR fields to update');
    }

    filteredUpdateData.updatedAt = new Date();

    await repo.update(fileIds, filteredUpdateData);
    return files.length;
  }

}

module.exports = DocumentFileRepository;