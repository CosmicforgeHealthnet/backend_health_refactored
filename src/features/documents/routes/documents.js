// src/routes/documentRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Import controllers
const DocumentFolderController = require('../controllers/documentFolderController');
const DocumentFileController = require('../controllers/documentFileController');
const AnalyticsController = require('../controllers/analyticsController');

// Import middlewares
const DocumentUploadMiddleware = require('../middlewares/documentUploadMiddleware');
const DocumentFolderMiddleware = require('../middlewares/documentFolderMiddleware');

// Accepts JWT from Authorization header OR ?token= query param.
// Used for file viewing so direct browser URLs (with embedded token) work.
function authenticateJWTFlexible(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : queryToken;
  if (!token) return res.status(401).json({ error: 'Authorization header missing or malformed' });
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = payload;
    next();
  });
}

// PUBLIC ROUTES FIRST (no authentication)
router.get('/images/:imageId', DocumentFileController.servePublicImage);
router.get('/images/:imageId/thumbnail', DocumentFileController.serveImageThumbnail);

// File view route — accepts token from header OR query param (registered before global auth)
router.get('/files/:fileId', authenticateJWTFlexible, DocumentFileController.getFile);

// Authentication middleware (assuming you have this)
const { authenticateJWT } = require('../../../shared/middlewares/authMiddleware');

// Add this single line to protect all routes in the router
router.use(authenticateJWT);

// Image upload route (with authentication)
router.post('/images/upload',
  DocumentUploadMiddleware.uploadImages(),
  DocumentUploadMiddleware.processImageFiles,
  DocumentFileController.uploadImages
);

// =============================================================================
// FOLDER ROUTES
// =============================================================================

/**
 * @route   POST /api/documents/folders
 * @desc    Create a new folder
 * @access  Private
 */
router.post('/folders',
  // authenticateUser,
  DocumentFolderController.createFolder
);

/**
 * @route   GET /api/documents/folders
 * @desc    Get user's folders with pagination and filtering
 * @access  Private
 */
router.get('/folders',
  // authenticateUser,
  DocumentFolderController.getUserFolders
);

/**
 * @route   GET /api/documents/folders/recent
 * @desc    Get recent folders
 * @access  Private
 */
router.get('/folders/recent',
  // authenticateUser,
  DocumentFolderController.getRecentFolders
);

/**
 * @route   GET /api/documents/folders/search
 * @desc    Search folders
 * @access  Private
 */
router.get('/folders/search',
  // authenticateUser,
  DocumentFolderController.searchFolders
);

/**
 * @route   GET /api/documents/folders/type/:folderType
 * @desc    Get folders by type
 * @access  Private
 */
router.get('/folders/type/:folderType',
  // authenticateUser,
  DocumentFolderController.getFoldersByType
);

/**
 * @route   GET /api/documents/folders/:folderId
 * @desc    Get folder by ID with files
 * @access  Private
 */
router.get('/folders/:folderId',
  // authenticateUser,
  DocumentFolderController.getFolder
);

/**
 * @route   PUT /api/documents/folders/:folderId
 * @desc    Update folder
 * @access  Private
 */
router.put('/folders/:folderId',
  // authenticateUser,
  DocumentFolderController.updateFolder
);

/**
 * @route   DELETE /api/documents/folders/:folderId
 * @desc    Delete folder
 * @access  Private
 */
router.delete('/folders/:folderId',
  // authenticateUser,
  DocumentFolderController.deleteFolder
);

/**
 * @route   GET /api/documents/folders/:folderId/stats
 * @desc    Get folder statistics
 * @access  Private
 */
router.get('/folders/:folderId/stats',
  // authenticateUser,
  DocumentFolderController.getFolderStats
);

/**
 * @route   POST /api/documents/folders/:folderId/share
 * @desc    Share folder (make public/generate share link)
 * @access  Private
 */
router.post('/folders/:folderId/share',
  // authenticateUser,
  DocumentFolderController.shareFolder
);

/**
 * @route   GET /api/documents/folders/:folderId/activity
 * @desc    Get folder activity logs
 * @access  Private
 */
router.get('/folders/:folderId/activity',
  // authenticateUser,
  DocumentFolderController.getFolderActivity
);

/**
 * @route   GET /api/documents/folders/:folderId/files
 * @desc    Get files in folder
 * @access  Private
 */
router.get('/folders/:folderId/files',
  // authenticateUser,
  DocumentFileController.getFolderFiles
);

/**
 * @route   POST /api/documents/folders/:folderId/upload
 * @desc    Upload files to folder
 * @access  Private
 */
router.post('/folders/:folderId/upload',
  // authenticateUser,
  DocumentFolderMiddleware.handleFolderCreation,
  DocumentUploadMiddleware.uploadDocuments(),
  DocumentUploadMiddleware.processUploadedFiles,
  DocumentFolderMiddleware.saveFilesToDatabase,
  DocumentFolderMiddleware.generateFileUrls,
  DocumentFolderController.uploadToFolder
);

// =============================================================================
// FILE ROUTES
// =============================================================================

/**
 * @route   GET /api/documents/files/search
 * @desc    Search files across all folders
 * @access  Private
 */
router.get('/files/search',
  // authenticateUser,
  DocumentFileController.searchFiles
);

/**
 * @route   GET /api/documents/files/recent
 * @desc    Get recent files
 * @access  Private
 */
router.get('/files/recent',
  // authenticateUser,
  DocumentFileController.getRecentFiles
);

/**
 * @route   GET /api/documents/files/stats
 * @desc    Get user file statistics
 * @access  Private
 */
router.get('/files/stats',
  // authenticateUser,
  DocumentFileController.getUserFileStats
);

/**
 * @route   GET /api/documents/files/type/:documentType
 * @desc    Get files by document type
 * @access  Private
 */
router.get('/files/type/:documentType',
  // authenticateUser,
  DocumentFileController.getFilesByDocumentType
);

/**
 * @route   DELETE /api/documents/files/bulk
 * @desc    Bulk delete files
 * @access  Private
 */
router.delete('/files/bulk',
  // authenticateUser,
  DocumentFileController.bulkDeleteFiles
);

/**
 * @route   PUT /api/documents/files/:fileId
 * @desc    Update file metadata
 * @access  Private
 */
router.put('/files/:fileId',
  // authenticateUser,
  DocumentFileController.updateFile
);

/**
 * @route   DELETE /api/documents/files/:fileId
 * @desc    Delete file
 * @access  Private
 */
router.delete('/files/:fileId',
  // authenticateUser,
  DocumentFileController.deleteFile
);

/**
 * @route   GET /api/documents/files/:fileId/download
 * @desc    Download file
 * @access  Private (or public with valid token)
 */
router.get('/files/:fileId/download',
  // authenticateUser, // Optional if using signed URLs
  DocumentFileController.downloadFile
);

/**
 * @route   GET /api/documents/files/:fileId/stream
 * @desc    Stream file (for large files)
 * @access  Private (or public with valid token)
 */
router.get('/files/:fileId/stream',
  // authenticateUser, // Optional if using signed URLs
  DocumentFileController.streamFile
);

/**
 * @route   GET /api/documents/files/:fileId/preview
 * @desc    Get file preview/thumbnail
 * @access  Private
 */
router.get('/files/:fileId/preview',
  // authenticateUser,
  DocumentFileController.getFilePreview
);

// =============================================================================
// UPLOAD ROUTES (Alternative to folder-specific upload)
// =============================================================================

/**
 * @route   POST /api/documents/upload
 * @desc    Upload files (creates folder automatically if needed)
 * @access  Private
 */
router.post('/upload',
  // authenticateUser,
  DocumentFolderMiddleware.handleFolderCreation,
  DocumentUploadMiddleware.uploadDocuments(),
  DocumentUploadMiddleware.processUploadedFiles,
  DocumentFolderMiddleware.saveFilesToDatabase,
  DocumentFolderMiddleware.generateFileUrls,
  (req, res) => {
    res.status(201).json({
      success: true,
      message: `${req.fileUrls.length} files uploaded successfully`,
      folder: req.folderInfo,
      files: req.fileUrls
    });
  }
);

// =============================================================================
// ANALYTICS ROUTES
// =============================================================================

/**
 * @route   GET /api/documents/analytics/dashboard
 * @desc    Get user dashboard analytics
 * @access  Private
 */
router.get('/analytics/dashboard',
  // authenticateUser,
  AnalyticsController.getDashboard
);

/**
 * @route   GET /api/documents/analytics/overview
 * @desc    Get user statistics overview
 * @access  Private
 */
router.get('/analytics/overview',
  // authenticateUser,
  AnalyticsController.getOverview
);

/**
 * @route   GET /api/documents/analytics/storage
 * @desc    Get storage analytics
 * @access  Private
 */
router.get('/analytics/storage',
  // authenticateUser,
  AnalyticsController.getStorageAnalytics
);

/**
 * @route   GET /api/documents/analytics/security
 * @desc    Get security analytics
 * @access  Private
 */
router.get('/analytics/security',
  // authenticateUser,
  AnalyticsController.getSecurityAnalytics
);

/**
 * @route   GET /api/documents/analytics/access
 * @desc    Get access analytics
 * @access  Private
 */
router.get('/analytics/access',
  // authenticateUser,
  AnalyticsController.getAccessAnalytics
);

/**
 * @route   GET /api/documents/analytics/files
 * @desc    Get file analytics
 * @access  Private
 */
router.get('/analytics/files',
  // authenticateUser,
  AnalyticsController.getFileAnalytics
);

/**
 * @route   GET /api/documents/analytics/folders
 * @desc    Get folder analytics
 * @access  Private
 */
router.get('/analytics/folders',
  // authenticateUser,
  AnalyticsController.getFolderAnalytics
);

/**
 * @route   GET /api/documents/analytics/activity
 * @desc    Get activity summary
 * @access  Private
 */
router.get('/analytics/activity',
  // authenticateUser,
  AnalyticsController.getActivitySummary
);

/**
 * @route   GET /api/documents/analytics/downloads
 * @desc    Get download statistics
 * @access  Private
 */
router.get('/analytics/downloads',
  // authenticateUser,
  AnalyticsController.getDownloadStats
);

/**
 * @route   GET /api/documents/analytics/trends
 * @desc    Get usage trends
 * @access  Private
 */
router.get('/analytics/trends',
  // authenticateUser,
  AnalyticsController.getUsageTrends
);

/**
 * @route   GET /api/documents/analytics/file-types
 * @desc    Get file type distribution
 * @access  Private
 */
router.get('/analytics/file-types',
  // authenticateUser,
  AnalyticsController.getFileTypeDistribution
);

/**
 * @route   POST /api/documents/analytics/reports
 * @desc    Generate analytics report
 * @access  Private
 */
router.post('/analytics/reports',
  // authenticateUser,
  AnalyticsController.generateReport
);

/**
 * @route   GET /api/documents/analytics/export
 * @desc    Export analytics data
 * @access  Private
 */
router.get('/analytics/export',
  // authenticateUser,
  AnalyticsController.exportAnalytics
);

// =============================================================================
// ERROR HANDLING MIDDLEWARE
// =============================================================================

// Handle multer upload errors
router.use(DocumentUploadMiddleware.handleUploadError);

// Global error handler for this router
router.use((error, req, res, next) => {
  console.error('Document routes error:', error);

  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = router;