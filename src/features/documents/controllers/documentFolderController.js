// src/controllers/documentFolderController.js
const DocumentFolderService = require('../services/documentFolderService');
const DocumentFileService = require('../services/documentFileService');
const AnalyticsService = require('../services/analyticsService');

class DocumentFolderController {

  /**
   * Create a new folder
   * POST /api/folders
   */
  static async createFolder(req, res) {
    console.log('req.user:', req.user); // DEBUG: Check if user exists
    console.log('req.body:', req.body); // DEBUG: Check what's being sent
    try {
      const { name, description, folderType, metadata, tags } = req.body;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Validation
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Folder name is required'
        });
      }

      const folderData = {
        name: name.trim(),
        description: description?.trim(),
        folderType: folderType || 'other',
        metadata: metadata || null,
        tags: tags || []
      };

      const result = await DocumentFolderService.createFolder(
        userId,
        folderData,
        ipAddress,
        userAgent
      );

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error creating folder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create folder'
      });
    }
  }

  /**
   * Get folder by ID
   * GET /api/folders/:folderId
   */
  static async getFolder(req, res) {
    try {
      const { folderId } = req.params;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await DocumentFolderService.getFolder(
        folderId,
        userId,
        ipAddress,
        userAgent
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error getting folder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get folder'
      });
    }
  }

  /**
   * Get user's folders with pagination
   * GET /api/folders
   */
  static async getUserFolders(req, res) {
    try {
      const userId = req.user.sub;
      const {
        page = 1,
        limit = 20,
        folderType,
        search,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        folderType,
        search,
        sortBy,
        sortOrder
      };

      const result = await DocumentFolderService.getUserFolders(userId, options);

      res.json(result);

    } catch (error) {
      console.error('Error getting user folders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get folders'
      });
    }
  }

  /**
   * Update folder
   * PUT /api/folders/:folderId
   */
  static async updateFolder(req, res) {
    try {
      const { folderId } = req.params;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      const { name, description, folderType, metadata, tags } = req.body;

      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim();
      if (folderType !== undefined) updateData.folderType = folderType;
      if (metadata !== undefined) updateData.metadata = metadata;
      if (tags !== undefined) updateData.tags = tags;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No update data provided'
        });
      }

      const result = await DocumentFolderService.updateFolder(
        folderId,
        userId,
        updateData,
        ipAddress,
        userAgent
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error updating folder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update folder'
      });
    }
  }

  /**
   * Delete folder
   * DELETE /api/folders/:folderId
   */
  static async deleteFolder(req, res) {
    try {
      const { folderId } = req.params;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await DocumentFolderService.deleteFolder(
        folderId,
        userId,
        ipAddress,
        userAgent
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error deleting folder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete folder'
      });
    }
  }

  /**
   * Get folder statistics
   * GET /api/folders/:folderId/stats
   */
  static async getFolderStats(req, res) {
    try {
      const { folderId } = req.params;
      const userId = req.user.sub;

      const result = await DocumentFolderService.getFolderStats(folderId, userId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error getting folder stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get folder statistics'
      });
    }
  }

  /**
   * Share folder
   * POST /api/folders/:folderId/share
   */
  static async shareFolder(req, res) {
    try {
      const { folderId } = req.params;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      const { isPublic = true, expiresAt } = req.body;

      const shareOptions = {
        isPublic,
        expiresAt
      };

      const result = await DocumentFolderService.shareFolder(
        folderId,
        userId,
        shareOptions,
        ipAddress,
        userAgent
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error sharing folder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to share folder'
      });
    }
  }

  /**
   * Get recent folders
   * GET /api/folders/recent
   */
  static async getRecentFolders(req, res) {
    try {
      const userId = req.user.sub;
      const { limit = 5 } = req.query;

      const result = await DocumentFolderService.getRecentFolders(
        userId,
        parseInt(limit)
      );

      res.json(result);

    } catch (error) {
      console.error('Error getting recent folders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recent folders'
      });
    }
  }

  /**
   * Search folders
   * GET /api/folders/search
   */
  static async searchFolders(req, res) {
    try {
      const userId = req.user.sub;
      const { 
        q: searchTerm, 
        page = 1, 
        limit = 20,
        folderType 
      } = req.query;

      if (!searchTerm || searchTerm.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Search term is required'
        });
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        folderType
      };

      const result = await DocumentFolderService.searchFolders(
        userId,
        searchTerm.trim(),
        options
      );

      res.json(result);

    } catch (error) {
      console.error('Error searching folders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search folders'
      });
    }
  }

  /**
   * Get folder activity logs
   * GET /api/folders/:folderId/activity
   */
  static async getFolderActivity(req, res) {
    try {
      const { folderId } = req.params;
      const userId = req.user.sub;
      const {
        page = 1,
        limit = 50,
        accessType,
        startDate,
        endDate
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        accessType,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      };

      const result = await DocumentFolderService.getFolderActivity(
        folderId,
        userId,
        options
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error getting folder activity:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get folder activity'
      });
    }
  }

  /**
   * Upload files to folder
   * POST /api/folders/:folderId/upload
   */
  static async uploadToFolder(req, res) {
    try {
      const { folderId } = req.params;
      const userId = req.user.sub;
      console.log('from the upload to folder userId:', userId);
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Check if files were processed by the upload middleware
      if (!req.processedFiles || req.processedFiles.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files were uploaded or processed'
        });
      }

      const result = await DocumentFileService.processUploadedFiles(
        userId,
        folderId,
        req.processedFiles,
        ipAddress,
        userAgent
      );

      if (result.success) {
        res.status(201).json({
          success: true,
          message: `${result.files.length} files uploaded successfully`,
          files: result.files,
          folderId
        });
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error uploading files to folder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload files to folder'
      });
    }
  }

  /**
   * Get folders by type
   * GET /api/folders/type/:folderType
   */
  static async getFoldersByType(req, res) {
    try {
      const { folderType } = req.params;
      const userId = req.user.sub;

      const result = await DocumentFolderService.getUserFolders(userId, {
        folderType,
        limit: 100
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting folders by type:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get folders by type'
      });
    }
  }
}

module.exports = DocumentFolderController;