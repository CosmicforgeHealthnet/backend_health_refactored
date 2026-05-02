// src/middlewares/documentFolderMiddleware.js
const AppDataSource = require('../../../config/database');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Document Folder Middleware
 * Works alongside your existing documentUploadMiddleware
 * Handles folder creation and database persistence
 */
class DocumentFolderMiddleware {


  /**
   * Create or get folder before file processing
   * This runs BEFORE your existing upload middleware
   */
  static async handleFolderCreation(req, res, next) {
    try {
      // Check if database is initialized
      if (!AppDataSource.isInitialized) {
        throw new Error('Database not initialized');
      }

      const {
        folderId,
        folderName,
        folderDescription,
        folderType,
        metadata,
        createNewFolder
      } = req.body;

      const folderRepo = AppDataSource.getRepository('DocumentFolder');
      let folder;

      // Validate user exists and get user ID
      const userId = req.user?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (folderId && !createNewFolder) {
        // Use existing folder
        folder = await folderRepo.findOne({
          where: {
            id: folderId,
            owner: { id: userId }, // Ensure ownership
            status: 'active'
          }
        });

        if (!folder) {
          return res.status(404).json({ error: 'Folder not found or access denied' });
        }
      } else {
        // Create new folder
        const folderData = {
          name: folderName || `Folder ${new Date().toISOString()}`,
          description: folderDescription || null,
          folderType: folderType || 'other',
          metadata: metadata ? (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : null,
          owner: { id: userId }, // Explicitly set the owner relationship
          encryptionKey: crypto.randomBytes(32).toString('hex'), // Folder-level encryption
          status: 'active'
        };

        folder = folderRepo.create(folderData);
        folder = await folderRepo.save(folder);

        // Log folder creation
        await DocumentFolderMiddleware.logFolderAccess(
          folder.id,
          userId,
          'upload',
          req.ip,
          req.get('User-Agent')
        );
      }

      // Attach folder to request for next middleware
      req.documentFolder = folder;
      next();

    } catch (error) {
      console.error('Error handling folder creation:', error);
      res.status(500).json({ error: 'Failed to handle folder creation' });
    }
  }

  /**
   * ENHANCED: Save processed files to database with FHIR data
   */
  static async saveFilesToDatabase(req, res, next) {
    try {
      if (!req.processedFiles || !req.documentFolder) {
        return res.status(400).json({ error: 'No processed files or folder found' });
      }

      if (!AppDataSource.isInitialized) {
        throw new Error('Database not initialized');
      }

      const userId = req.user?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const fileRepo = AppDataSource.getRepository('DocumentFile');
      const savedFiles = [];

      for (let i = 0; i < req.processedFiles.length; i++) {
        const processedFile = req.processedFiles[i];

        const documentType = req.body[`documentType_${i}`] ||
          req.body.documentType ||
          processedFile.documentType ||
          'other';

        // ===== ENHANCED FILE DATA WITH FHIR FIELDS =====
        const fileData = {
          originalFileName: processedFile.originalFileName,
          storedFileName: processedFile.storedFileName,
          filePath: processedFile.filePath,
          fileSize: processedFile.fileSize,
          mimeType: processedFile.mimeType,
          fileHash: processedFile.fileHash,
          encryptionKey: processedFile.encryptionKey,
          documentType: documentType,
          folder: req.documentFolder,
          uploader: { id: userId },
          status: 'ready',
          isEncrypted: !!processedFile.encryptionKey,
          securityLevel: DocumentFolderMiddleware.determineSecurityLevel(processedFile.mimeType, documentType),

          // ===== NEW: FHIR FIELDS =====
          fhirResourceType: processedFile.fhirResourceType,
          patientIdentifier: processedFile.patientIdentifier,
          fhirSecurityLabels: processedFile.fhirSecurityLabels,
          fhirVersion: processedFile.fhirVersion,
          fhirSensitivityLevel: processedFile.fhirSensitivityLevel,
          fhirResourceId: processedFile.fhirResourceId,

          metadata: {
            ...processedFile.enhancedMetadata,
            uploadSession: req.sessionID || null,
            originalPath: processedFile.filePath,
            processingTime: Date.now() - (req.uploadStartTime || Date.now())
          }
        };

        const file = fileRepo.create(fileData);
        const savedFile = await fileRepo.save(file);
        savedFiles.push(savedFile);

        // Enhanced logging with FHIR context
        await DocumentFolderMiddleware.logFileAccess(
          savedFile.id,
          userId,
          'upload',
          req.ip,
          req.get('User-Agent'),
          null,
          {
            action: 'file_uploaded_with_fhir',
            isFHIRResource: !!processedFile.fhirResourceType,
            fhirResourceType: processedFile.fhirResourceType,
            patientIdentifier: processedFile.patientIdentifier
          }
        );
      }

      await DocumentFolderMiddleware.updateFolderHash(req.documentFolder.id);

      req.savedFiles = savedFiles;
      req.folderInfo = {
        id: req.documentFolder.id,
        name: req.documentFolder.name,
        type: req.documentFolder.folderType,
        fileCount: savedFiles.length,
        fhirFileCount: savedFiles.filter(f => f.fhirResourceType).length
      };

      next();

    } catch (error) {
      console.error('Error saving files to database with FHIR enhancement:', error);
      res.status(500).json({ error: 'Failed to save files to database' });
    }
  }


  /**
   * Generate secure URLs for file access
   */
  static async generateFileUrls(req, res, next) {
    try {
      if (!req.savedFiles) {
        return next();
      }

      const fileUrls = req.savedFiles.map(file => ({
        fileId: file.id,
        originalName: file.originalFileName,
        documentType: file.documentType,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        // Generate signed URL (implement your URL signing logic)
        url: DocumentFolderMiddleware.generateSignedUrl(file),
        thumbnailUrl: file.thumbnailPath ? DocumentFolderMiddleware.generateSignedUrl(file, true) : null
      }));

      req.fileUrls = fileUrls;
      next();

    } catch (error) {
      console.error('Error generating file URLs:', error);
      res.status(500).json({ error: 'Failed to generate file URLs' });
    }
  }

  /**
   * Determine security level based on file type and document type
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
   * Generate signed URL for file access
   */
  /**
   * Generate URL for file access (permanent for images, signed for documents)
   */
  static generateSignedUrl(file, thumbnail = false) {
    const baseUrl = process.env.FILE_SERVER_URL || process.env.APP_URL;

    if (!baseUrl) {
      throw new Error('FILE_SERVER_URL or APP_URL must be set in environment variables');
    }

    // Check if this is an image file
    const isImage = file.documentType === 'image' ||
      file.mimeType?.startsWith('image/') ||
      file.documentType?.startsWith('fhir_') && file.mimeType?.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'].some(ext =>
        file.originalFileName?.toLowerCase().endsWith(`.${ext}`)
      );

    // For images, return simple permanent URLs without tokens
    if (isImage) {
      if (thumbnail) {
        return `${baseUrl}/api/documents/images/${file.id}/thumbnail`;
      }
      return `${baseUrl}/api/documents/images/${file.id}`;
    }

    // For other documents, use signed URLs with tokens for security
    const secret = process.env.URL_SIGNING_SECRET;
    if (!secret) {
      // No signing secret — embed a short-lived JWT so the view route can still auth the request
      console.warn('URL_SIGNING_SECRET is not set — using JWT-embedded URL. Set this env var in production.');
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret) {
        const viewToken = jwt.sign({ fileId: file.id, purpose: 'view' }, jwtSecret, { expiresIn: '24h' });
        if (thumbnail) {
          return `${baseUrl}/api/documents/files/${file.id}/thumbnail?token=${viewToken}`;
        }
        return `${baseUrl}/api/documents/files/${file.id}?token=${viewToken}`;
      }
      // Last resort — no secrets at all, serve bare URL
      if (thumbnail) return `${baseUrl}/api/documents/files/${file.id}/thumbnail`;
      return `${baseUrl}/api/documents/files/${file.id}`;
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
   * Update folder hash when files are added/removed
   */
  static async updateFolderHash(folderId) {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }

    const folderRepo = AppDataSource.getRepository('DocumentFolder');
    const fileRepo = AppDataSource.getRepository('DocumentFile');

    const files = await fileRepo.find({
      where: { folder: { id: folderId } },
      select: ['fileHash']
    });

    const combinedHash = crypto.createHash('sha256')
      .update(files.map(f => f.fileHash).sort().join(''))
      .digest('hex');

    await folderRepo.update(folderId, {
      folderHash: combinedHash,
      updatedAt: new Date()
    });
  }

  /**
   * Log folder access
   */
  static async logFolderAccess(folderId, userId, accessType, ipAddress, userAgent) {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }

    const logRepo = AppDataSource.getRepository('FolderAccessLog');
    const log = logRepo.create({
      folder: { id: folderId },
      user: { id: userId },
      accessType,
      ipAddress,
      userAgent,
      metadata: { timestamp: Date.now() }
    });
    await logRepo.save(log);
  }

  /**
   * Log file access
   */
  static async logFileAccess(fileId, userId, accessType, ipAddress, userAgent, duration = null) {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }

    const logRepo = AppDataSource.getRepository('FileAccessLog');
    const log = logRepo.create({
      file: { id: fileId },
      user: { id: userId },
      accessType,
      ipAddress,
      userAgent,
      downloadDuration: duration,
      metadata: { timestamp: Date.now() }
    });
    await logRepo.save(log);
  }

  /**
   * Optional folder creation - allows requests with no files
   */
  static async handleOptionalFolderCreation(req, res, next) {
    try {
      if (!req.processedFiles || req.processedFiles.length === 0) {
        // No files to process - skip folder creation
        return next();
      }

      // If files are present, delegate to the existing handleFolderCreation method
      // Set default values if not provided
      if (!req.body.folderName) {
        req.body.folderName = `Upload ${new Date().toISOString()}`;
      }
      if (!req.body.folderDescription) {
        req.body.folderDescription = 'Auto-created folder for file upload';
      }
      if (!req.body.folderType) {
        req.body.folderType = 'other';
      }

      // Force creation of a new folder
      req.body.createNewFolder = true;

      // Delegate to the existing handleFolderCreation method
      return DocumentFolderMiddleware.handleFolderCreation(req, res, next);

    } catch (error) {
      console.error('Optional folder creation error:', error);
      return res.status(500).json({ error: 'Failed to handle folder creation' });
    }
  }

  /**
   * Optional file saving - allows requests with no files
   */
  static async saveOptionalFilesToDatabase(req, res, next) {
    try {
      if (!req.processedFiles || req.processedFiles.length === 0) {
        // No files to save - continue
        return next();
      }

      // Check if documentFolder exists, if not, we can't save files
      if (!req.documentFolder) {
        console.error('No document folder found for file saving');
        return res.status(500).json({ error: 'Failed to save files to database - no folder available' });
      }

      // If files are present and folder exists, use existing save logic
      return DocumentFolderMiddleware.saveFilesToDatabase(req, res, next);
    } catch (error) {
      console.error('Optional file saving error:', error);
      return res.status(500).json({ error: 'Failed to save files to database' });
    }
  }
}

module.exports = DocumentFolderMiddleware;