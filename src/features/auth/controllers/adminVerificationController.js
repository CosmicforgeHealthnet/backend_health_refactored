// src/controllers/adminVerificationController.js
const doctorVerificationService = require('../../doctor/services/doctorVerificationService.js');
const verificationRequestRepo = require('../../doctor/repositories/verificationRequestRepository');
const queueRepo = require('../../doctor/repositories/verificationReviewQueueRepository');
const { sendAdminVerificationNotificationEmail } = require('../../../shared/services/email/helper/index.js');
const verificationDocumentRepo = require('../../doctor/repositories/verificationDocumentRepository');
const userRepository = require('../repositories/userRepository');
// const { Not, In } = require('typeorm');
const path = require('node:path');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');

class AdminVerificationController {

  /**
   * Get verification queue for manual review
   * GET /api/admin/verification/queue
   */
  async getVerificationQueue(req, res, next) {
    try {
      const { status, country, priority, assigned, page = 1, limit = 10000 } = req.query;
      const offset = (page - 1) * limit;

      console.log('Queue request params:', { status, country, priority, assigned, page, limit });

      let queueItems = [];
      let totalFilteredItems = 0;

      try {
        // Get ALL verification requests first
        console.log('Getting ALL verification requests');
        queueItems = await verificationRequestRepo.repository.find({
          relations: ["doctor", "assignedReviewer"],
          order: { submittedAt: "DESC" }
        });

        console.log('Before filtering PENDING_DOCUMENTS:', queueItems.length);

        // Filter out PENDING_DOCUMENTS status - don't show to admin until documents uploaded
        queueItems = queueItems.filter(item => {
          const shouldInclude = item.status !== 'pending_documents';
          if (!shouldInclude) {
            console.log(`Filtering out item ${item.id} with status: ${item.status}`);
          }
          return shouldInclude;
        });

        console.log('After filtering PENDING_DOCUMENTS:', queueItems.length);

        // Apply user filters
        if (status) {
          const targetStatus = status.toLowerCase();
          queueItems = queueItems.filter(item =>
            item.status && item.status.toLowerCase() === targetStatus
          );
          console.log(`Filtered by status ${targetStatus}:`, queueItems.length);
        }

        if (country) {
          queueItems = queueItems.filter(item =>
            item.countryCode && item.countryCode.toUpperCase() === country.toUpperCase()
          );
          console.log(`Filtered by country ${country}:`, queueItems.length);
        }

        if (assigned === 'me') {
          queueItems = queueItems.filter(item =>
            item.assignedReviewerId === req.user.sub
          );
          console.log(`Filtered by assigned to me:`, queueItems.length);
        } else if (assigned === 'unassigned') {
          queueItems = queueItems.filter(item =>
            !item.assignedReviewerId
          );
          console.log(`Filtered by unassigned:`, queueItems.length);
        }

        if (priority) {
          queueItems = queueItems.filter(item =>
            item.priority && item.priority.toLowerCase() === priority.toLowerCase()
          );
          console.log(`Filtered by priority ${priority}:`, queueItems.length);
        }

        // Apply pagination
        totalFilteredItems = queueItems.length;
        queueItems = queueItems.slice(offset, offset + parseInt(limit));

        console.log(`Paginated results (page ${page}):`, queueItems.length);

      } catch (repoError) {
        console.error('Repository error:', repoError);
        queueItems = await verificationRequestRepo.repository.find({
          relations: ["doctor", "assignedReviewer"],
          order: { submittedAt: "DESC" }
        });
        // Filter PENDING_DOCUMENTS in fallback too
        queueItems = queueItems.filter(item => item.status !== 'pending_documents');
        totalFilteredItems = queueItems.length;
      }

      console.log('Final queue items found:', queueItems.length);

      // Format items
      const formattedItems = queueItems.map(item => {
        const verification = item.verificationRequest || item;
        const doctor = verification.doctor || item.doctor;

        return {
          id: verification.id,
          doctor: {
            id: doctor?.id,
            fullName: doctor?.fullName,
            email: doctor?.email
          },
          licenseNumber: verification.licenseNumber,
          countryCode: verification.countryCode,
          status: verification.status,
          tier: verification.tier,
          submittedAt: verification.submittedAt,
          priority: item.priority || 'normal',
          assignedTo: item.assignedTo || verification.assignedReviewerId,
          slaTarget: item.slaTarget,
          slaBreached: item.slaBreached || false,
          complexity: item.complexity || 'medium',
          method: verification.method,
          confidenceScore: verification.confidenceScore,
          reviewStartedAt: verification.reviewStartedAt,
          approvedAt: verification.approvedAt,
          rejectedAt: verification.rejectedAt,
          rejectionReason: verification.rejectionReason
        };
      });

      // Status breakdown
      const statusBreakdown = {};
      formattedItems.forEach(item => {
        const status = item.status || 'unknown';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      });

      // Country breakdown
      const countryBreakdown = {};
      formattedItems.forEach(item => {
        const country = item.countryCode || 'unknown';
        countryBreakdown[country] = (countryBreakdown[country] || 0) + 1;
      });

      res.json({
        success: true,
        queueItems: formattedItems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalFilteredItems,
          totalPages: Math.ceil(totalFilteredItems / parseInt(limit)),
          hasNextPage: (page * limit) < totalFilteredItems,
          hasPrevPage: page > 1
        },
        filters: {
          status: status || null,
          country: country || null,
          priority: priority || null,
          assigned: assigned || null
        },
        summary: {
          totalItems: formattedItems.length,
          statusBreakdown: statusBreakdown,
          countryBreakdown: countryBreakdown
        }
      });

    } catch (error) {
      console.error('Verification queue error:', error);
      next(error);
    }
  }

  /**
   * Assign verification to reviewer
   * POST /api/admin/verification/:id/assign
   */
  async assignVerification(req, res, next) {
    try {
      const { id: verificationId } = req.params;
      const { assignTo } = req.body;
      const adminId = req.user.sub;

      // Default assign to current admin if not specified
      const reviewerId = assignTo || adminId;

      // Validate reviewer exists and has admin role
      const reviewer = await userRepository.findById(reviewerId);
      if (!reviewer || !['admin', 'super_admin'].includes(reviewer.role)) {
        return res.status(400).json({
          error: 'Invalid reviewer specified'
        });
      }

      await queueRepo.assignToUser(verificationId, reviewerId);

      res.json({
        message: 'Verification assigned successfully',
        assignedTo: {
          id: reviewer.id,
          fullName: reviewer.fullName,
          email: reviewer.email
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve verification
   * POST /api/admin/verification/:id/approve
   */
  async approveVerification(req, res, next) {
    try {
      const { id: verificationId } = req.params;
      const { approvalNotes } = req.body;
      const adminId = req.user.sub;

      const verificationRequest = await doctorVerificationService.approveVerification(
        verificationId,
        adminId,
        approvalNotes
      );

      // In approveVerification or when assigning to admin
      const sendNotification = async () => {
        try {
          await sendAdminVerificationNotificationEmail(
            // adminEmail,
            verificationRequest,
            // doctor
          );
        } catch (error) {
          console.error('Failed to send admin notification email:', error);
          // Don't throw - notification failure shouldn't block the main flow
        }
      };

      // Fire and forget - don't await
      sendNotification().catch(console.error);

      res.json({
        message: 'Verification approved successfully',
        verificationRequest: {
          id: verificationRequest.id,
          status: verificationRequest.status,
          approvedAt: verificationRequest.approvedAt,
          confidenceScore: verificationRequest.confidenceScore
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Reject verification
   * POST /api/admin/verification/:id/reject
   */
  async rejectVerification(req, res, next) {
    try {
      const { id: verificationId } = req.params;
      const { rejectionReason } = req.body;
      const adminId = req.user.sub;

      if (!rejectionReason || rejectionReason.trim().length === 0) {
        return res.status(400).json({
          error: 'Rejection reason is required'
        });
      }

      const verificationRequest = await doctorVerificationService.rejectVerification(
        verificationId,
        adminId,
        rejectionReason.trim()
      );

      res.json({
        message: 'Verification rejected successfully',
        verificationRequest: {
          id: verificationRequest.id,
          status: verificationRequest.status,
          rejectedAt: verificationRequest.rejectedAt,
          rejectionReason: verificationRequest.rejectionReason
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get verification details for admin review
   * GET /api/admin/verification/:id
   */
  async getVerificationDetails(req, res, next) {
    try {
      const { id: verificationId } = req.params;

      const verificationRequest = await doctorVerificationService.getVerificationRequest(
        verificationId,
        true // Include sensitive admin data
      );

      if (!verificationRequest) {
        return res.status(404).json({
          error: 'Verification request not found'
        });
      }

      res.json({
        verificationRequest: {
          id: verificationRequest.id,
          doctor: {
            id: verificationRequest.doctor.id,
            fullName: verificationRequest.doctor.fullName,
            email: verificationRequest.doctor.email,
            createdAt: verificationRequest.doctor.createdAt
          },
          licenseNumber: verificationRequest.licenseNumber,
          countryCode: verificationRequest.countryCode,
          issuingAuthority: verificationRequest.issuingAuthority,
          licenseType: verificationRequest.licenseType,
          issueDate: verificationRequest.issueDate,
          expiryDate: verificationRequest.expiryDate,
          status: verificationRequest.status,
          method: verificationRequest.method,
          tier: verificationRequest.tier,
          confidenceScore: verificationRequest.confidenceScore,
          apiVerificationData: verificationRequest.apiVerificationData,
          apiErrors: verificationRequest.apiErrors,
          ninVerification: {
            status: verificationRequest.ninVerificationStatus,
            last4: verificationRequest.ninLast4,
            nameMatchScore: verificationRequest.ninNameMatchScore,
            verifiedData: verificationRequest.ninVerifiedData,
            submittedAt: verificationRequest.ninSubmittedAt,
            verifiedAt: verificationRequest.ninVerifiedAt
          },
          submittedAt: verificationRequest.submittedAt,
          approvedAt: verificationRequest.approvedAt,
          rejectedAt: verificationRequest.rejectedAt,
          rejectionReason: verificationRequest.rejectionReason,
          assignedReviewer: verificationRequest.assignedReviewer ? {
            id: verificationRequest.assignedReviewer.id,
            fullName: verificationRequest.assignedReviewer.fullName,
            email: verificationRequest.assignedReviewer.email
          } : null,
          documents: verificationRequest.documents?.map(doc => ({
            id: doc.id,
            documentType: doc.documentType,
            originalFileName: doc.originalFileName,
            status: doc.status,
            uploadedAt: doc.uploadedAt,
            verifiedAt: doc.verifiedAt,
            rejectionReason: doc.rejectionReason,
            ocrConfidence: doc.ocrConfidence,
            extractedData: doc.extractedData
          })),
          statusHistory: verificationRequest.statusHistory?.map(history => ({
            fromStatus: history.fromStatus,
            toStatus: history.toStatus,
            changedAt: history.changedAt,
            changeReason: history.changeReason,
            automatedChange: history.automatedChange,
            changedBy: history.changedByUser ? {
              fullName: history.changedByUser.fullName,
              email: history.changedByUser.email
            } : null
          }))
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
 * Get verification documents for admin review
 * GET /api/admin/verification/:id/documents
 */
  async getVerificationDocuments(req, res, next) {
    try {
      const { id: verificationRequestId } = req.params;

      // Check admin permissions
      if (!['admin', 'super_admin', 'reviewer'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const verificationRequest = await doctorVerificationService.getVerificationRequest(
        verificationRequestId,
        true // Include sensitive data for admin
      );

      if (!verificationRequest) {
        return res.status(404).json({ error: 'Verification request not found' });
      }

      // Get documents with secure URLs for admin viewing
      const documentsWithUrls = verificationRequest.documents?.map(doc => ({
        id: doc.id,
        originalFileName: doc.originalFileName,
        customDocumentName: doc.customDocumentName,
        displayName: doc.displayName || doc.customDocumentName || doc.originalFileName,
        documentDescription: doc.documentDescription,
        documentType: doc.documentType,
        documentCategory: doc.documentCategory,
        folderName: doc.folderName,
        status: doc.status,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt,
        verifiedAt: doc.verifiedAt,
        rejectionReason: doc.rejectionReason,
        ocrConfidence: doc.ocrConfidence,
        extractedData: doc.extractedData,
        // FHIR data if applicable
        fhirResourceType: doc.fhirResourceType,
        patientIdentifier: doc.patientIdentifier,
        fhirSensitivityLevel: doc.fhirSensitivityLevel,
        // Generate admin viewing URLs
        viewUrl: `/api/admin/documents/${doc.id}/view`,
        downloadUrl: `/api/admin/documents/${doc.id}/download`,
        thumbnailUrl: doc.mimeType?.startsWith('image/') ? `/api/admin/documents/${doc.id}/thumbnail` : null
      })) || [];

      // Group documents by category/folder for better organization
      const documentsByCategory = {};
      documentsWithUrls.forEach(doc => {
        const category = doc.documentCategory || 'Other';
        if (!documentsByCategory[category]) {
          documentsByCategory[category] = [];
        }
        documentsByCategory[category].push(doc);
      });

      res.json({
        verificationRequestId,
        doctorId: verificationRequest.doctorId,
        doctorInfo: {
          fullName: verificationRequest.doctor?.fullName,
          email: verificationRequest.doctor?.email
        },
        verificationStatus: verificationRequest.status,
        documents: documentsWithUrls,
        documentsByCategory,
        totalDocuments: documentsWithUrls.length,
        summary: {
          totalSize: documentsWithUrls.reduce((sum, doc) => sum + (doc.fileSize || 0), 0),
          categories: Object.keys(documentsByCategory),
          fhirDocuments: documentsWithUrls.filter(doc => doc.fhirResourceType).length,
          encryptedDocuments: documentsWithUrls.filter(doc => doc.status === 'encrypted').length
        }
      });

    } catch (error) {
      console.error('Error getting verification documents:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * View specific document (admin only)
   * GET /api/admin/documents/:documentId/view
   */
  async viewDocument(req, res, next) {
    try {
      const { documentId } = req.params;

      // Check admin permissions
      if (!['admin', 'super_admin', 'reviewer'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const document = await verificationDocumentRepo.findById(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Construct file path
      const uploadPath = process.env.NODE_ENV === 'production'
        ? '/opt/render/project/uploads'
        : path.join(__dirname, '../uploads');

      const filePath = path.join(uploadPath, 'images', document.storedFileName);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Document file not found on server' });
      }

      // Read file (use promises version for consistency)
      // const fsPromises = require('fs').promises;
      let fileData = await fsPromises.readFile(filePath);

      // Decrypt if encrypted
      if (document.encryptionKey) {
        const DocumentUploadMiddleware = require('../../../features/documents/middlewares/documentUploadMiddleware');
        fileData = DocumentUploadMiddleware.decryptBuffer(fileData, document.encryptionKey);
      }

      // Set appropriate headers for viewing
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Length', fileData.length);
      res.setHeader('Content-Disposition', `inline; filename="${document.originalFileName}"`);
      res.setHeader('Cache-Control', 'private, no-cache');

      // Log admin access
      // await this.logAdminDocumentAccess(documentId, req.user.sub, 'view', req.ip);
      // this.logAdminDocumentAccess(documentId, req.user.sub, 'view', req.ip);
      console.log(`[ADMIN ACCESS] VIEW - Admin ${req.user.sub} viewed document ${documentId} from ${req.ip} at ${new Date().toISOString()}`);
      // Send the file data
      res.send(fileData);

    } catch (error) {
      console.error('Error viewing document:', error);
      next(error);
    }
  }

  /**
   * Download specific document (admin only)
   * GET /api/admin/documents/:documentId/download
   */
  async downloadDocument(req, res, next) {
    try {
      const { documentId } = req.params;

      // Check admin permissions
      if (!['admin', 'super_admin', 'reviewer'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const document = await verificationDocumentRepo.findById(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Construct file path
      const uploadPath = process.env.NODE_ENV === 'production'
        ? '/opt/render/project/uploads'
        : path.join(__dirname, '../uploads');

      const filePath = path.join(uploadPath, 'images', document.storedFileName);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Document file not found on server' });
      }

      // Handle encrypted files
      let fileData;
      if (document.encryptionKey && document.isEncrypted) {
        try {
          fileData = await this.decryptDocument(filePath, document.encryptionKey);
        } catch (decryptError) {
          console.error('Failed to decrypt document:', decryptError);
          return res.status(500).json({ error: 'Failed to decrypt document' });
        }
      } else {
        fileData = fs.readFileSync(filePath);
      }

      // Set headers for download
      const downloadName = document.customDocumentName || document.originalFileName;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', fileData.length);
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

      // Log admin access
      // await this.logAdminDocumentAccess(documentId, req.user.sub, 'download', req.ip);
      console.log(`[ADMIN ACCESS] VIEW - Admin ${req.user.sub} viewed document ${documentId} from ${req.ip} at ${new Date().toISOString()}`);

      // Send the file data
      res.send(fileData);

    } catch (error) {
      console.error('Error downloading document:', error);
      next(error);
    }
  }

  /**
   * Generate thumbnail for image documents (admin only)
   * GET /api/admin/documents/:documentId/thumbnail
   */
  async getDocumentThumbnail(req, res, next) {
    try {
      const { documentId } = req.params;

      // Check admin permissions
      if (!['admin', 'super_admin', 'reviewer'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const document = await verificationDocumentRepo.findById(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Only generate thumbnails for images
      if (!document.mimeType?.startsWith('image/')) {
        return res.status(400).json({ error: 'Thumbnails only available for image documents' });
      }

      // Construct file path
      const uploadPath = process.env.NODE_ENV === 'production'
        ? '/opt/render/project/uploads'
        : path.join(__dirname, '../uploads');

      const filePath = path.join(uploadPath, 'images', document.storedFileName);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Document file not found on server' });
      }

      // Read file
      let fileData = await fsPromises.readFile(filePath);

      // Decrypt if encrypted
      if (document.encryptionKey) {
        const DocumentUploadMiddleware = require('../../../features/documents/middlewares/documentUploadMiddleware');
        fileData = DocumentUploadMiddleware.decryptBuffer(fileData, document.encryptionKey);
      }

      // Set appropriate headers for viewing as thumbnail
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Length', fileData.length);
      res.setHeader('Content-Disposition', `inline; filename="thumb_${document.originalFileName}"`);
      res.setHeader('Cache-Control', 'private, no-cache');

      // Log admin access
      console.log(`[ADMIN ACCESS] THUMBNAIL - Admin ${req.user.sub} viewed thumbnail for document ${documentId} from ${req.ip} at ${new Date().toISOString()}`);

      // Send the file data
      res.send(fileData);

    } catch (error) {
      console.error('Error getting document thumbnail:', error);
      next(error);
    }
  }

  // Helper methods
  generateAdminDocumentUrl(documentId) {
    return `/admin/documents/${documentId}/view`;
  }

  generateAdminDownloadUrl(documentId) {
    return `/admin/documents/${documentId}/download`;
  }

  generateAdminThumbnailUrl(documentId) {
    return `/admin/documents/${documentId}/thumbnail`;
  }

  async decryptDocument(filePath, encryptionKey) {
    const crypto = require('node:crypto');

    // Read encrypted file
    const encryptedData = fs.readFileSync(filePath);

    const algorithm = 'aes-256-gcm';
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);

    // Create decipher
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(encryptionKey, 'hex'), iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
  }

  async logAdminDocumentAccess(documentId, adminId, action, ipAddress) {
    try {
      // Enhanced logging for admin document access
      console.log(`[ADMIN ACCESS] ${action.toUpperCase()} - Admin ${adminId} ${action}ed document ${documentId} from ${ipAddress} at ${new Date().toISOString()}`);

      // You can expand this to write to an audit log table
      // await auditLogRepo.create({
      //   adminId,
      //   documentId,
      //   action,
      //   ipAddress,
      //   timestamp: new Date(),
      //   userAgent: req.get('User-Agent')
      // });

    } catch (error) {
      console.error('Failed to log admin document access:', error);
      // Don't throw error, just log it
    }
  }

  /**
   * List doctors who registered but never called /verification/submit.
   * These have zero verification_requests rows, so they never show up in
   * getVerificationQueue (which only ever lists existing requests) — this is
   * the only way to find them short of querying the database directly.
   * GET /api/admin/verification/stuck-doctors
   */
  async getStuckDoctors(req, res, next) {
    try {
      const doctors = await userRepository.findDoctorsWithNoVerificationRequest();

      res.json({
        success: true,
        count: doctors.length,
        doctors: doctors.map(d => ({
          id: d.id,
          fullName: d.fullName,
          email: d.email,
          phoneNumber: d.phoneNumber,
          status: d.status,
          profileStatus: d.hasProfile ? "complete" : "incomplete",
          createdAt: d.createdAt,
          daysSinceSignup: Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get verified doctors who haven't set up pricing and/or availability yet
   * — verified, but not actually bookable by patients.
   * GET /api/admin/verification/pending-booking-setup
   */
  async getDoctorsPendingBookingSetup(req, res, next) {
    try {
      const doctors = await userRepository.findVerifiedDoctorsMissingBookingSetup();

      res.json({
        success: true,
        count: doctors.length,
        doctors: doctors.map(d => ({
          id: d.id,
          fullName: d.fullName,
          email: d.email,
          hasPricing: d.hasPricing,
          hasAvailability: d.hasAvailability,
          createdAt: d.createdAt,
          daysSinceVerified: Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get verification statistics
   * GET /api/admin/verification/statistics
   */
  async getVerificationStatistics(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      const stats = await doctorVerificationService.getVerificationStatistics(
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null
      );

      res.json(stats);

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminVerificationController();
