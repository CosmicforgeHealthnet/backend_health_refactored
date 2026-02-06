// ===== 1. ENHANCED DOCUMENT UPLOAD MIDDLEWARE (FIXED) =====
// src/middlewares/documentUploadMiddleware.js (MODIFIED)

const multer = require('multer');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs').promises;
const FHIRResourceDetectionService = require('../services/fhirResourceDetectionService');

const config = require('../../../config/verificationConfig');

// Environment-based upload paths
const getUploadPath = (subPath = '') => {
  // Use UPLOAD_DIRECTORY env var which is correctly set to /app/uploads
  const basePath = process.env.UPLOAD_DIRECTORY ||
    (process.env.NODE_ENV === 'production'
      ? '/app/uploads'  // ✅ Container path
      : path.join(__dirname, '../../../../uploads'));

  return subPath ? path.join(basePath, subPath) : basePath;
};

// Configure multer storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  if (!config.FILE_LIMITS.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type. Allowed types: ${config.FILE_LIMITS.ALLOWED_MIME_TYPES.join(', ')}`), false);
  }
  cb(null, true);
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.FILE_LIMITS.MAX_FILE_SIZE,
    files: config.FILE_LIMITS.MAX_FILES_PER_REQUEST
  }
});

class DocumentUploadMiddleware {

  static uploadDocuments() {
    // Allow any field name for better compatibility
    return upload.any();
  }

  /**
   * ENHANCED: Process uploaded files with FHIR detection and better naming (COMPLETE FUNCTION)
   */
  static async processUploadedFiles(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const processedFiles = [];

      // Create better document categories
      const documentCategories = {
        'medical_license': 'Medical License',
        'medical_degree': 'Medical Degree',
        'government_id': 'Government ID',
        'proof_of_practice': 'Proof of Practice',
        'board_certification': 'Board Certification',
        'good_standing_certificate': 'Good Standing Certificate',
        'postgraduate_certificate': 'Postgraduate Certificate',
        'verification_document': 'Verification Document',
        'passport': 'Passport',
        'national_id': 'National ID',
        'medical_registration': 'Medical Registration',
        'specialty_certificate': 'Specialty Certificate',
        'fellowship_certificate': 'Fellowship Certificate',
        'cv_resume': 'CV/Resume',
        'recommendation_letter': 'Recommendation Letter',
        'work_permit': 'Work Permit',
        'other': 'Other Document'
      };

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        // Validate file
        const validation = DocumentUploadMiddleware.validateFile(file);
        if (!validation.isValid) {
          return res.status(400).json({ error: validation.error });
        }

        // Generate file hash
        const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

        // Generate unique filename
        const fileExtension = path.extname(file.originalname);
        const storedFileName = `${crypto.randomUUID()}${fileExtension}`;

        // Create file path
        const uploadDate = new Date();
        const year = uploadDate.getFullYear();
        const month = String(uploadDate.getMonth() + 1).padStart(2, '0');
        const day = String(uploadDate.getDate()).padStart(2, '0');

        const relativePath = `images`;
        const fullPath = getUploadPath(relativePath);

        // Ensure directory exists
        await fs.mkdir(fullPath, { recursive: true });

        // ===== ENHANCED DOCUMENT NAMING AND CATEGORIZATION =====

        // Get custom document name and type from request
        const customDocumentName = req.body[`documentName_${i}`] || req.body.documentName || null;
        const customFolderName = req.body.folderName || 'Verification Documents';

        // Determine document type with better categorization
        let documentType = req.body[`documentType_${i}`] || req.body.documentType || 'verification_document';

        // If no document type specified, try to infer from filename
        if (documentType === 'verification_document' || documentType === 'other') {
          const filename = file.originalname.toLowerCase();
          if (filename.includes('license') || filename.includes('licence')) {
            documentType = 'medical_license';
          } else if (filename.includes('degree') || filename.includes('diploma')) {
            documentType = 'medical_degree';
          } else if (filename.includes('passport')) {
            documentType = 'passport';
          } else if (filename.includes('id') || filename.includes('national')) {
            documentType = 'government_id';
          } else if (filename.includes('certificate') || filename.includes('cert')) {
            documentType = 'board_certification';
          } else if (filename.includes('cv') || filename.includes('resume')) {
            documentType = 'cv_resume';
          }
        }

        // ===== FHIR ANALYSIS =====
        console.log(`Analyzing file ${i + 1} for FHIR content: ${file.originalname}`);
        const fhirAnalysis = await FHIRResourceDetectionService.analyzeDocument(
          file.buffer,
          file.mimetype,
          file.originalname
        );

        console.log(`FHIR Analysis Result:`, {
          isFHIR: fhirAnalysis.isFHIRResource,
          resourceType: fhirAnalysis.resourceType,
          sensitivity: fhirAnalysis.sensitivityLevel,
          patientId: fhirAnalysis.patientIdentifier
        });

        // Override document type for FHIR resources with better naming
        if (fhirAnalysis.isFHIRResource) {
          documentType = `fhir_${fhirAnalysis.resourceType.toLowerCase()}`;
        }

        // Determine encryption strategy based on FHIR analysis
        let encryptionKey = null;
        let shouldEncrypt = DocumentUploadMiddleware.shouldEncryptFile(file);

        // Enhanced encryption logic for FHIR resources
        if (fhirAnalysis.isFHIRResource) {
          if (fhirAnalysis.sensitivityLevel === 'very_high' || fhirAnalysis.sensitivityLevel === 'high') {
            shouldEncrypt = true;
            // Generate FHIR-specific encryption key
            encryptionKey = FHIRResourceDetectionService.generateFHIREncryptionKey(
              fhirAnalysis.sensitivityLevel,
              fhirAnalysis.resourceType,
              fhirAnalysis.patientIdentifier
            );
          }
        } else if (shouldEncrypt) {
          // Regular encryption for non-FHIR files
          encryptionKey = crypto.randomBytes(32).toString('hex');
        }

        // Process file buffer
        let processedBuffer = file.buffer;
        if (shouldEncrypt && encryptionKey) {
          processedBuffer = DocumentUploadMiddleware.encryptBuffer(file.buffer, encryptionKey);
        }

        // Save file
        const filePath = path.join(fullPath, storedFileName);
        await fs.writeFile(filePath, processedBuffer);

        // Generate display name with smart fallbacks
        let displayName;
        if (customDocumentName) {
          displayName = customDocumentName;
        } else if (documentCategories[documentType]) {
          displayName = documentCategories[documentType];
        } else {
          displayName = file.originalname;
        }

        // Create a readable document description
        const documentDescription = customDocumentName ?
          `${documentCategories[documentType] || 'Document'}: ${customDocumentName}` :
          documentCategories[documentType] || file.originalname;

        // Enhanced processed file data with custom naming
        const processedFile = {
          originalFileName: file.originalname,
          customDocumentName: customDocumentName, // NEW: Allow custom naming
          displayName: displayName, // NEW: Display name
          documentDescription: documentDescription, // NEW: Full description
          folderName: customFolderName, // NEW: Custom folder name
          storedFileName: storedFileName,
          filePath: storedFileName,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileHash,
          encryptionKey,
          documentType,
          documentCategory: documentCategories[documentType] || 'Other', // NEW: Human readable category

          // ===== FHIR DATA =====
          fhirData: fhirAnalysis,
          fhirResourceType: fhirAnalysis.isFHIRResource ? fhirAnalysis.resourceType : null,
          patientIdentifier: fhirAnalysis.patientIdentifier,
          fhirSecurityLabels: fhirAnalysis.securityLabels,
          fhirVersion: fhirAnalysis.fhirVersion,
          fhirSensitivityLevel: fhirAnalysis.sensitivityLevel,
          fhirResourceId: fhirAnalysis.metadata?.fhirId || null,

          // Enhanced metadata
          enhancedMetadata: {
            ...fhirAnalysis.metadata,
            uploadSession: req.sessionID || null,
            originalPath: path.join(relativePath, storedFileName),
            processingTime: Date.now() - (req.uploadStartTime || Date.now()),
            isFHIRCompliant: fhirAnalysis.isFHIRResource,
            analysisErrors: fhirAnalysis.errors,
            documentInferred: !req.body[`documentType_${i}`] && !req.body.documentType, // Track if type was inferred
            hasCustomName: !!customDocumentName,
            uploadedToFolder: customFolderName,
            securityLevel: shouldEncrypt ? 'encrypted' : 'standard'
          }
        };

        processedFiles.push(processedFile);
      }

      // Attach processed files to request
      req.processedFiles = processedFiles;

      console.log(`Processed ${processedFiles.length} files with enhanced naming and FHIR analysis`);
      console.log('Processing summary:', processedFiles.map(f => ({
        original: f.originalFileName,
        display: f.displayName,
        type: f.documentType,
        category: f.documentCategory,
        hasCustomName: f.enhancedMetadata.hasCustomName,
        folder: f.folderName
      })));

      next();

    } catch (error) {
      console.error('Error processing uploaded files with enhanced naming:', error);
      res.status(500).json({ error: 'Failed to process uploaded files' });
    }
  }

  /**
   * Validate individual file
   */
  static validateFile(file) {
    // Check file size
    if (file.size > config.FILE_LIMITS.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File ${file.originalname} exceeds maximum size of ${config.FILE_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB`
      };
    }

    // Check file extension
    const allowedExtensions = config.FILE_LIMITS.ALLOWED_EXTENSIONS;
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      return {
        isValid: false,
        error: `File ${file.originalname} has invalid extension. Allowed: ${allowedExtensions.join(', ')}`
      };
    }

    // Check for suspicious content (basic security)
    if (DocumentUploadMiddleware.containsSuspiciousContent(file)) {
      return {
        isValid: false,
        error: `File ${file.originalname} contains suspicious content`
      };
    }

    return { isValid: true };
  }

  /**
   * Check if file should be encrypted
   */
  static shouldEncryptFile(file) {
    // Encrypt sensitive document types
    const sensitiveTypes = ['application/pdf'];
    return sensitiveTypes.includes(file.mimetype);
  }

  /**
   * Upload middleware specifically for images
   */
  static uploadImages() {
    const imageFilter = (req, file, cb) => {
      // Only allow image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    };

    const imageUpload = multer({
      storage: multer.memoryStorage(),
      fileFilter: imageFilter,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for images
        files: 10 // Allow up to 10 images
      }
    });

    return imageUpload.array('images', 10);
  }

  /**
   * Process uploaded image files (FIXED)
   */
  static async processImageFiles(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No images uploaded'
        });
      }

      const processedImages = [];

      for (const file of req.files) {
        // Validate image file
        const validation = DocumentUploadMiddleware.validateImageFile(file);
        if (!validation.isValid) {
          return res.status(400).json({
            success: false,
            error: validation.error
          });
        }

        // Generate file hash
        const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

        // Generate unique file name
        const imageId = crypto.randomUUID();
        const fileExtension = path.extname(file.originalname);
        const storedFileName = `${imageId}${fileExtension}`; // FIXED: Use consistent variable name

        // Create image path
        const relativePath = `images`;
        const fullPath = getUploadPath(relativePath);

        // Ensure directory exists
        await fs.mkdir(fullPath, { recursive: true });

        // Save image to disk
        const filePath = path.join(fullPath, storedFileName); // FIXED: Use storedFileName
        await fs.writeFile(filePath, file.buffer);

        const processedImage = {
          id: imageId,
          originalName: file.originalname,
          fileName: storedFileName, // FIXED: Use storedFileName consistently
          filePath: storedFileName, // FIXED: Use storedFileName consistently
          mimeType: file.mimetype,
          size: file.size,
          fileHash: fileHash // Add file hash
        };

        processedImages.push(processedImage);
      }

      req.processedImages = processedImages;
      // Also store as processedFiles for compatibility with DocumentFolderMiddleware
      req.processedFiles = processedImages.map(image => ({
        originalFileName: image.originalName,
        storedFileName: image.fileName,
        filePath: image.filePath,
        fileSize: image.size,
        mimeType: image.mimeType,
        fileHash: image.fileHash, // Use calculated hash
        encryptionKey: null,
        documentType: 'image',
        fhirResourceType: null,
        patientIdentifier: null,
        fhirSecurityLabels: null,
        fhirVersion: null,
        fhirSensitivityLevel: null,
        fhirResourceId: null,
        enhancedMetadata: {
          uploadSession: req.sessionID || null,
          originalPath: image.filePath,
          processingTime: Date.now() - (req.uploadStartTime || Date.now()),
          isFHIRCompliant: false,
          analysisErrors: [],
          documentInferred: true,
          hasCustomName: false,
          uploadedToFolder: 'Images',
          securityLevel: 'standard'
        }
      }));
      next();

    } catch (error) {
      console.error('Error processing image files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process image files'
      });
    }
  }

  /**
   * Validate image file
   */
  static validateImageFile(file) {
    // Check file size (10MB limit for images)
    const maxImageSize = 10 * 1024 * 1024;
    if (file.size > maxImageSize) {
      return {
        isValid: false,
        error: `Image ${file.originalname} exceeds maximum size of 10MB`
      };
    }

    // Check if it's actually an image
    if (!file.mimetype.startsWith('image/')) {
      return {
        isValid: false,
        error: `File ${file.originalname} is not a valid image`
      };
    }

    // Check image extensions
    const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (!allowedImageExtensions.includes(fileExtension)) {
      return {
        isValid: false,
        error: `Image ${file.originalname} has invalid extension. Allowed: ${allowedImageExtensions.join(', ')}`
      };
    }

    return { isValid: true };
  }

  /**
   * Encrypt file buffer
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

  // ADD THIS RIGHT AFTER encryptBuffer
  static decryptBuffer(encryptedBuffer, encryptionKey) {
    try {
      const algorithm = 'aes-256-gcm';
      const iv = encryptedBuffer.slice(0, 16);
      const authTag = encryptedBuffer.slice(16, 32);
      const encrypted = encryptedBuffer.slice(32);

      const decipher = crypto.createDecipheriv(algorithm, Buffer.from(encryptionKey, 'hex'), iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt file: ${error.message}`);
    }
  }

  /**
   * Basic suspicious content detection
   */
  static containsSuspiciousContent(file) {
    // Check filename for suspicious patterns
    const suspiciousPatterns = [
      /\.exe$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.scr$/i,
      /\.js$/i,
      /\.vbs$/i,
      /\.php$/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(file.originalname));
  }

  /**
   * Error handler for multer errors
   */
  static handleUploadError(error, req, res, next) {
    if (error instanceof multer.MulterError) {
      switch (error.code) {
        case 'LIMIT_FILE_SIZE':
          return res.status(400).json({
            error: `File too large. Maximum size is ${config.FILE_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB`
          });
        case 'LIMIT_FILE_COUNT':
          return res.status(400).json({
            error: `Too many files. Maximum is ${config.FILE_LIMITS.MAX_FILES_PER_REQUEST}`
          });
        case 'LIMIT_UNEXPECTED_FILE':
          return res.status(400).json({
            error: 'Unexpected file field. Expected field name: "files"'
          });
        case 'LIMIT_PART_COUNT':
          return res.status(400).json({
            error: 'Too many parts in multipart data'
          });
        case 'LIMIT_FIELD_KEY':
          return res.status(400).json({
            error: 'Field name too long'
          });
        case 'LIMIT_FIELD_VALUE':
          return res.status(400).json({
            error: 'Field value too long'
          });
        case 'LIMIT_FIELD_COUNT':
          return res.status(400).json({
            error: 'Too many fields'
          });
        default:
          console.error('Unhandled MulterError:', {
            code: error.code,
            message: error.message,
            field: error.field,
            stack: error.stack
          });
          return res.status(400).json({
            error: `File upload error: ${error.code} - ${error.message}`,
            details: process.env.NODE_ENV !== 'production' ? error.field : undefined
          });
      }
    }

    if (error.message && error.message.includes('Invalid file type')) {
      return res.status(400).json({ error: error.message });
    }

    if (error.message && error.message.includes('Only image files are allowed')) {
      return res.status(400).json({
        error: 'Only image files are allowed. Please upload JPG, PNG, GIF, or TIFF files.'
      });
    }

    console.error('Unhandled upload error:', error);
    next(error);
  }

  /**
   * Process optional image files - allows continuation even if no files are uploaded
   */
  static async processOptionalImageFiles(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) {
        // No files uploaded - continue without processing
        req.processedImages = [];
        req.processedFiles = [];
        return next();
      }

      // If files are present, delegate to the existing processImageFiles method
      return DocumentUploadMiddleware.processImageFiles(req, res, next);
    } catch (error) {
      console.error('Optional image processing error:', error);
      next(error);
    }
  }
}

module.exports = DocumentUploadMiddleware;