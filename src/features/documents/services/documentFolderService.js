// src/services/documentFolderService.js
const DocumentFolderRepository = require('../repositories/documentFolderRepository');
const DocumentFileRepository = require('../repositories/documentFileRepository');
const AccessLogRepository = require('../repositories/accessLogRepository');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class DocumentFolderService {

  /**
   * Create a new folder
   */
  static async createFolder(userId, folderData, ipAddress, userAgent) {
    try {
      const { name, description, folderType, metadata, tags } = folderData;

      // Generate folder encryption key
      const encryptionKey = crypto.randomBytes(32).toString('hex');

      const folderCreateData = {
        name: name || `Folder ${new Date().toISOString()}`,
        description,
        folderType: folderType || 'other',
        metadata,
        tags: tags || [],
        owner: { id: userId },
        encryptionKey,
        status: 'active'
      };

      const folder = await DocumentFolderRepository.createFolder(folderCreateData);

      // Log folder creation
      await AccessLogRepository.logFolderAccess(
        folder.id,
        userId,
        'upload',
        ipAddress,
        userAgent,
        { action: 'folder_created' }
      );

      return {
        success: true,
        folder: {
          id: folder.id,
          name: folder.name,
          description: folder.description,
          folderType: folder.folderType,
          createdAt: folder.createdAt
        }
      };

    } catch (error) {
      throw new Error(`Failed to create folder: ${error.message}`);
    }
  }

  /**
   * Get folder with files
   */
  static async getFolder(folderId, userId, ipAddress, userAgent) {
    try {
      const folder = await DocumentFolderRepository.getFolderById(folderId, userId);
      
      if (!folder) {
        return { success: false, error: 'Folder not found or access denied' };
      }

      // Log folder access
      await AccessLogRepository.logFolderAccess(
        folderId,
        userId,
        'view',
        ipAddress,
        userAgent
      );

      // Generate signed URLs for files
      const filesWithUrls = folder.files.map(file => ({
        id: file.id,
        originalFileName: file.originalFileName,
        documentType: file.documentType,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        status: file.status,
        createdAt: file.createdAt,
        url: this.generateSignedUrl(file),
        thumbnailUrl: file.thumbnailPath ? this.generateSignedUrl(file, true) : null
      }));

      return {
        success: true,
        folder: {
          id: folder.id,
          name: folder.name,
          description: folder.description,
          folderType: folder.folderType,
          metadata: folder.metadata,
          tags: folder.tags,
          createdAt: folder.createdAt,
          updatedAt: folder.updatedAt,
          files: filesWithUrls
        }
      };

    } catch (error) {
      throw new Error(`Failed to get folder: ${error.message}`);
    }
  }

  /**
   * Get user's folders with pagination and filtering
   */
  static async getUserFolders(userId, options = {}) {
    try {
      const result = await DocumentFolderRepository.getUserFolders(userId, options);

      // Add file counts and sizes to folders
      const foldersWithStats = result.folders.map(folder => ({
        id: folder.id,
        name: folder.name,
        description: folder.description,
        folderType: folder.folderType,
        metadata: folder.metadata,
        tags: folder.tags,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        fileCount: folder.files ? folder.files.length : 0,
        totalSize: folder.files ? folder.files.reduce((sum, file) => sum + parseInt(file.fileSize), 0) : 0
      }));

      return {
        success: true,
        folders: foldersWithStats,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      };

    } catch (error) {
      throw new Error(`Failed to get user folders: ${error.message}`);
    }
  }

  /**
   * Update folder
   */
  static async updateFolder(folderId, userId, updateData, ipAddress, userAgent) {
    try {
      const updatedFolder = await DocumentFolderRepository.updateFolder(folderId, userId, {
        ...updateData,
        updatedAt: new Date()
      });

      // Log folder modification
      await AccessLogRepository.logFolderAccess(
        folderId,
        userId,
        'modify',
        ipAddress,
        userAgent,
        { action: 'folder_updated', changes: Object.keys(updateData) }
      );

      return {
        success: true,
        folder: {
          id: updatedFolder.id,
          name: updatedFolder.name,
          description: updatedFolder.description,
          folderType: updatedFolder.folderType,
          metadata: updatedFolder.metadata,
          tags: updatedFolder.tags,
          updatedAt: updatedFolder.updatedAt
        }
      };

    } catch (error) {
      throw new Error(`Failed to update folder: ${error.message}`);
    }
  }

  /**
   * Delete folder
   */
  static async deleteFolder(folderId, userId, ipAddress, userAgent) {
    try {
      // Get folder first to check files
      const folder = await DocumentFolderRepository.getFolderById(folderId, userId);
      
      if (!folder) {
        return { success: false, error: 'Folder not found or access denied' };
      }

      // Soft delete the folder
      await DocumentFolderRepository.deleteFolder(folderId, userId);

      // Log folder deletion
      await AccessLogRepository.logFolderAccess(
        folderId,
        userId,
        'delete',
        ipAddress,
        userAgent,
        { 
          action: 'folder_deleted',
          fileCount: folder.files ? folder.files.length : 0
        }
      );

      return {
        success: true,
        message: 'Folder deleted successfully'
      };

    } catch (error) {
      throw new Error(`Failed to delete folder: ${error.message}`);
    }
  }

  /**
   * Get folder statistics - FIXED VERSION
   */
  static async getFolderStats(folderId, userId) {
    try {
      const stats = await DocumentFolderRepository.getFolderStats(folderId, userId);

      return {
        success: true,
        stats: {
          ...stats,
          totalSizeFormatted: this.formatFileSize(stats.totalSize)
        }
      };

    } catch (error) {
      throw new Error(`Failed to get folder stats: ${error.message}`);
    }
  }

  /**
   * Share folder (make public/generate share link)
   */
  static async shareFolder(folderId, userId, shareOptions, ipAddress, userAgent) {
    try {
      const { isPublic, expiresAt } = shareOptions;

      const updateData = {
        isPublic: isPublic || false,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      };

      const updatedFolder = await DocumentFolderRepository.updateFolder(folderId, userId, updateData);

      // Log sharing action
      await AccessLogRepository.logFolderAccess(
        folderId,
        userId,
        'share',
        ipAddress,
        userAgent,
        { 
          action: 'folder_shared',
          isPublic,
          expiresAt
        }
      );

      // Generate share URL if public
      let shareUrl = null;
      if (isPublic) {
        shareUrl = this.generateShareUrl(folderId);
      }

      return {
        success: true,
        folder: {
          id: updatedFolder.id,
          name: updatedFolder.name,
          isPublic: updatedFolder.isPublic,
          expiresAt: updatedFolder.expiresAt,
          shareUrl
        }
      };

    } catch (error) {
      throw new Error(`Failed to share folder: ${error.message}`);
    }
  }

  /**
   * Get recent folders
   */
  static async getRecentFolders(userId, limit = 5) {
    try {
      const folders = await DocumentFolderRepository.getRecentFolders(userId, limit);

      const foldersWithStats = folders.map(folder => ({
        id: folder.id,
        name: folder.name,
        folderType: folder.folderType,
        fileCount: folder.files ? folder.files.length : 0,
        updatedAt: folder.updatedAt
      }));

      return {
        success: true,
        folders: foldersWithStats
      };

    } catch (error) {
      throw new Error(`Failed to get recent folders: ${error.message}`);
    }
  }

  /**
   * Generate signed URL for file access
   */
  static generateSignedUrl(file, thumbnail = false) {
    const baseUrl = process.env.FILE_SERVER_URL;
    const secret = process.env.URL_SIGNING_SECRET;
    
    if (!baseUrl || !secret) {
      throw new Error('FILE_SERVER_URL and URL_SIGNING_SECRET must be set');
    }
    
    // Create expiration time (24 hours from now)
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000);
    
    // Create signature
    const token = crypto.createHash('sha256')
      .update(`${file.id}:${expiresAt}:${secret}`)
      .digest('hex');
    
    return `${baseUrl}/files/${file.id}?token=${token}&expires=${expiresAt}&thumbnail=${thumbnail}`;
  }

  /**
   * Generate share URL for folder
   */
  static generateShareUrl(folderId) {
    const baseUrl = process.env.FILE_SERVER_URL || process.env.APP_URL;
    return `${baseUrl}/shared/folders/${folderId}`;
  }

  /**
   * Validate folder access
   */
  static async validateFolderAccess(folderId, userId) {
    try {
      const hasAccess = await DocumentFolderRepository.canUserAccessFolder(folderId, userId);
      
      return {
        success: true,
        hasAccess
      };

    } catch (error) {
      throw new Error(`Failed to validate folder access: ${error.message}`);
    }
  }

  /**
   * Get folder activity logs
   */
  static async getFolderActivity(folderId, userId, options = {}) {
    try {
      const logs = await AccessLogRepository.getFolderAccessLogs(folderId, userId, options);

      return {
        success: true,
        activity: logs
      };

    } catch (error) {
      throw new Error(`Failed to get folder activity: ${error.message}`);
    }
  }

  /**
   * Search folders
   */
  static async searchFolders(userId, searchTerm, options = {}) {
    try {
      const result = await DocumentFolderRepository.getUserFolders(userId, {
        ...options,
        search: searchTerm
      });

      return {
        success: true,
        folders: result.folders,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      };

    } catch (error) {
      throw new Error(`Failed to search folders: ${error.message}`);
    }
  }

  /**
   * Format file size - Helper method
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = DocumentFolderService;