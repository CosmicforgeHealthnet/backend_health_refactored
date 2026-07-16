// src/controllers/doctorVerificationController.js

// const doctorVerificationService = require('../services/doctorVerificationService');
const doctorVerificationService = require('../services/doctorVerificationService.js');
const verificationRequestRepo = require('../repositories/verificationRequestRepository');
const countryConfigRepo = require('../repositories/countryVerificationConfigRepository');
const verificationStatusHistoryRepo = require('../repositories/verificationStatusHistoryRepository.js')
const queueRepo = require('../repositories/verificationReviewQueueRepository');
const verificationDocumentRepo = require('../repositories/verificationDocumentRepository');
const verificationConfig = require('../../../config/verificationConfig');

function formatProcessingTime(hours) {
  if (!hours) return 'Not specified';

  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  const days = Math.round(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

class DoctorVerificationController {

  /**
   * Submit verification request
   * POST /api/doctor/verification/submit
   */
  async submitVerification(req, res, next) {
    try {
      const { licenseNumber, countryCode, issuingAuthority, licenseType, issueDate, expiryDate } = req.body;
      const doctorId = req.user.sub;

      if (!doctorId) {
        return res.status(400).json({ error: 'Doctor ID is required' });
      }

      // Validate required fields
      if (!licenseNumber || !countryCode) {
        return res.status(400).json({
          error: 'License number and country code are required'
        });
      }

      // Check if user is a doctor
      if (req.user.role !== 'doctor') {
        return res.status(403).json({
          error: 'Only doctors can submit verification requests'
        });
      }

      // Check if user status allows verification
      if (!['pending_doctor_verification', 'locked'].includes(req.user.status)) {
        return res.status(400).json({
          error: 'Doctor account is already verified or not eligible for verification submission'
        });
      }

      const verificationData = {
        licenseNumber: licenseNumber.trim(),
        countryCode: countryCode.toUpperCase(),
        issuingAuthority,
        licenseType,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null
      };

      const verificationRequest = await doctorVerificationService.submitVerificationRequest(
        doctorId,
        verificationData,
        doctorId
      );



      // For Tier 1: Try API verification first, only require documents if API fails
      if (verificationRequest.tier === 'tier_1') {
        // Tier 1 should proceed to automated verification immediately
        // Documents only required if API verification fails (handled in service layer)
        return res.status(201).json({
          message: 'Verification request submitted successfully. Processing automatically...',
          verificationRequest: {
            id: verificationRequest.id,
            status: verificationRequest.status,
            method: verificationRequest.method,
            tier: verificationRequest.tier,
            submittedAt: verificationRequest.submittedAt,
            expiresAt: verificationRequest.expiresAt
          },
          processingType: 'automated',
          estimatedTime: '2-4 hours'
        });
      }

      // For Tier 2 and Tier 3: Always require documents before manual review
      const docs = await verificationDocumentRepo.findByVerificationRequestId(verificationRequest.id);
      const requiredDocs = verificationConfig.DOCUMENT_REQUIREMENTS[verificationRequest.tier] || [];

      if (requiredDocs.length > 0 && !requiredDocs.every(docType => docs.some(doc => doc.documentType === docType))) {
        // Update status to indicate documents are needed
        await verificationRequestRepo.update(verificationRequest.id, {
          status: 'pending_documents'
        });

        return res.status(201).json({
          message: 'Verification request submitted successfully. Please upload required documents.',
          verificationRequest: {
            id: verificationRequest.id,
            status: 'pending_documents',
            method: verificationRequest.method,
            tier: verificationRequest.tier,
            submittedAt: verificationRequest.submittedAt,
            expiresAt: verificationRequest.expiresAt
          },
          requiredDocuments: requiredDocs,
          processingType: verificationRequest.tier === 'tier_2' ? 'hybrid' : 'manual',
          estimatedTime: verificationRequest.tier === 'tier_2' ? '1-3 days' : '5-7 days',
          nextStep: 'Upload required documents using POST /api/doctor/verification/' + verificationRequest.id + '/documents'
        });
      }

      // If all documents are present for Tier 2/3, proceed to manual review
      res.status(201).json({
        message: 'Verification request submitted successfully',
        verificationRequest: {
          id: verificationRequest.id,
          status: verificationRequest.status,
          method: verificationRequest.method,
          tier: verificationRequest.tier,
          submittedAt: verificationRequest.submittedAt,
          expiresAt: verificationRequest.expiresAt
        },
        processingType: verificationRequest.tier === 'tier_2' ? 'hybrid' : 'manual',
        estimatedTime: verificationRequest.tier === 'tier_2' ? '1-3 days' : '5-7 days'
      });

    } catch (error) {
      console.error('Error submitting verification request:', error);

      // Handle specific error types with better messages
      if (error.message === 'Doctor already has an active verification request') {
        return res.status(409).json({
          error: 'Active verification request exists',
          message: 'You already have an active verification request. Please wait for it to complete or check your verification status.',
          errorCode: 'ACTIVE_VERIFICATION_EXISTS',
          suggestedAction: 'Check verification status at /api/doctor/verification/status'
        });
      }

      if (error.message.includes('Country not supported')) {
        return res.status(400).json({
          error: 'Unsupported country',
          message: error.message,
          errorCode: 'COUNTRY_NOT_SUPPORTED',
          suggestedAction: 'Check supported countries at /api/doctor/verification/countries'
        });
      }

      if (error.message.includes('Invalid license number format')) {
        return res.status(400).json({
          error: 'Invalid license number',
          message: error.message,
          errorCode: 'INVALID_LICENSE_FORMAT',
          field: 'licenseNumber'
        });
      }

      if (error.message.includes('License already verified')) {
        return res.status(409).json({
          error: 'License already verified',
          message: 'This license number has already been verified by another doctor.',
          errorCode: 'LICENSE_ALREADY_VERIFIED'
        });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation failed',
          message: error.message,
          field: error.field,
          errorCode: 'VALIDATION_ERROR'
        });
      }

      // Handle business logic errors
      if (error.name === 'BusinessLogicError') {
        return res.status(400).json({
          error: 'Business rule violation',
          message: error.message,
          errorCode: error.code || 'BUSINESS_LOGIC_ERROR'
        });
      }

      // Handle conflict errors
      if (error.name === 'ConflictError') {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message,
          resource: error.resource,
          errorCode: 'CONFLICT_ERROR'
        });
      }

      // Generic error handling
      if (error.message) {
        return res.status(400).json({
          error: error.message,
          errorCode: 'GENERIC_ERROR'
        });
      }

      // Unexpected errors
      next(error);
    }
  }

  // Add these methods to DoctorVerificationController class:

  /**
   * Update doctor verification information
   * PUT /api/doctor/verification/:id/update
   */
  async updateVerificationInfo(req, res, next) {
    try {
      const { id: verificationRequestId } = req.params;
      const doctorId = req.user.sub;
      const { licenseNumber, countryCode, issuingAuthority, licenseType, issueDate, expiryDate } = req.body;

      // Check if this verification belongs to the doctor
      const verificationRequest = await verificationRequestRepo.findById(verificationRequestId);
      if (!verificationRequest || verificationRequest.doctorId !== doctorId) {
        return res.status(404).json({ error: 'Verification request not found' });
      }

      // Only allow updates for certain statuses
      const editableStatuses = ['pending', 'in_progress', 'rejected'];
      if (!editableStatuses.includes(verificationRequest.status)) {
        return res.status(400).json({
          error: 'Cannot edit verification information in current status',
          currentStatus: verificationRequest.status
        });
      }

      // Prepare update data
      const updateData = {};
      if (licenseNumber) updateData.licenseNumber = licenseNumber.trim();
      if (countryCode) updateData.countryCode = countryCode.toUpperCase();
      if (issuingAuthority) updateData.issuingAuthority = issuingAuthority;
      if (licenseType) updateData.licenseType = licenseType;
      if (issueDate) updateData.issueDate = new Date(issueDate);
      if (expiryDate) updateData.expiryDate = new Date(expiryDate);

      // Add update metadata
      updateData.updatedAt = new Date();
      updateData.updatedBy = doctorId;

      // Update verification request
      const updatedRequest = await verificationRequestRepo.update(verificationRequestId, updateData);

      // Log the update
      await verificationStatusHistoryRepo.logStatusChange(
        verificationRequestId,
        verificationRequest.status,
        verificationRequest.status, // Same status, just info update
        doctorId,
        'Doctor updated verification information',
        { updatedFields: Object.keys(updateData) },
        false
      );

      res.json({
        message: 'Verification information updated successfully',
        verificationRequest: {
          id: updatedRequest.id,
          licenseNumber: updatedRequest.licenseNumber,
          countryCode: updatedRequest.countryCode,
          issuingAuthority: updatedRequest.issuingAuthority,
          licenseType: updatedRequest.licenseType,
          issueDate: updatedRequest.issueDate,
          expiryDate: updatedRequest.expiryDate,
          status: updatedRequest.status,
          updatedAt: updatedRequest.updatedAt
        }
      });

    } catch (error) {
      console.error('Error updating verification info:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get editable verification info
   * GET /api/doctor/verification/:id/edit
   */
  async getEditableVerificationInfo(req, res, next) {
    try {
      const { id: verificationRequestId } = req.params;
      const doctorId = req.user.sub;

      const verificationRequest = await verificationRequestRepo.findById(verificationRequestId);
      if (!verificationRequest || verificationRequest.doctorId !== doctorId) {
        return res.status(404).json({ error: 'Verification request not found' });
      }

      const editableStatuses = ['pending', 'in_progress', 'rejected'];
      const canEdit = editableStatuses.includes(verificationRequest.status);

      res.json({
        canEdit,
        currentStatus: verificationRequest.status,
        verificationInfo: {
          id: verificationRequest.id,
          licenseNumber: verificationRequest.licenseNumber,
          countryCode: verificationRequest.countryCode,
          issuingAuthority: verificationRequest.issuingAuthority,
          licenseType: verificationRequest.licenseType,
          issueDate: verificationRequest.issueDate,
          expiryDate: verificationRequest.expiryDate,
          submittedAt: verificationRequest.submittedAt,
          lastUpdatedAt: verificationRequest.updatedAt
        },
        editableFields: canEdit ? [
          'licenseNumber',
          'countryCode',
          'issuingAuthority',
          'licenseType',
          'issueDate',
          'expiryDate'
        ] : []
      });

    } catch (error) {
      console.error('Error getting editable verification info:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Upload verification documents
   * POST /api/doctor/verification/:id/documents
   */
  async uploadDocuments(req, res, next) {
    try {
      const { id: verificationRequestId } = req.params;
      const doctorId = req.user.sub;

      // Validate that files were processed by middleware
      if (!req.processedFiles || req.processedFiles.length === 0) {
        return res.status(400).json({
          error: 'No valid files were uploaded'
        });
      }

      const uploadedDocuments = [];
      const errors = [];

      // Upload each processed file
      for (const fileData of req.processedFiles) {
        try {
          const document = await doctorVerificationService.uploadVerificationDocument(
            verificationRequestId,
            fileData,
            doctorId
          );

          uploadedDocuments.push(document);
        } catch (docError) {
          console.error('Document upload error:', docError);
          errors.push(docError.message || 'Failed to upload document');
        }
      }

      if (uploadedDocuments.length === 0 && errors.length > 0) {
        return res.status(400).json({
          error: 'Failed to upload any documents',
          errors
        });
      }

      // Check if all required documents are now uploaded and update status accordingly
      // const verificationConfig = require('../../../config/verificationConfig');
      const allDocs = await verificationDocumentRepo.findByVerificationRequestId(verificationRequestId);
      const verification = await verificationRequestRepo.findById(verificationRequestId);
      const requiredDocs = verificationConfig.DOCUMENT_REQUIREMENTS[verification.tier] || [];

      let statusUpdate = null;
      let nextStep = null;

      // Handle status transition based on tier and document completeness
      if (verification.tier === 'tier_1') {
        // Tier 1: Documents are only uploaded if API failed, so move to manual review
        if (verification.status === 'pending_documents' &&
          requiredDocs.every(docType => allDocs.some(doc => doc.documentType === docType))) {
          await verificationRequestRepo.update(verificationRequestId, { status: 'manual_review' });
          statusUpdate = 'manual_review';
          nextStep = 'Your documents will be reviewed manually by our verification team.';
        }
      } else {
        // Tier 2/3: Move from pending_documents to pending (admin queue) when docs complete
        if (verification.status === 'pending_documents' &&
          requiredDocs.every(docType => allDocs.some(doc => doc.documentType === docType))) {
          await verificationRequestRepo.update(verificationRequestId, { status: 'pending' });
          statusUpdate = 'pending';
          nextStep = 'Your application is now complete and will be reviewed by our verification team.';
        }
      }

      // Prepare response
      const response = {
        message: `${uploadedDocuments.length} document(s) uploaded successfully`,
        documents: uploadedDocuments.map(doc => ({
          id: doc.id,
          documentType: doc.documentType,
          originalFileName: doc.originalFileName,
          status: doc.status,
          uploadedAt: doc.uploadedAt
        })),
        verificationStatus: statusUpdate || verification.status,
        documentsComplete: requiredDocs.every(docType => allDocs.some(doc => doc.documentType === docType)),
        requiredDocuments: requiredDocs,
        uploadedDocuments: allDocs.map(doc => doc.documentType),
        missingDocuments: requiredDocs.filter(docType => !allDocs.some(doc => doc.documentType === docType))
      };

      if (statusUpdate) {
        response.statusChanged = true;
        response.newStatus = statusUpdate;
        response.nextStep = nextStep;
      }

      if (errors.length > 0) {
        response.errors = errors;
      }

      res.status(201).json(response);

    } catch (error) {
      console.error('Error uploading documents:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Submit NIN (National Identification Number) for identity verification
   * POST /api/doctor/verification/:id/nin
   * Nigeria-specific — confirms the doctor's registered name matches the
   * government record for the NIN they submit.
   */
  async submitNin(req, res, next) {
    try {
      const { id: verificationRequestId } = req.params;
      const { nin } = req.body;
      const doctorId = req.user.sub;

      if (!nin || !/^\d{11}$/.test(nin)) {
        return res.status(400).json({
          error: 'A valid 11-digit NIN is required'
        });
      }

      const result = await doctorVerificationService.submitNinVerification(
        verificationRequestId,
        doctorId,
        nin
      );

      res.json({
        message: 'NIN submitted for verification',
        ninVerificationStatus: result.status,
        nameMatchScore: result.nameMatchScore,
        error: result.error
      });

    } catch (error) {
      console.error('Error submitting NIN:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get verification status
   * GET /api/doctor/verification/status
   */
  async getVerificationStatus(req, res, next) {
    try {
      const doctorId = req.user.sub;

      const verificationRequests = await doctorVerificationService.getVerificationRequestsByDoctor(doctorId);

      if (verificationRequests.length === 0) {
        return res.json({
          hasVerification: false,
          message: 'No verification requests found'
        });
      }

      // Get the most recent verification request
      const currentVerification = verificationRequests[0];

      res.json({
        hasVerification: true,
        currentVerification: {
          id: currentVerification.id,
          status: currentVerification.status,
          method: currentVerification.method,
          tier: currentVerification.tier,
          confidenceScore: currentVerification.confidenceScore,
          licenseNumber: currentVerification.licenseNumber,
          countryCode: currentVerification.countryCode,
          issuingAuthority: currentVerification.issuingAuthority,
          submittedAt: currentVerification.submittedAt,
          approvedAt: currentVerification.approvedAt,
          rejectedAt: currentVerification.rejectedAt,
          rejectionReason: currentVerification.rejectionReason,
          expiresAt: currentVerification.expiresAt,
          ninVerification: currentVerification.countryCode === 'NG' ? {
            status: currentVerification.ninVerificationStatus,
            nameMatchScore: currentVerification.ninNameMatchScore,
            submittedAt: currentVerification.ninSubmittedAt
          } : null,
          documents: currentVerification.documents?.map(doc => ({
            id: doc.id,
            documentType: doc.documentType,
            originalFileName: doc.originalFileName,
            status: doc.status,
            uploadedAt: doc.uploadedAt,
            verifiedAt: doc.verifiedAt
          })),
          statusHistory: currentVerification.statusHistory?.map(history => ({
            fromStatus: history.fromStatus,
            toStatus: history.toStatus,
            changedAt: history.changedAt,
            changeReason: history.changeReason,
            automatedChange: history.automatedChange
          }))
        },
        verificationHistory: verificationRequests.length > 1 ? verificationRequests.slice(1) : []
      });

    } catch (error) {
      console.error('Error getting verification status:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get verification history
   * GET /api/doctor/verification/history
   */
  async getVerificationHistory(req, res, next) {
    try {
      const doctorId = req.user.sub;
      const verificationRequests = await doctorVerificationService.getVerificationRequestsByDoctor(doctorId);

      res.json({
        history: verificationRequests.map(req => ({
          id: req.id,
          status: req.status,
          tier: req.tier,
          submittedAt: req.submittedAt,
          updatedAt: req.updatedAt
        }))
      });
    } catch (error) {
      console.error('Error getting verification history:', error);
      next(error);
    }
  }

  /**
   * Get supported countries
   * GET /api/doctor/verification/countries
   */
  async getSupportedCountries(req, res, next) {
    try {
      const countries = await countryConfigRepo.getSupportedCountries();

      const formattedCountries = countries.map(country => ({
        countryCode: country.countryCode,
        countryName: country.countryName,
        tier: country.tier,
        method: country.method,
        avgProcessingTime: formatProcessingTime(country.avgProcessingTime)
      }));

      res.json({
        countries: formattedCountries,
        totalSupported: formattedCountries.length
      });

    } catch (error) {
      console.error('Error getting supported countries:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }
  /**
 * Get verification requirements for country
 * GET /api/doctor/verification/countries/:countryCode/requirements
 */
  async getCountryRequirements(req, res, next) {
    try {
      const { countryCode } = req.params;

      const countryConfig = await countryConfigRepo.findByCountryCode(countryCode.toUpperCase());

      if (!countryConfig || !countryConfig.isActive) {
        return res.status(404).json({
          error: `Verification not supported for country: ${countryCode}`
        });
      }

      res.json({
        countryCode: countryConfig.countryCode,
        countryName: countryConfig.countryName,
        regulatoryBody: countryConfig.regulatoryBody,
        tier: countryConfig.tier,
        method: countryConfig.method,
        avgProcessingTime: formatProcessingTime(countryConfig.avgProcessingTime),
        maxProcessingTime: formatProcessingTime(countryConfig.maxProcessingTime),
        requiresManualReview: countryConfig.requiresManualReview,
        requiredDocuments: countryConfig.requiredDocuments || [],
        optionalDocuments: countryConfig.optionalDocuments || [],
        hasApi: countryConfig.hasApi,
        notes: countryConfig.notes
      });

    } catch (error) {
      console.error('Error getting country requirements:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Resubmit verification (for rejected/expired requests)
    * POST /api/doctor/verification/resubmit
  // UPDATED: Enhanced resubmitVerification method

  /**
   * Resubmit verification (for rejected/expired requests) - ENHANCED
   * POST /api/doctor/verification/resubmit
   */
  async resubmitVerification(req, res, next) {
    try {
      const doctorId = req.user.sub;

      // Check if doctor has a rejected or expired verification
      const existingRequests = await doctorVerificationService.getVerificationRequestsByDoctor(doctorId);
      const lastRequest = existingRequests[0];

      if (!lastRequest || !['rejected', 'expired'].includes(lastRequest.status)) {
        return res.status(400).json({
          error: 'No rejected or expired verification found. Cannot resubmit.',
          currentStatus: lastRequest?.status || 'none',
          canResubmit: false
        });
      }

      // Enhanced: Allow complete update of verification data on resubmission
      const {
        licenseNumber,
        countryCode,
        issuingAuthority,
        licenseType,
        issueDate,
        expiryDate,
        replaceDocuments // NEW: Option to replace all documents
      } = req.body;

      const verificationData = {
        licenseNumber: licenseNumber || lastRequest.licenseNumber,
        countryCode: countryCode || lastRequest.countryCode,
        issuingAuthority: issuingAuthority || lastRequest.issuingAuthority,
        licenseType: licenseType || lastRequest.licenseType,
        issueDate: issueDate ? new Date(issueDate) : lastRequest.issueDate,
        expiryDate: expiryDate ? new Date(expiryDate) : lastRequest.expiryDate
      };

      // Create new verification request
      const verificationRequest = await doctorVerificationService.submitVerificationRequest(
        doctorId,
        verificationData,
        doctorId
      );

      // Enhanced: Copy over documents from previous request if not replacing
      if (!replaceDocuments && lastRequest.documents && lastRequest.documents.length > 0) {
        await this.copyDocumentsToNewRequest(lastRequest.id, verificationRequest.id, doctorId);
      }

      // Log resubmission with reference to previous request
      await verificationStatusHistoryRepo.logStatusChange(
        verificationRequest.id,
        null,
        verificationRequest.status,
        doctorId,
        `Resubmitted after ${lastRequest.status} (Previous request: ${lastRequest.id})`,
        {
          previousRequestId: lastRequest.id,
          previousStatus: lastRequest.status,
          rejectionReason: lastRequest.rejectionReason,
          documentsCarriedOver: !replaceDocuments
        },
        false
      );

      res.status(201).json({
        message: 'Verification resubmitted successfully',
        verificationRequest: {
          id: verificationRequest.id,
          status: verificationRequest.status,
          method: verificationRequest.method,
          tier: verificationRequest.tier,
          submittedAt: verificationRequest.submittedAt,
          previousRequestId: lastRequest.id,
          documentsCarriedOver: !replaceDocuments
        },
        nextSteps: {
          canUploadDocuments: true,
          canEditInfo: true,
          estimatedProcessingTime: this.getProcessingTimeByTier(verificationRequest.tier)
        }
      });

    } catch (error) {
      console.error('Error resubmitting verification:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Helper method to copy documents from previous request
   */
  /**
   * Helper method to copy documents from previous request - FIXED
   */
  async copyDocumentsToNewRequest(oldRequestId, newRequestId, doctorId) {
    try {
      const oldDocuments = await verificationDocumentRepo.findByVerificationRequestId(oldRequestId);

      for (const oldDoc of oldDocuments) {
        // Create new document record pointing to same file
        const newDocumentData = {
          verificationRequestId: newRequestId,
          originalFileName: oldDoc.originalFileName,
          customDocumentName: oldDoc.customDocumentName || null,
          displayName: oldDoc.displayName || oldDoc.originalFileName,
          documentDescription: oldDoc.documentDescription || null,
          folderName: oldDoc.folderName || 'Verification Documents',
          storedFileName: oldDoc.storedFileName,
          filePath: oldDoc.filePath,
          fileSize: oldDoc.fileSize,
          mimeType: oldDoc.mimeType,
          fileHash: oldDoc.fileHash,
          encryptionKey: oldDoc.encryptionKey,
          documentType: oldDoc.documentType,
          documentCategory: oldDoc.documentCategory || 'Other',
          uploadedBy: doctorId,
          status: 'ready', // Reset status for new request
          isEncrypted: oldDoc.isEncrypted || false,
          securityLevel: oldDoc.securityLevel || 'private',

          // FHIR fields if they exist
          fhirResourceType: oldDoc.fhirResourceType || null,
          patientIdentifier: oldDoc.patientIdentifier || null,
          fhirSecurityLabels: oldDoc.fhirSecurityLabels || null,
          fhirVersion: oldDoc.fhirVersion || null,
          fhirSensitivityLevel: oldDoc.fhirSensitivityLevel || null,
          fhirResourceId: oldDoc.fhirResourceId || null,

          // Enhanced metadata for copied documents
          metadata: {
            ...oldDoc.metadata,
            copiedFromRequest: oldRequestId,
            copiedAt: new Date().toISOString(),
            originalUploadDate: oldDoc.uploadedAt,
            copyReason: 'resubmission',
            isDocumentCopy: true
          }
        };

        // Use the repository create method
        await verificationDocumentRepo.create(newDocumentData);
      }

      console.log(`Successfully copied ${oldDocuments.length} documents from request ${oldRequestId} to ${newRequestId}`);

    } catch (error) {
      console.error('Error copying documents to new request:', error);
      // Don't throw error, just log it - resubmission should still work even if document copying fails
    }
  }

  getProcessingTimeByTier(tier) {
    const times = {
      'tier_1': '2-4 hours',
      'tier_2': '1-3 days',
      'tier_3': '5-7 days'
    };
    return times[tier] || '5-7 days';
  }

  // Add this method to your DoctorVerificationController class

  /**
   * Get doctor onboarding status (Admin/Support only)
   * GET /api/admin/doctor/:doctorId/onboarding-status
   */
  async getDoctorOnboardingStatus(req, res, next) {
    try {
      const { doctorId } = req.params;

      // Add admin role check
      if (!['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const status = await doctorVerificationService.getDoctorOnboardingStatus(doctorId);

      res.json({
        message: 'Doctor onboarding status retrieved successfully',
        status
      });

    } catch (error) {
      console.error('Error getting doctor onboarding status:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
 * Fix doctor setup (Admin only)
 * POST /api/doctor/verification/admin/doctor/:doctorId/fix-setup
 */
  async fixDoctorSetup(req, res, next) {
    try {
      const { doctorId } = req.params;

      if (!['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const setupResult = await doctorVerificationService.setupDoctorFinancialProfile(doctorId);

      res.json({
        message: 'Doctor setup completed',
        result: setupResult
      });
    } catch (error) {
      console.error('Error fixing doctor setup:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Fix all incomplete setups (Admin only)
   * POST /api/doctor/verification/admin/fix-all-incomplete-setups
   */
  async fixAllIncompleteSetups(req, res, next) {
    try {
      if (!['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const result = await doctorVerificationService.fixIncompleteSetups();

      res.json({
        message: 'Incomplete setups fixed',
        result
      });
    } catch (error) {
      console.error('Error fixing incomplete setups:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

}

module.exports = new DoctorVerificationController();