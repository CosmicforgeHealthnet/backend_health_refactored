// src/controllers/documentFileController.js
const DocumentFileService = require('../services/documentFileService');
const DocumentFolderMiddleware = require('../middlewares/documentFolderMiddleware');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class DocumentFileController {

  /**
   * Serve file with signed URL validation (NO AUTH REQUIRED)
   * GET /files/:fileId?token=...&expires=...&thumbnail=false
   */
  static async serveFile(req, res) {
    try {
      const { fileId } = req.params;
      const { token, expires, thumbnail } = req.query;

      // Validate required parameters
      if (!token || !expires) {
        return res.status(400).json({
          success: false,
          error: 'Missing token or expires parameter'
        });
      }

      // Validate signed URL
      const isValidToken = DocumentFileController.validateSignedUrl(fileId, token, expires);
      if (!isValidToken) {
        return res.status(403).json({
          success: false,
          error: 'Invalid or expired download link'
        });
      }

      // Get file metadata directly from repository (bypass user auth for signed URLs)
      const DocumentFileRepository = require('../repositories/documentFileRepository');
      const file = await DocumentFileRepository.getRepository().findOne({
        where: { id: fileId },
        relations: ['folder']
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      // Get file from disk
      const uploadDir = process.env.UPLOAD_DIRECTORY || 'uploads';
      const fullFilePath = path.join(uploadDir, file.filePath);

      // Check if file exists
      try {
        await fs.access(fullFilePath);
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'File not found on disk'
        });
      }

      // Read file
      let fileBuffer = await fs.readFile(fullFilePath);

      // Decrypt if encrypted
      if (file.isEncrypted && file.encryptionKey) {
        fileBuffer = DocumentFileService.decryptBuffer(fileBuffer, file.encryptionKey);
      }

      // Set appropriate headers
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Content-Disposition', `inline; filename="${file.originalFileName}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

      // Send file
      res.send(fileBuffer);

    } catch (error) {
      console.error('Error serving file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to serve file'
      });
    }
  }

  /**
   * Get file by ID
   * GET /api/files/:fileId
   */
  static async getFile(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await DocumentFileService.getFile(
        fileId,
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
      console.error('Error getting file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get file'
      });
    }
  }

  /**
 * Serve images publicly (no authentication required)
 * GET /api/documents/images/:imageId
 */
  static async servePublicImage(req, res) {
    try {
      let { imageId } = req.params;

      // Strip extension if present (e.g., .jpg, .png) to get the UUID
      if (imageId.includes('.')) {
        imageId = imageId.split('.')[0];
      }

      // Get image from database
      const DocumentFileRepository = require('../repositories/documentFileRepository');
      const image = await DocumentFileRepository.getRepository().findOne({
        where: { id: imageId }
      });

      if (!image) {
        return res.status(404).json({ error: 'Image not found' });
      }

      // Get upload directory from env or default
      const uploadDir = process.env.UPLOAD_DIRECTORY || 'uploads';

      // Construct full path - image.filePath already contains 'images/filename.ext'
      // If image.filePath is absolute, use it directly, otherwise join with uploadDir
      const imagePath = path.isAbsolute(image.filePath)
        ? image.filePath
        : path.join(uploadDir, 'images', image.filePath);

      try {
        let imageBuffer = await fs.readFile(imagePath);

        // Decrypt if encrypted
        if (image.isEncrypted && image.encryptionKey) {
          imageBuffer = DocumentFileService.decryptBuffer(imageBuffer, image.encryptionKey);
        }

        // Set headers for public caching
        res.setHeader('Content-Type', image.mimeType);
        res.setHeader('Content-Length', imageBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        res.setHeader('ETag', image.fileHash); // Use file hash as ETag for caching

        res.send(imageBuffer);

      } catch (fileError) {
        console.error('File read error:', fileError);
        res.status(404).json({ error: 'Image file not found on disk' });
      }

    } catch (error) {
      console.error('Error serving public image:', error);
      res.status(500).json({ error: 'Failed to serve image' });
    }
  }

  /**
 * Serve image thumbnail publicly (no authentication required)
 * GET /api/documents/images/:imageId/thumbnail
 */
  static async serveImageThumbnail(req, res) {
    try {
      let { imageId } = req.params;

      // Strip extension if present
      if (imageId.includes('.')) {
        imageId = imageId.split('.')[0];
      }

      // Get image from database
      const DocumentFileRepository = require('../repositories/documentFileRepository');
      const image = await DocumentFileRepository.getRepository().findOne({
        where: { id: imageId }
      });

      if (!image || !image.mimeType?.startsWith('image/')) {
        return res.status(404).json({ error: 'Image not found' });
      }

      // For now, serve the same image (you can add thumbnail generation later)
      // Get upload directory from env or default
      const uploadDir = process.env.UPLOAD_DIRECTORY || 'uploads';

      const imagePath = path.isAbsolute(image.filePath)
        ? image.filePath
        : path.join(uploadDir, 'images', image.filePath);

      try {
        let imageBuffer = await fs.readFile(imagePath);

        // Decrypt if encrypted
        if (image.isEncrypted && image.encryptionKey) {
          const DocumentFileService = require('../services/documentFileService');
          imageBuffer = DocumentFileService.decryptBuffer(imageBuffer, image.encryptionKey);
        }

        // Set headers for thumbnail (same as regular image for now)
        res.setHeader('Content-Type', image.mimeType);
        res.setHeader('Content-Length', imageBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('ETag', image.fileHash);

        res.send(imageBuffer);

      } catch (fileError) {
        res.status(404).json({ error: 'Image file not found on disk' });
      }

    } catch (error) {
      console.error('Error serving image thumbnail:', error);
      res.status(500).json({ error: 'Failed to serve image thumbnail' });
    }
  }

  /**
   * Upload images and return permanent URLs
   * POST /api/documents/images/upload
   */
  static async uploadImages(req, res) {
    try {
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      if (!req.processedImages || req.processedImages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No images were processed'
        });
      }

      // Get or create "Images" folder
      const DocumentFolderRepository = require('../repositories/documentFolderRepository');
      let imageFolder;

      try {
        // Try to find existing Images folder
        const existingFolder = await DocumentFolderRepository.getUserFolders(userId, {
          folderType: 'images',
          limit: 1
        });

        if (existingFolder.folders.length > 0) {
          imageFolder = existingFolder.folders[0];
        } else {
          // Create new Images folder
          imageFolder = await DocumentFolderRepository.createFolder({
            name: 'Images',
            description: 'Uploaded images',
            folderType: 'images',
            owner: { id: userId },
            encryptionKey: crypto.randomBytes(32).toString('hex'),
            status: 'active'
          });
        }
      } catch (folderError) {
        console.error('Error handling image folder:', folderError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create or access images folder'
        });
      }

      // Save image records to database
      const DocumentFileRepository = require('../repositories/documentFileRepository');
      const savedImages = [];

      for (const processedImage of req.processedImages) {
        try {
          const imageData = {
            originalFileName: processedImage.originalName,
            storedFileName: processedImage.fileName,
            filePath: processedImage.filePath,
            fileSize: processedImage.size,
            mimeType: processedImage.mimeType,
            fileHash: crypto.createHash('sha256').update(processedImage.originalName + Date.now()).digest('hex'),
            documentType: 'image',
            folder: { id: imageFolder.id },
            uploader: { id: userId },
            status: 'ready',
            isEncrypted: false, // Images are typically not encrypted for public access
            securityLevel: 'public',
            metadata: {
              uploadSession: req.sessionID || null,
              originalPath: processedImage.filePath,
              processingTime: Date.now() - (req.uploadStartTime || Date.now()),
              isPublicImage: true
            }
          };

          const savedImage = await DocumentFileRepository.createFile(imageData);
          savedImages.push(savedImage);

          // Log image upload
          const AccessLogRepository = require('../repositories/accessLogRepository');
          await AccessLogRepository.logFileAccess(
            savedImage.id,
            userId,
            'upload',
            ipAddress,
            userAgent,
            null,
            {
              action: 'image_uploaded',
              documentType: 'image',
              isPublicAccess: true
            }
          );

        } catch (saveError) {
          console.error('Error saving image:', saveError);
          // Continue with other images even if one fails
        }
      }

      if (savedImages.length === 0) {
        return res.status(500).json({
          success: false,
          error: 'Failed to save any images to database'
        });
      }

      // Generate permanent URLs for images
      const baseUrl = process.env.APP_URL || process.env.FILE_SERVER_URL || 'http://localhost:3000';

      const imageUrls = savedImages.map(image => ({
        id: image.id,
        originalName: image.originalFileName,
        fileName: image.storedFileName,
        fileSize: image.fileSize,
        mimeType: image.mimeType,
        documentType: image.documentType,
        // Permanent URL without tokens - publicly accessible via static serve
        // file.storedFileName includes extension
        url: `${baseUrl}/images/${image.storedFileName}`,
        // Thumbnail URL (if you implement thumbnails)
        thumbnailUrl: `${baseUrl}/documents/images/${image.id}/thumbnail`,
        // Optional: Direct download URL (still permanent)
        downloadUrl: `${baseUrl}/documents/files/${image.id}/download`,
        // Optional: Signed URL for secure access (if needed later)
        secureUrl: DocumentFolderMiddleware.generateSignedUrl(image),
        // Upload metadata
        uploadedAt: image.createdAt,
        folderId: imageFolder.id,
        folderName: imageFolder.name
      }));

      // Update folder hash
      try {
        await DocumentFolderMiddleware.updateFolderHash(imageFolder.id);
      } catch (hashError) {
        console.error('Error updating folder hash:', hashError);
        // Don't fail the request for this
      }

      return res.status(201).json({
        success: true,
        message: `${imageUrls.length} images uploaded successfully`,
        count: imageUrls.length,
        images: imageUrls,
        folder: {
          id: imageFolder.id,
          name: imageFolder.name,
          type: imageFolder.folderType
        }
      });

    } catch (error) {
      console.error('Error uploading images:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload images',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Download file
   * GET /api/files/:fileId/download
   */
  static async downloadFile(req, res) {
    try {
      const { fileId } = req.params;
      const { token, expires, thumbnail } = req.query;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Validate signed URL if token is provided
      if (token && expires) {
        const isValidToken = DocumentFileController.validateSignedUrl(fileId, token, expires);
        if (!isValidToken) {
          return res.status(403).json({
            success: false,
            error: 'Invalid or expired download link'
          });
        }
      }

      const result = await DocumentFileService.downloadFile(
        fileId,
        userId,
        ipAddress,
        userAgent
      );

      if (result.success) {
        const { file } = result;

        // Set appropriate headers
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Length', file.fileSize);
        res.setHeader('Content-Disposition', `attachment; filename="${file.originalFileName}"`);
        res.setHeader('Cache-Control', 'private, no-cache');

        // Send file buffer
        res.send(file.buffer);
      } else {
        res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download file'
      });
    }
  }

  /**
   * Update file metadata
   * PUT /api/files/:fileId
   */
  static async updateFile(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const { documentType, metadata, securityLevel } = req.body;

      const updateData = {};
      if (documentType !== undefined) updateData.documentType = documentType;
      if (metadata !== undefined) updateData.metadata = metadata;
      if (securityLevel !== undefined) updateData.securityLevel = securityLevel;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No update data provided'
        });
      }

      const result = await DocumentFileService.updateFile(
        fileId,
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
      console.error('Error updating file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update file'
      });
    }
  }

  /**
   * Delete file
   * DELETE /api/files/:fileId
   */
  static async deleteFile(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await DocumentFileService.deleteFile(
        fileId,
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
      console.error('Error deleting file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete file'
      });
    }
  }

  /**
   * Search files across all folders
   * GET /api/files/search
   */
  static async searchFiles(req, res) {
    try {
      const userId = req.user.sub;
      const {
        q: searchTerm,
        page = 1,
        limit = 20,
        documentType,
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
        documentType,
        folderType
      };

      const result = await DocumentFileService.searchFiles(
        userId,
        searchTerm.trim(),
        options
      );

      res.json(result);

    } catch (error) {
      console.error('Error searching files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search files'
      });
    }
  }

  /**
   * Get files by document type
   * GET /api/files/type/:documentType
   */
  static async getFilesByDocumentType(req, res) {
    try {
      const { documentType } = req.params;
      const userId = req.user.sub;
      const { limit = 20 } = req.query;

      const result = await DocumentFileService.getFilesByDocumentType(
        userId,
        documentType,
        parseInt(limit)
      );

      res.json(result);

    } catch (error) {
      console.error('Error getting files by document type:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get files by document type'
      });
    }
  }

  /**
   * Get recent files
   * GET /api/files/recent
   */
  static async getRecentFiles(req, res) {
    try {
      const userId = req.user.sub;
      const { limit = 10 } = req.query;

      const result = await DocumentFileService.getRecentFiles(
        userId,
        parseInt(limit)
      );

      res.json(result);

    } catch (error) {
      console.error('Error getting recent files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recent files'
      });
    }
  }

  /**
   * Get user file statistics
   * GET /api/files/stats
   */
  static async getUserFileStats(req, res) {
    try {
      const userId = req.user.sub;

      const result = await DocumentFileService.getUserFileStats(userId);

      res.json(result);

    } catch (error) {
      console.error('Error getting user file stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get file statistics'
      });
    }
  }

  /**
   * Bulk delete files
   * DELETE /api/files/bulk
   */
  static async bulkDeleteFiles(req, res) {
    try {
      const { fileIds } = req.body;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'File IDs array is required'
        });
      }

      // Limit bulk operations
      if (fileIds.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete more than 100 files at once'
        });
      }

      const result = await DocumentFileService.bulkDeleteFiles(
        fileIds,
        userId,
        ipAddress,
        userAgent
      );

      res.json(result);

    } catch (error) {
      console.error('Error bulk deleting files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk delete files'
      });
    }
  }

  /**
   * Get files in folder
   * GET /api/folders/:folderId/files
   */
  static async getFolderFiles(req, res) {
    try {
      const { folderId } = req.params;
      const userId = req.user.sub;
      const {
        page = 1,
        limit = 50,
        documentType,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        documentType,
        sortBy,
        sortOrder
      };

      // This would be implemented in DocumentFileService
      // For now, we'll use the existing searchFiles with folder filter
      const result = await DocumentFileService.searchFiles(userId, '', {
        ...options,
        folderId
      });

      res.json(result);

    } catch (error) {
      console.error('Error getting folder files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get folder files'
      });
    }
  }

  /**
   * Stream file (for large files)
   * GET /api/files/:fileId/stream
   */
  static async streamFile(req, res) {
    try {
      const { fileId } = req.params;
      const { token, expires } = req.query;
      const userId = req.user.sub;

      // Validate signed URL if token is provided
      if (token && expires) {
        const isValidToken = DocumentFileController.validateSignedUrl(fileId, token, expires);
        if (!isValidToken) {
          return res.status(403).json({
            success: false,
            error: 'Invalid or expired stream link'
          });
        }
      }

      // This would implement streaming for large files
      // For now, redirect to download
      res.redirect(`/api/files/${fileId}/download?token=${token}&expires=${expires}`);

    } catch (error) {
      console.error('Error streaming file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stream file'
      });
    }
  }

  /**
   * Get file preview/thumbnail
   * GET /api/files/:fileId/preview
   */
  static async getFilePreview(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.sub;

      // This would generate/serve file thumbnails
      // For now, return file info
      const result = await DocumentFileService.getFile(fileId, userId, req.ip, req.get('User-Agent'));

      if (result.success && result.file.thumbnailUrl) {
        res.redirect(result.file.thumbnailUrl);
      } else {
        res.status(404).json({
          success: false,
          error: 'Preview not available'
        });
      }

    } catch (error) {
      console.error('Error getting file preview:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get file preview'
      });
    }
  }

  // Helper methods

  /**
   * Validate signed URL token
   */
  static validateSignedUrl(fileId, token, expires) {
    try {
      const expiresAt = parseInt(expires);

      // Check if URL has expired
      if (Date.now() > expiresAt) {
        return false;
      }

      // Regenerate token and compare
      const secret = process.env.URL_SIGNING_SECRET;
      const expectedToken = crypto.createHash('sha256')
        .update(`${fileId}:${expiresAt}:${secret}`)
        .digest('hex');

      return token === expectedToken;

    } catch (error) {
      return false;
    }
  }
}

module.exports = DocumentFileController;