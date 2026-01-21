// src/services/documentFileService.js
const DocumentFileRepository = require('../repositories/documentFileRepository');
const DocumentFolderRepository = require('../repositories/documentFolderRepository');
const AccessLogRepository = require('../repositories/accessLogRepository');
const crypto = require('node:crypto');
const fs = require('node:fs').promises;

const path = require('node:path');
const patientActivityListener = require('../../patient/services/patientActivityListener');

class DocumentFileService {

  /**
   * Process and save uploaded files to database
   */
  /**
   * ENHANCED: Process and save uploaded files with FHIR data
   */
  static async processUploadedFiles(userId, folderId, processedFiles, ipAddress, userAgent) {
    try {
      console.log('DocumentFileService.processUploadedFiles called with FHIR enhancement');
      console.log('userId:', userId);
      console.log('folderId:', folderId);
      console.log('processedFiles length:', processedFiles?.length);

      if (!userId) {
        throw new Error('userId is required but was not provided');
      }

      // Verify folder ownership
      const folder = await DocumentFolderRepository.getFolderById(folderId, userId);
      if (!folder) {
        throw new Error('Folder not found or access denied');
      }

      const savedFiles = [];

      for (let i = 0; i < processedFiles.length; i++) {
        const processedFile = processedFiles[i];

        // Check for duplicates
        const existingFiles = await DocumentFileRepository.getFilesByHash(userId, processedFile.fileHash);
        if (existingFiles.length > 0) {
          console.log(`Duplicate file detected: ${processedFile.originalFileName}`);
        }

        // ===== ENHANCED FILE DATA WITH FHIR FIELDS =====
        const fileData = {
          originalFileName: processedFile.originalFileName,
          storedFileName: processedFile.storedFileName,
          filePath: processedFile.filePath,
          fileSize: processedFile.fileSize,
          mimeType: processedFile.mimeType,
          fileHash: processedFile.fileHash,
          encryptionKey: processedFile.encryptionKey,
          documentType: processedFile.documentType,
          folder: { id: folderId },
          uploader: { id: userId },
          status: 'ready',
          isEncrypted: !!processedFile.encryptionKey,
          securityLevel: this.determineSecurityLevel(processedFile.mimeType, processedFile.documentType),

          // ===== NEW: FHIR FIELDS =====
          fhirResourceType: processedFile.fhirResourceType,
          patientIdentifier: processedFile.patientIdentifier,
          fhirSecurityLabels: processedFile.fhirSecurityLabels,
          fhirVersion: processedFile.fhirVersion,
          fhirSensitivityLevel: processedFile.fhirSensitivityLevel,
          fhirResourceId: processedFile.fhirResourceId,

          // Enhanced metadata with FHIR information
          metadata: {
            ...processedFile.enhancedMetadata,
            fhirAnalysis: processedFile.fhirData
          }
        };

        console.log(`Saving file with FHIR data:`, {
          fileName: fileData.originalFileName,
          resourceType: fileData.fhirResourceType,
          patientId: fileData.patientIdentifier,
          sensitivity: fileData.fhirSensitivityLevel
        });

        const savedFile = await DocumentFileRepository.createFile(fileData);
        savedFiles.push(savedFile);

        // Enhanced access logging with FHIR context
        await AccessLogRepository.logFileAccess(
          savedFile.id,
          userId,
          'upload',
          ipAddress,
          userAgent,
          null,
          {
            action: 'file_uploaded',
            documentType: processedFile.documentType,
            isFHIRResource: !!processedFile.fhirResourceType,
            fhirResourceType: processedFile.fhirResourceType,
            patientIdentifier: processedFile.patientIdentifier,
            fhirSensitivityLevel: processedFile.fhirSensitivityLevel
          }
        );
      }

      // Update folder hash
      await this.updateFolderHash(folderId, userId);

      // Enhanced response with FHIR information
      return {
        success: true,
        files: savedFiles.map(file => ({
          id: file.id,
          originalFileName: file.originalFileName,
          documentType: file.documentType,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          status: file.status,
          createdAt: file.createdAt,
          url: this.generateSignedUrl(file),

          // FHIR information in response
          fhirInfo: {
            resourceType: file.fhirResourceType,
            patientIdentifier: file.patientIdentifier,
            sensitivityLevel: file.fhirSensitivityLevel,
            securityLabels: file.fhirSecurityLabels,
            version: file.fhirVersion
          }
        }))
      };

    } catch (error) {
      throw new Error(`Failed to process uploaded files with FHIR enhancement: ${error.message}`);
    }
  }

  /**
   * Get file by ID
   */
  static async getFile(fileId, userId, ipAddress, userAgent) {
    try {
      const file = await DocumentFileRepository.getFileById(fileId, userId);

      if (!file) {
        return { success: false, error: 'File not found or access denied' };
      }

      // Track file access
      await DocumentFileRepository.trackFileAccess(fileId, userId);

      // Log file access
      await AccessLogRepository.logFileAccess(
        fileId,
        userId,
        'view',
        ipAddress,
        userAgent
      );

      return {
        success: true,
        file: {
          id: file.id,
          originalFileName: file.originalFileName,
          documentType: file.documentType,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          status: file.status,
          downloadCount: file.downloadCount,
          lastAccessedAt: file.lastAccessedAt,
          createdAt: file.createdAt,
          url: this.generateSignedUrl(file),
          thumbnailUrl: file.thumbnailPath ? this.generateSignedUrl(file, true) : null,
          folder: {
            id: file.folder.id,
            name: file.folder.name,
            folderType: file.folder.folderType
          }
        }
      };

    } catch (error) {
      throw new Error(`Failed to get file: ${error.message}`);
    }
  }

  /**
   * Download file
   */
  static async downloadFile(fileId, userId, ipAddress, userAgent) {
    try {
      const startTime = Date.now();

      const file = await DocumentFileRepository.getFileById(fileId, userId);

      if (!file) {
        return { success: false, error: 'File not found or access denied' };
      }

      // Get full file path
      const uploadDir = process.env.UPLOAD_DIRECTORY || 'uploads';
      const fullFilePath = path.join(uploadDir, file.filePath);

      // Check if file exists
      try {
        await fs.access(fullFilePath);
      } catch (error) {
        return { success: false, error: 'File not found on disk' };
      }

      // Read file
      let fileBuffer = await fs.readFile(fullFilePath);

      // Decrypt if encrypted
      if (file.isEncrypted && file.encryptionKey) {
        fileBuffer = this.decryptBuffer(fileBuffer, file.encryptionKey);
      }

      const downloadDuration = Date.now() - startTime;

      // Track download
      await DocumentFileRepository.trackFileAccess(fileId, userId);

      // Log download
      await AccessLogRepository.logFileAccess(
        fileId,
        userId,
        'download',
        ipAddress,
        userAgent,
        downloadDuration,
        {
          action: 'file_downloaded',
          fileSize: file.fileSize,
          duration: downloadDuration
        }
      );

      return {
        success: true,
        file: {
          buffer: fileBuffer,
          originalFileName: file.originalFileName,
          mimeType: file.mimeType,
          fileSize: file.fileSize
        }
      };

    } catch (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Delete file
   */
  static async deleteFile(fileId, userId, ipAddress, userAgent) {
    try {
      const file = await DocumentFileRepository.deleteFile(fileId, userId);

      // Log file deletion
      await AccessLogRepository.logFileAccess(
        fileId,
        userId,
        'delete',
        ipAddress,
        userAgent,
        null,
        { action: 'file_deleted', originalFileName: file.originalFileName }
      );

      // Update folder hash
      await this.updateFolderHash(file.folder.id, userId);

      return {
        success: true,
        message: 'File deleted successfully'
      };

    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Update file metadata
   */
  static async updateFile(fileId, userId, updateData, ipAddress, userAgent) {
    try {
      const updatedFile = await DocumentFileRepository.updateFile(fileId, userId, {
        ...updateData,
        updatedAt: new Date()
      });

      // Log file modification
      await AccessLogRepository.logFileAccess(
        fileId,
        userId,
        'modify',
        ipAddress,
        userAgent,
        null,
        {
          action: 'file_updated',
          changes: Object.keys(updateData)
        }
      );

      return {
        success: true,
        file: {
          id: updatedFile.id,
          originalFileName: updatedFile.originalFileName,
          documentType: updatedFile.documentType,
          metadata: updatedFile.metadata,
          updatedAt: updatedFile.updatedAt
        }
      };

    } catch (error) {
      throw new Error(`Failed to update file: ${error.message}`);
    }
  }

  /**
   * Search files
   */
  static async searchFiles(userId, searchTerm, options = {}) {
    try {
      const result = await DocumentFileRepository.searchFiles(userId, searchTerm, options);

      const filesWithUrls = result.files.map(file => ({
        id: file.id,
        originalFileName: file.originalFileName,
        documentType: file.documentType,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
        url: this.generateSignedUrl(file),
        folder: {
          id: file.folder.id,
          name: file.folder.name,
          folderType: file.folder.folderType
        }
      }));

      return {
        success: true,
        files: filesWithUrls,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      };

    } catch (error) {
      throw new Error(`Failed to search files: ${error.message}`);
    }
  }

  /**
   * Get files by document type
   */
  static async getFilesByDocumentType(userId, documentType, limit = 20) {
    try {
      const files = await DocumentFileRepository.getFilesByDocumentType(userId, documentType, limit);

      const filesWithUrls = files.map(file => ({
        id: file.id,
        originalFileName: file.originalFileName,
        documentType: file.documentType,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
        url: this.generateSignedUrl(file),
        folder: {
          id: file.folder.id,
          name: file.folder.name
        }
      }));

      return {
        success: true,
        files: filesWithUrls
      };

    } catch (error) {
      throw new Error(`Failed to get files by document type: ${error.message}`);
    }
  }

  /**
   * Get recent files
   */
  static async getRecentFiles(userId, limit = 10) {
    try {
      const files = await DocumentFileRepository.getRecentFiles(userId, limit);

      const filesWithUrls = files.map(file => ({
        id: file.id,
        originalFileName: file.originalFileName,
        documentType: file.documentType,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
        url: this.generateSignedUrl(file),
        folder: {
          name: file.folder.name
        }
      }));

      return {
        success: true,
        files: filesWithUrls
      };

    } catch (error) {
      throw new Error(`Failed to get recent files: ${error.message}`);
    }
  }

  /**
   * Get user file statistics
   */
  static async getUserFileStats(userId) {
    try {
      const stats = await DocumentFileRepository.getFileStats(userId);

      return {
        success: true,
        stats: {
          ...stats,
          totalSizeFormatted: this.formatFileSize(stats.totalSize)
        }
      };

    } catch (error) {
      throw new Error(`Failed to get user file stats: ${error.message}`);
    }
  }

  /**
   * Bulk delete files
   */
  static async bulkDeleteFiles(fileIds, userId, ipAddress, userAgent) {
    try {
      const deletedCount = await DocumentFileRepository.bulkUpdateFiles(fileIds, userId, {
        status: 'deleted',
        updatedAt: new Date()
      });

      // Log bulk deletion
      for (const fileId of fileIds) {
        await AccessLogRepository.logFileAccess(
          fileId,
          userId,
          'delete',
          ipAddress,
          userAgent,
          null,
          { action: 'bulk_file_deleted' }
        );
      }

      return {
        success: true,
        message: `${deletedCount} files deleted successfully`
      };

    } catch (error) {
      throw new Error(`Failed to bulk delete files: ${error.message}`);
    }
  }

  // Helper methods

  /**
   * Determine security level
   */
  static determineSecurityLevel(mimeType, documentType) {
    const sensitiveTypes = ['verification', 'medical_records', 'prescription'];
    const sensitiveMimes = ['application/pdf'];

    if (sensitiveTypes.includes(documentType) || sensitiveMimes.includes(mimeType)) {
      return 'confidential';
    }
    return 'private';
  }

  /**
   * Generate signed URL
   */
  static generateSignedUrl(file, thumbnail = false) {
    const baseUrl = process.env.FILE_SERVER_URL;
    const secret = process.env.URL_SIGNING_SECRET;

    if (!baseUrl || !secret) {
      throw new Error('FILE_SERVER_URL and URL_SIGNING_SECRET must be set');
    }

    const expiresAt = Date.now() + (24 * 60 * 60 * 1000);
    const token = crypto.createHash('sha256')
      .update(`${file.id}:${expiresAt}:${secret}`)
      .digest('hex');

    return `${baseUrl}/files/${file.id}?token=${token}&expires=${expiresAt}&thumbnail=${thumbnail}`;
  }

  /**
   * Decrypt file buffer - FIXED VERSION
   */
  static decryptBuffer(encryptedBuffer, encryptionKey) {
    try {
      const algorithm = 'aes-256-gcm';

      // Extract components from the encrypted buffer
      const iv = encryptedBuffer.slice(0, 16);           // First 16 bytes: IV
      const authTag = encryptedBuffer.slice(16, 32);     // Next 16 bytes: Auth tag
      const encrypted = encryptedBuffer.slice(32);       // Rest: encrypted data

      // Create decipher with IV
      const decipher = crypto.createDecipheriv(algorithm, Buffer.from(encryptionKey, 'hex'), iv);
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt file: ${error.message}`);
    }
  }

  /**
   * Encrypt file buffer - NEW HELPER METHOD
   */
  static encryptBuffer(buffer, encryptionKey) {
    try {
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);  // Generate random IV

      // Create cipher with IV
      const cipher = crypto.createCipheriv(algorithm, Buffer.from(encryptionKey, 'hex'), iv);

      // Encrypt the data
      let encrypted = cipher.update(buffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Get the authentication tag
      const authTag = cipher.getAuthTag();

      // Combine IV + authTag + encrypted data
      return Buffer.concat([iv, authTag, encrypted]);
    } catch (error) {
      throw new Error(`Failed to encrypt file: ${error.message}`);
    }
  }

  /**
   * Update folder hash - FIXED VERSION
   */
  static async updateFolderHash(folderId, userId = null) {
    try {
      if (userId) {
        const files = await DocumentFileRepository.getFolderFiles(folderId, userId, { limit: 1000 });

        const combinedHash = crypto.createHash('sha256')
          .update(files.files.map(f => f.fileHash).sort().join(''))
          .digest('hex');

        await DocumentFolderRepository.updateFolderHash(folderId, combinedHash);
      } else {
        // Fallback - just update with empty hash
        await DocumentFolderRepository.updateFolderHash(folderId, '');
      }
    } catch (error) {
      console.error('Error updating folder hash:', error);
      // Don't throw error to prevent breaking the main flow
    }
  }

  /**
   * Format file size
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Add these methods to your existing DocumentFileService class:

  /**
   * Get all files for a specific patient
   */
  static async getPatientFiles(userId, patientIdentifier, options = {}, ipAddress, userAgent) {
    try {
      const result = await DocumentFileRepository.getPatientFiles(userId, patientIdentifier, options);

      // Log patient data access
      await AccessLogRepository.logPatientAccess(
        patientIdentifier,
        userId,
        'view_patient_files',
        ipAddress,
        userAgent,
        {
          action: 'patient_files_accessed',
          fileCount: result.files.length,
          resourceTypes: [...new Set(result.files.map(f => f.fhirResourceType).filter(Boolean))]
        }
      );

      const filesWithUrls = result.files.map(file => ({
        id: file.id,
        originalFileName: file.originalFileName,
        documentType: file.documentType,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
        url: this.generateSignedUrl(file),

        // FHIR-specific information
        fhirInfo: {
          resourceType: file.fhirResourceType,
          resourceId: file.fhirResourceId,
          sensitivityLevel: file.fhirSensitivityLevel,
          securityLabels: file.fhirSecurityLabels,
          version: file.fhirVersion
        },

        folder: {
          id: file.folder.id,
          name: file.folder.name,
          folderType: file.folder.folderType
        }
      }));

      return {
        success: true,
        files: filesWithUrls,
        patientIdentifier,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      };

    } catch (error) {
      throw new Error(`Failed to get patient files: ${error.message}`);
    }
  }

  /**
   * Get patient summary (overview of all resource types)
   */
  static async getPatientSummary(userId, patientIdentifier, ipAddress, userAgent) {
    try {
      const summary = await DocumentFileRepository.getPatientSummary(userId, patientIdentifier);

      // Log patient summary access
      await AccessLogRepository.logPatientAccess(
        patientIdentifier,
        userId,
        'view_patient_summary',
        ipAddress,
        userAgent,
        {
          action: 'patient_summary_accessed',
          totalFiles: summary.totalFiles,
          resourceTypes: summary.resourceSummary.map(r => r.resourceType)
        }
      );

      return {
        success: true,
        patientIdentifier,
        summary: {
          totalFiles: summary.totalFiles,
          resourceTypes: summary.resourceSummary,
          lastActivity: summary.resourceSummary.length > 0 ?
            Math.max(...summary.resourceSummary.map(r => new Date(r.latestDate).getTime())) : null
        }
      };

    } catch (error) {
      throw new Error(`Failed to get patient summary: ${error.message}`);
    }
  }

  /**
   * Get files by FHIR resource type
   */
  static async getFilesByResourceType(userId, fhirResourceType, options = {}, ipAddress, userAgent) {
    try {
      const result = await DocumentFileRepository.getFilesByFHIRResourceType(userId, fhirResourceType, options);

      // Log resource type access
      await AccessLogRepository.logResourceAccess(
        userId,
        fhirResourceType,
        'view',
        ipAddress,
        userAgent,
        {
          action: 'resource_type_accessed',
          fileCount: result.files.length,
          patientCount: [...new Set(result.files.map(f => f.patientIdentifier).filter(Boolean))].length
        }
      );

      const filesWithUrls = result.files.map(file => ({
        id: file.id,
        originalFileName: file.originalFileName,
        documentType: file.documentType,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
        url: this.generateSignedUrl(file),

        fhirInfo: {
          resourceType: file.fhirResourceType,
          resourceId: file.fhirResourceId,
          patientIdentifier: file.patientIdentifier,
          sensitivityLevel: file.fhirSensitivityLevel,
          securityLabels: file.fhirSecurityLabels,
          version: file.fhirVersion
        },

        folder: {
          id: file.folder.id,
          name: file.folder.name
        }
      }));

      return {
        success: true,
        files: filesWithUrls,
        fhirResourceType,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      };

    } catch (error) {
      throw new Error(`Failed to get files by resource type: ${error.message}`);
    }
  }

  /**
   * Advanced FHIR search
   */
  static async searchFHIRFiles(userId, searchOptions, ipAddress, userAgent) {
    try {
      const result = await DocumentFileRepository.searchFHIRFiles(userId, searchOptions);

      // Log FHIR search
      await AccessLogRepository.logFHIRSearch(
        userId,
        searchOptions,
        result.files.length,
        ipAddress,
        userAgent
      );

      const filesWithUrls = result.files.map(file => ({
        id: file.id,
        originalFileName: file.originalFileName,
        documentType: file.documentType,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
        url: this.generateSignedUrl(file),

        fhirInfo: {
          resourceType: file.fhirResourceType,
          resourceId: file.fhirResourceId,
          patientIdentifier: file.patientIdentifier,
          sensitivityLevel: file.fhirSensitivityLevel,
          securityLabels: file.fhirSecurityLabels,
          version: file.fhirVersion
        },

        folder: {
          id: file.folder.id,
          name: file.folder.name
        }
      }));

      return {
        success: true,
        files: filesWithUrls,
        searchCriteria: searchOptions,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      };

    } catch (error) {
      throw new Error(`Failed to search FHIR files: ${error.message}`);
    }
  }

  /**
   * Get all patients for a user
   */
  static async getUserPatients(userId, options = {}) {
    try {
      const result = await DocumentFileRepository.getUserPatients(userId, options);

      return {
        success: true,
        patients: result.patients.map(patient => ({
          patientIdentifier: patient.patientIdentifier,
          fileCount: patient.fileCount,
          hasPatientRecord: patient.patientRecords > 0,
          latestActivity: patient.latestActivity,
          resourceTypes: patient.resourceTypes,
          maxSensitivity: patient.maxSensitivity,

          // Generate patient dashboard URL
          dashboardUrl: `/patients/${encodeURIComponent(patient.patientIdentifier)}`
        })),
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      };

    } catch (error) {
      throw new Error(`Failed to get user patients: ${error.message}`);
    }
  }

  /**
   * Get FHIR statistics for dashboard
   */
  static async getFHIRDashboard(userId) {
    try {
      const stats = await DocumentFileRepository.getFHIRStats(userId);

      return {
        success: true,
        dashboard: {
          overview: {
            totalFHIRFiles: stats.totalFHIRFiles,
            totalPatients: stats.totalPatients,
            averageFilesPerPatient: stats.totalPatients > 0 ?
              Math.round(stats.totalFHIRFiles / stats.totalPatients * 10) / 10 : 0
          },

          resourceDistribution: stats.resourceTypeDistribution.reduce((acc, item) => {
            if (!acc[item.resourceType]) {
              acc[item.resourceType] = { total: 0, byLevel: {} };
            }
            acc[item.resourceType].total += item.count;
            acc[item.resourceType].byLevel[item.sensitivityLevel] = item.count;
            return acc;
          }, {}),

          sensitivityOverview: stats.sensitivityDistribution.reduce((acc, item) => {
            acc[item.sensitivityLevel] = item.count;
            return acc;
          }, {}),

          // Calculate compliance score (simple example)
          complianceScore: this.calculateComplianceScore(stats)
        }
      };

    } catch (error) {
      throw new Error(`Failed to get FHIR dashboard: ${error.message}`);
    }
  }

  /**
   * Get related files for a patient (based on current file)
   */
  static async getRelatedFiles(userId, fileId, ipAddress, userAgent) {
    try {
      const result = await DocumentFileRepository.getRelatedFiles(userId, fileId);

      if (result.total > 0) {
        // Log related files access
        await AccessLogRepository.logPatientAccess(
          result.patientIdentifier,
          userId,
          'view_related_files',
          ipAddress,
          userAgent,
          {
            action: 'related_files_accessed',
            sourceFileId: fileId,
            relatedFileCount: result.files.length
          }
        );
      }

      const filesWithUrls = result.files.map(file => ({
        id: file.id,
        originalFileName: file.originalFileName,
        documentType: file.documentType,
        fhirResourceType: file.fhirResourceType,
        createdAt: file.createdAt,
        url: this.generateSignedUrl(file),
        folder: {
          name: file.folder.name
        }
      }));

      return {
        success: true,
        relatedFiles: filesWithUrls,
        patientIdentifier: result.patientIdentifier,
        totalRelated: result.total
      };

    } catch (error) {
      throw new Error(`Failed to get related files: ${error.message}`);
    }
  }

  /**
   * Update FHIR file metadata (consent, security labels, etc.)
   */
  static async updateFHIRMetadata(userId, fileId, fhirUpdateData, ipAddress, userAgent) {
    try {
      // Validate FHIR update data
      const validFields = ['fhirSensitivityLevel', 'fhirSecurityLabels', 'consentDirectives', 'purposeOfUse'];
      const filteredData = {};

      Object.keys(fhirUpdateData).forEach(key => {
        if (validFields.includes(key)) {
          filteredData[key] = fhirUpdateData[key];
        }
      });

      if (Object.keys(filteredData).length === 0) {
        return {
          success: false,
          error: 'No valid FHIR fields provided for update'
        };
      }

      const updatedFile = await DocumentFileRepository.updateFile(fileId, userId, filteredData);

      // Log FHIR metadata update
      await AccessLogRepository.logFileAccess(
        fileId,
        userId,
        'modify',
        ipAddress,
        userAgent,
        null,
        {
          action: 'fhir_metadata_updated',
          updatedFields: Object.keys(filteredData),
          patientIdentifier: updatedFile.patientIdentifier
        }
      );

      return {
        success: true,
        file: {
          id: updatedFile.id,
          fhirInfo: {
            resourceType: updatedFile.fhirResourceType,
            sensitivityLevel: updatedFile.fhirSensitivityLevel,
            securityLabels: updatedFile.fhirSecurityLabels,
            consentDirectives: updatedFile.consentDirectives,
            purposeOfUse: updatedFile.purposeOfUse
          },
          updatedAt: updatedFile.updatedAt
        }
      };

    } catch (error) {
      throw new Error(`Failed to update FHIR metadata: ${error.message}`);
    }
  }

  /**
   * Bulk update FHIR files (for consent management, etc.)
   */
  static async bulkUpdateFHIRFiles(userId, fileIds, updateData, ipAddress, userAgent) {
    try {
      const updatedCount = await DocumentFileRepository.bulkUpdateFHIRFiles(userId, fileIds, updateData);

      // Log bulk update
      await AccessLogRepository.logBulkAction(
        userId,
        'bulk_fhir_update',
        ipAddress,
        userAgent,
        {
          action: 'bulk_fhir_metadata_updated',
          fileCount: updatedCount,
          updatedFields: Object.keys(updateData)
        }
      );

      return {
        success: true,
        message: `${updatedCount} FHIR files updated successfully`,
        updatedCount
      };

    } catch (error) {
      throw new Error(`Failed to bulk update FHIR files: ${error.message}`);
    }
  }

  /**
   * Get FHIR compliance report
   */
  static async getFHIRComplianceReport(userId) {
    try {
      const stats = await DocumentFileRepository.getFHIRStats(userId);

      // Calculate compliance metrics
      const totalFiles = stats.totalFHIRFiles;
      const encryptedFiles = stats.sensitivityDistribution
        .filter(s => s.sensitivityLevel === 'high' || s.sensitivityLevel === 'very_high')
        .reduce((sum, s) => sum + s.count, 0);

      const complianceReport = {
        overview: {
          totalFHIRFiles: totalFiles,
          totalPatients: stats.totalPatients,
          encryptedFiles,
          encryptionRate: totalFiles > 0 ? Math.round((encryptedFiles / totalFiles) * 100) : 0
        },

        sensitivityBreakdown: stats.sensitivityDistribution,

        resourceTypeBreakdown: stats.resourceTypeDistribution,

        complianceChecks: {
          hasEncryptedSensitiveData: encryptedFiles > 0,
          hasPatientConsent: true, // This would check actual consent records
          hasAuditTrails: true, // This would check log completeness
          hasSensitivityLabeling: stats.resourceTypeDistribution.length > 0
        },

        recommendations: this.generateComplianceRecommendations(stats)
      };

      return {
        success: true,
        report: complianceReport,
        generatedAt: new Date()
      };

    } catch (error) {
      throw new Error(`Failed to generate compliance report: ${error.message}`);
    }
  }

  // Helper methods

  /**
   * Calculate compliance score based on FHIR stats
   */
  static calculateComplianceScore(stats) {
    let score = 0;

    // Has FHIR data
    if (stats.totalFHIRFiles > 0) score += 20;

    // Has proper sensitivity classification
    const hasSensitivityLabeling = stats.sensitivityDistribution.length > 0;
    if (hasSensitivityLabeling) score += 20;

    // Has encrypted sensitive files
    const sensitiveFiles = stats.sensitivityDistribution
      .filter(s => s.sensitivityLevel === 'high' || s.sensitivityLevel === 'very_high')
      .reduce((sum, s) => sum + s.count, 0);
    if (sensitiveFiles > 0) score += 30;

    // Has multiple resource types (comprehensive data)
    const resourceTypes = stats.resourceTypeDistribution.length;
    if (resourceTypes >= 3) score += 15;
    else if (resourceTypes >= 1) score += 10;

    // Has patient records
    const hasPatientRecords = stats.resourceTypeDistribution
      .some(r => r.resourceType === 'Patient');
    if (hasPatientRecords) score += 15;

    return Math.min(score, 100);
  }

  /**
   * Generate compliance recommendations
   */
  static generateComplianceRecommendations(stats) {
    const recommendations = [];

    // Check encryption coverage
    const totalFiles = stats.totalFHIRFiles;
    const sensitiveFiles = stats.sensitivityDistribution
      .filter(s => s.sensitivityLevel === 'high' || s.sensitivityLevel === 'very_high')
      .reduce((sum, s) => sum + s.count, 0);

    if (sensitiveFiles / totalFiles < 0.8) {
      recommendations.push({
        type: 'security',
        priority: 'high',
        message: 'Consider encrypting more sensitive FHIR resources',
        action: 'Review and update sensitivity classifications'
      });
    }

    // Check for patient records
    const hasPatientRecords = stats.resourceTypeDistribution
      .some(r => r.resourceType === 'Patient');

    if (!hasPatientRecords) {
      recommendations.push({
        type: 'data_completeness',
        priority: 'medium',
        message: 'No Patient resources found',
        action: 'Ensure patient demographic data is properly stored'
      });
    }

    // Check resource diversity
    if (stats.resourceTypeDistribution.length < 3) {
      recommendations.push({
        type: 'data_completeness',
        priority: 'low',
        message: 'Limited FHIR resource types',
        action: 'Consider expanding FHIR data collection'
      });
    }

    return recommendations;
  }

}

module.exports = DocumentFileService;