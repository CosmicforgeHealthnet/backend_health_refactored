// src/services/doctorVerificationService.js
const verificationRequestRepo = require("../repositories/verificationRequestRepository");
const verificationDocumentRepo = require("../repositories/verificationDocumentRepository");
const verificationStatusHistoryRepo = require("../repositories/verificationStatusHistoryRepository");
const verificationApiLogRepo = require("../repositories/verificationApiLogRepository");
const countryConfigRepo = require("../repositories/countryVerificationConfigRepository");
const queueRepo = require("../repositories/verificationReviewQueueRepository");
const userRepository = require("../../auth/repositories/userRepository");
const doctorProfileRepo = require("../repositories/doctorProfileRepository");

// Enhanced imports for wallet and subscription integration
const doctorWalletRepository = require("../../payments/repositories/doctorWalletRepository");
const subscriptionRepository = require("../../subscriptions/repositories/subscriptionRepository");
const walletService = require("../../payments/services/walletService");
const subscriptionCompatibilityService = require("../../subscriptions/services/subscriptionCompatibilityService");

const { sendVerificationStatusEmail,
  sendDocumentUploadEmail,
  sendVerificationExpiryWarningEmail,
  sendVerificationReminderEmail,
} = require("../../../shared/services/email/emailHelpers");
const VerificationHelpers = require("../utils/verificationHelpers");
const apiConnectorService = require("./apiConnectorService");
const documentProcessingService = require("./documentProcessingService");
const ninVerificationService = require("./ninVerificationService");
const DocumentUploadMiddleware = require("../../documents/middlewares/documentUploadMiddleware");
const crypto = require("crypto");

const { VerificationStatus, NinVerificationStatus } = require("../entities/VerificationRequest");
const { getNotificationSocket } = require("../../../shared/utils/notificationUtils");

class DoctorVerificationService {

  /**
   * Send expiry warning for verification (called by scheduled job)
   */
  async sendVerificationExpiryWarning(verificationRequestId, daysUntilExpiry) {
    try {
      const verificationRequest = await verificationRequestRepo.findById(verificationRequestId, ['doctor']);
      if (!verificationRequest) {
        return;
      }

      const user = await userRepository.findById(verificationRequest.doctorId);
      if (user) {
        await sendVerificationExpiryWarningEmail(user, verificationRequest, daysUntilExpiry);
      }
    } catch (error) {
      console.error("Error sending expiry warning:", error);
    }
  }

  /**
   * Send reminder for pending verification (called by scheduled job)
   */
  async sendPendingVerificationReminder(verificationRequestId) {
    try {
      const verificationRequest = await verificationRequestRepo.findById(verificationRequestId, ['doctor']);
      if (!verificationRequest || verificationRequest.status !== VerificationStatus.PENDING) {
        return;
      }

      const user = await userRepository.findById(verificationRequest.doctorId);
      if (user) {
        await sendVerificationReminderEmail(user, verificationRequest);
      }
    } catch (error) {
      console.error("Error sending verification reminder:", error);
    }
  }

  /**
   * Submit a new verification request
   */
  async submitVerificationRequest(doctorId, verificationData, submittedBy = null) {
    try {
      // 1. Check if doctor already has active verification
      const existingRequest = await verificationRequestRepo.findActiveByDoctorId(doctorId);
      if (existingRequest) {
        const error = new Error("Doctor already has an active verification request");
        error.code = 'ACTIVE_REQUEST_EXISTS';
        error.statusCode = 400;
        throw error;
      }

      // 2. Get country configuration
      const countryConfig = await countryConfigRepo.findByCountryCode(verificationData.countryCode);
      if (!countryConfig || !countryConfig.isActive) {
        throw new Error(`Verification not supported for country: ${verificationData.countryCode}`);
      }

      // 3. Determine verification method and tier
      const verificationMethod = VerificationHelpers.determineVerificationMethod(
        verificationData.countryCode,
        [countryConfig]
      );

      // 4. Calculate SLA target
      const slaTarget = VerificationHelpers.calculateSlaTarget(
        verificationMethod.tier,
        new Date()
      );

      // 5. Create verification request
      const verificationRequest = await verificationRequestRepo.create({
        doctorId,
        licenseNumber: verificationData.licenseNumber,
        countryCode: verificationData.countryCode.toUpperCase(),
        issuingAuthority: verificationData.issuingAuthority || countryConfig.regulatoryBody,
        licenseType: verificationData.licenseType,
        issueDate: verificationData.issueDate,
        expiryDate: verificationData.expiryDate,
        status: VerificationStatus.PENDING,
        method: verificationMethod.method,
        tier: verificationMethod.tier,
        confidenceScore: 0,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        createdBy: submittedBy || doctorId
      });

      // 6. Log status change
      await verificationStatusHistoryRepo.logStatusChange(
        verificationRequest.id,
        null,
        VerificationStatus.PENDING,
        submittedBy || doctorId,
        "Initial verification request submitted",
        { countryConfig: countryConfig.countryCode, method: verificationMethod.method },
        true
      );

      // 7. Update doctor profile
      await this.updateDoctorProfileVerificationStatus(
        doctorId,
        "pending",
        verificationRequest.id,
        verificationMethod.tier
      );

      // 8. Add to review queue if manual review required
      if (verificationMethod.requiresManualReview || verificationMethod.method === 'manual') {
        const user = await userRepository.findById(doctorId);
        const priority = VerificationHelpers.determineQueuePriority(
          verificationRequest,
          user?.tier || 'free'
        );

        await queueRepo.addToQueue({
          verificationRequestId: verificationRequest.id,
          priority,
          slaTarget,
          complexity: this.determineComplexity(verificationMethod.tier)
        });
      }

      // 9. Send email notification
      await this.sendVerificationStatusNotification(
        doctorId,
        VerificationStatus.PENDING,
        verificationRequest,
        {
          estimatedProcessingTime: verificationMethod.avgProcessingTime,
          nextSteps: this.getNextStepsMessage(verificationMethod.method)
        }
      );

      // 10. Start automated verification only if the country has an active API endpoint
      // For 'hybrid' countries without an API (e.g. Nigeria tier_2, hasApi: false),
      // we DON'T call processApiVerification — the doctor must upload documents first.
      if (verificationMethod.method === 'automated' ||
          (verificationMethod.method === 'hybrid' && verificationMethod.apiProvider)) {
        // Queue for immediate API verification
        setImmediate(() => {
          this.processApiVerification(verificationRequest.id).catch(console.error);
        });
      }

      return verificationRequest;

    } catch (error) {
      console.error("Error submitting verification request:", error);
      throw error;
    }
  }

  /**
   * Process API verification
   */
  async processApiVerification(verificationRequestId) {
    try {
      const verificationRequest = await verificationRequestRepo.findById(verificationRequestId, ['doctor']);
      if (!verificationRequest) {
        throw new Error("Verification request not found");
      }

      // If the request is already waiting for documents or is in a terminal/manual state,
      // skip the API verification step — it is not applicable.
      const skipStatuses = [
        VerificationStatus.PENDING_DOCUMENTS,
        VerificationStatus.MANUAL_REVIEW,
        VerificationStatus.APPROVED,
        VerificationStatus.REJECTED,
      ];
      if (skipStatuses.includes(verificationRequest.status)) {
        console.log(
          `[processApiVerification] Skipping API verification for request ${verificationRequestId} ` +
          `— current status is '${verificationRequest.status}' which does not require API verification.`
        );
        return;
      }

      // Update status to API verification
      await this.updateVerificationStatus(
        verificationRequestId,
        VerificationStatus.API_VERIFICATION,
        'system',
        "Starting automated API verification"
      );

      // Get country configuration
      const countryConfig = await countryConfigRepo.findByCountryCode(verificationRequest.countryCode);

      // Call appropriate API
      const apiResult = await apiConnectorService.verifyDoctor(
        verificationRequest,
        countryConfig
      );

      // Calculate confidence score
      const confidenceScore = VerificationHelpers.calculateConfidenceScore(
        { apiVerified: true, documentsVerified: 0 },
        countryConfig,
        apiResult
      );

      // Update verification request with API results
      await verificationRequestRepo.update(verificationRequestId, {
        apiVerificationData: apiResult,
        apiVerifiedAt: new Date(),
        confidenceScore,
        apiErrors: apiResult.success ? null : apiResult.error
      });

      // Determine next step based on confidence score
      if (confidenceScore >= 85) {
        // Auto-approve high confidence verifications
        await this.approveVerification(verificationRequestId, 'system', 'Auto-approved based on high confidence API verification');
      } else if (confidenceScore >= 50) {
        // Send to manual review
        await this.updateVerificationStatus(
          verificationRequestId,
          VerificationStatus.MANUAL_REVIEW,
          'system',
          "API verification completed - requires manual review"
        );
      } else {
        // Auto-reject low confidence
        await this.rejectVerification(
          verificationRequestId,
          'system',
          'Auto-rejected due to low confidence score from API verification'
        );
      }

    } catch (error) {
      console.error("Error in API verification:", error);

      // Log the error and move to manual review
      await verificationApiLogRepo.logApiCall(
        verificationRequestId,
        'system',
        'api_verification',
        'POST',
        null,
        null,
        500,
        0,
        false,
        error.message,
        'system'
      );

      await this.updateVerificationStatus(
        verificationRequestId,
        VerificationStatus.MANUAL_REVIEW,
        'system',
        `API verification failed: ${error.message}`
      );
    }
  }

  /**
   * Upload verification document
   */
  async uploadVerificationDocument(verificationRequestId, documentData, uploadedBy) {
    try {
      // 1. Validate verification request exists and is active
      const verificationRequest = await verificationRequestRepo.findById(verificationRequestId);
      if (!verificationRequest) {
        throw new Error("Verification request not found");
      }

      // if (![VerificationStatus.MANUAL_REVIEW].includes(verificationRequest.status)) {
      //   throw new Error("Cannot upload documents to this verification request");
      // }

      // 2. Check for duplicates (same file hash)
      // const existingDoc = await verificationDocumentRepo.findOne({
      //   where: { 
      //     fileHash: documentData.fileHash,
      //     verificationRequestId: verificationRequestId
      //   }
      // });
      // if (existingDoc) {
      //   throw new Error("This document has already been uploaded for this verification request");
      // }

      // 3. Create document record
      const document = await verificationDocumentRepo.create({
        verificationRequestId,
        documentType: documentData.documentType,
        originalFileName: documentData.originalFileName,
        storedFileName: documentData.storedFileName,
        filePath: documentData.filePath,
        fileSize: documentData.fileSize,
        mimeType: documentData.mimeType,
        fileHash: documentData.fileHash,
        encryptionKey: documentData.encryptionKey,
        uploadedBy
      });

      // 4. Queue for OCR processing
      await documentProcessingService.queueForOcr(document.id);

      // 5. Update verification request status
      if (verificationRequest.status === VerificationStatus.PENDING ||
        verificationRequest.status === VerificationStatus.PENDING_DOCUMENTS) {
        await this.updateVerificationStatus(
          verificationRequestId,
          VerificationStatus.IN_PROGRESS,
          uploadedBy,
          "Document uploaded - processing started"
        );
      }

      // 6. Send notification
      await this.sendDocumentUploadNotification(verificationRequest.doctorId, document);

      return document;

    } catch (error) {
      console.error("Error uploading verification document:", error);
      throw error;
    }
  }

  /**
   * Submit and verify a doctor's NIN (National Identification Number).
   * Nigeria-specific identity check — confirms the government-registered name for
   * this NIN matches the doctor's name on the platform. A mismatch does NOT
   * auto-reject the verification request: it's surfaced to admins for manual
   * review, since legitimate mismatches happen (married names, spelling variants).
   * This does not currently block approval on its own — see NIN_VERIFICATION_REQUIREMENTS.md
   * for the pending grace-period/enforcement decision for doctors already on the platform.
   */
  async submitNinVerification(verificationRequestId, doctorId, nin) {
    try {
      const verificationRequest = await verificationRequestRepo.findById(verificationRequestId);
      if (!verificationRequest || verificationRequest.doctorId !== doctorId) {
        throw new Error("Verification request not found");
      }

      if (verificationRequest.countryCode !== 'NG') {
        throw new Error("NIN verification only applies to Nigeria");
      }

      const doctor = await userRepository.findById(doctorId);
      if (!doctor) {
        throw new Error("Doctor not found");
      }

      const result = await ninVerificationService.verifyNin(nin, doctor.fullName);

      const encryptionKey = crypto.randomBytes(32).toString('hex');
      const encryptedBuffer = DocumentUploadMiddleware.encryptBuffer(Buffer.from(nin, 'utf8'), encryptionKey);

      const updateData = {
        ninEncrypted: encryptedBuffer.toString('hex'),
        ninEncryptionKey: encryptionKey,
        ninLast4: nin.slice(-4),
        ninVerificationStatus: result.status,
        ninVerifiedData: result.providerData,
        ninNameMatchScore: result.nameMatchScore,
        ninSubmittedAt: new Date()
      };

      if (result.providerData) {
        updateData.ninVerifiedAt = new Date();
      }

      await verificationRequestRepo.update(verificationRequestId, updateData);

      // Info-only audit entry — doesn't change the verification request's own status
      await verificationStatusHistoryRepo.logStatusChange(
        verificationRequestId,
        verificationRequest.status,
        verificationRequest.status,
        doctorId,
        `NIN submitted — result: ${result.status}${result.nameMatchScore != null ? ` (name match ${result.nameMatchScore}%)` : ''}`,
        { ninVerificationStatus: result.status, nameMatchScore: result.nameMatchScore },
        false
      );

      try {
        const messages = {
          [NinVerificationStatus.VERIFIED]: "Your NIN has been verified and matches your registered name.",
          [NinVerificationStatus.MISMATCH]: "Your NIN was found, but the registered name didn't match — this will be reviewed by our team.",
          [NinVerificationStatus.FAILED]: "We couldn't verify your NIN. Please check the number and try again."
        };
        await getNotificationSocket().sendNotificationToUser(doctorId, {
          type: "info",
          message: messages[result.status] || "Your NIN verification has been processed.",
          metadata: {
            action: "nin_verification_result",
            verificationRequestId,
            status: result.status,
            link: "/doctor/verification"
          }
        });
      } catch (notifyError) {
        console.error("Error sending NIN verification notification:", notifyError);
      }

      return {
        status: result.status,
        nameMatchScore: result.nameMatchScore,
        error: result.error
      };

    } catch (error) {
      console.error("Error submitting NIN verification:", error);
      throw error;
    }
  }

  /**
   * ENHANCED: Approve verification with automatic wallet and subscription setup
   * WITH DEBUGGING
   */
  async approveVerification(verificationRequestId, approvedBy, approvalNotes = null) {
    try {
      // Add extensive debugging
      console.log(`🔍 Starting approval process for verification ID: ${verificationRequestId}`);
      console.log(`🔍 Approved by: ${approvedBy}`);
      console.log(`🔍 Approval notes: ${approvalNotes}`);

      // Validate input parameters
      if (!verificationRequestId) {
        console.error('❌ No verificationRequestId provided');
        throw new Error("Verification request ID is required");
      }

      // Try to find the verification request with debugging
      console.log(`🔍 Attempting to find verification request with ID: ${verificationRequestId}`);

      let verificationRequest;
      try {
        verificationRequest = await verificationRequestRepo.findById(verificationRequestId);
        console.log(`🔍 Database query result:`, verificationRequest ? 'FOUND' : 'NOT FOUND');

        if (verificationRequest) {
          console.log(`✅ Found verification request:`, {
            id: verificationRequest.id,
            doctorId: verificationRequest.doctorId,
            status: verificationRequest.status,
            countryCode: verificationRequest.countryCode
          });
        }
      } catch (dbError) {
        console.error('❌ Database error when finding verification request:', dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }

      if (!verificationRequest) {
        // Additional debugging: try to find any requests for this ID with different methods
        console.log(`🔍 Verification request not found. Checking if ID exists in database...`);

        try {
          // Try with relations to see if that helps
          const withRelations = await verificationRequestRepo.findById(verificationRequestId, ['doctor']);
          console.log(`🔍 With relations result:`, withRelations ? 'FOUND' : 'NOT FOUND');

          // Try to get all verification requests to see what IDs exist
          const allRequests = await verificationRequestRepo.repo.find({
            select: ['id', 'doctorId', 'status'],
            take: 10
          });
          console.log(`🔍 Sample of existing verification request IDs:`,
            allRequests.map(req => ({ id: req.id, doctorId: req.doctorId, status: req.status }))
          );

        } catch (debugError) {
          console.error('❌ Debug query failed:', debugError);
        }

        throw new Error(`Verification request not found with ID: ${verificationRequestId}`);
      }

      console.log(`🔄 Starting enhanced approval for doctor ${verificationRequest.doctorId}`);

      // Continue with existing approval logic...
      await verificationRequestRepo.updateStatus(
        verificationRequestId,
        VerificationStatus.APPROVED,
        approvedBy,
        approvalNotes
      );

      // Log status change
      await verificationStatusHistoryRepo.logStatusChange(
        verificationRequestId,
        verificationRequest.status,
        VerificationStatus.APPROVED,
        approvedBy,
        approvalNotes || "Verification approved",
        null,
        approvedBy === 'system'
      );

      // Update doctor profile and user status
      await this.updateDoctorProfileVerificationStatus(
        verificationRequest.doctorId,
        "verified",
        verificationRequestId,
        verificationRequest.tier,
        verificationRequest.confidenceScore
      );

      // Update user status to doctor_active
      const user = await userRepository.findById(verificationRequest.doctorId);
      if (user) {
        user.status = 'doctor_active';
        await userRepository.save(user);
      }

      // NEW: Sync verified license data and calculate years of experience
      await this.syncVerifiedDataToProfile(verificationRequest);

      // ENHANCED: Automatic wallet and subscription setup
      const setupResult = await this.setupDoctorFinancialProfile(verificationRequest.doctorId);
      console.log(`✅ Financial profile setup: ${JSON.stringify(setupResult)}`);

      // Remove from review queue
      await queueRepo.markCompleted(verificationRequestId);

      // Enhanced approval notification with wallet/subscription info
      await this.sendEnhancedApprovalNotification(
        verificationRequest.doctorId,
        verificationRequest,
        setupResult
      );

      return {
        verificationRequest,
        walletSetup: setupResult.wallet,
        subscriptionSetup: setupResult.subscription
      };

    } catch (error) {
      console.error("❌ Error approving verification:", error);
      console.error("❌ Error stack:", error.stack);
      throw error;
    }
  }

  /**
   * ENHANCED: Setup complete financial profile for approved doctor
   */
  async setupDoctorFinancialProfile(doctorId) {
    const setupResult = {
      wallet: { created: false, error: null, walletId: null },
      subscription: { created: false, error: null, subscriptionId: null }
    };

    try {
      // 1. Create doctor wallet if it doesn't exist
      const walletResult = await this.createDoctorWalletIfNotExists(doctorId);
      setupResult.wallet = walletResult;

      // 2. Setup default subscription if none exists
      const subscriptionResult = await this.setupDoctorSubscriptionIfNotExists(doctorId);
      setupResult.subscription = subscriptionResult;

      // 3. Sync wallet with subscription commission rate
      if (walletResult.walletId && subscriptionResult.subscriptionId) {
        await this.syncWalletWithSubscription(doctorId);
      }

      return setupResult;

    } catch (error) {
      console.error(`❌ Error setting up financial profile for doctor ${doctorId}:`, error);
      setupResult.wallet.error = setupResult.wallet.error || error.message;
      setupResult.subscription.error = setupResult.subscription.error || error.message;
      return setupResult;
    }
  }

  /**
   * ENHANCED: Create doctor wallet if it doesn't exist
   */
  async createDoctorWalletIfNotExists(doctorId) {
    try {
      const existingWallet = await doctorWalletRepository.findByDoctorId(doctorId);

      if (existingWallet) {
        return {
          created: false,
          message: `Wallet already exists for doctor ${doctorId}`,
          walletId: existingWallet.id,
          error: null
        };
      }

      // Create new wallet
      const wallet = await walletService.createDoctorWallet(doctorId);

      return {
        created: true,
        message: `Created new wallet for doctor ${doctorId}`,
        walletId: wallet.id,
        error: null
      };

    } catch (error) {
      console.error(`❌ Error creating wallet for doctor ${doctorId}:`, error);
      return {
        created: false,
        message: `Failed to create wallet: ${error.message}`,
        walletId: null,
        error: error.message
      };
    }
  }

  /**
   * ENHANCED: Setup default subscription for doctor if none exists
   */
  async setupDoctorSubscriptionIfNotExists(doctorId) {
    try {
      const existingSubscription = await subscriptionRepository.findActiveByUserId(doctorId);

      if (existingSubscription) {
        // Check if it needs migration to new format
        if (!existingSubscription.planType) {
          await subscriptionCompatibilityService.migrateLegacySubscription(doctorId);
          return {
            created: false,
            message: `Migrated existing subscription for doctor ${doctorId}`,
            tier: existingSubscription.tier,
            subscriptionId: existingSubscription.id,
            error: null
          };
        }

        return {
          created: false,
          message: `Subscription already exists for doctor ${doctorId}`,
          tier: existingSubscription.tier,
          subscriptionId: existingSubscription.id,
          error: null
        };
      }

      // Create default free subscription for doctor
      const defaultSubscription = {
        userId: doctorId,
        tier: 'free',
        planType: 'doctor',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        price: 0.00,
        currency: 'USD',
        autoRenew: false,
        commissionRate: 30.00, // Free plan commission
        features: [
          "chat_only",
          "regular_profile_listing",
          "standard_support"
        ],
        monthlyLimits: {
          maxPatients: 10,
          aiResponses: 50
        },
        currentUsage: {
          patients: 0,
          aiResponses: 0
        },
        familyMembers: 1,
        billingCycle: 'monthly',
        metadata: {
          createdOnApproval: true,
          createdAt: new Date().toISOString(),
          verificationIntegration: true
        }
      };

      const subscription = subscriptionRepository.create(defaultSubscription);
      const savedSubscription = await subscriptionRepository.save(subscription);

      return {
        created: true,
        message: `Created default free subscription for doctor ${doctorId}`,
        tier: savedSubscription.tier,
        subscriptionId: savedSubscription.id,
        error: null
      };

    } catch (error) {
      console.error(`❌ Error setting up subscription for doctor ${doctorId}:`, error);
      return {
        created: false,
        message: `Failed to setup subscription: ${error.message}`,
        tier: null,
        subscriptionId: null,
        error: error.message
      };
    }
  }

  /**
   * ENHANCED: Sync wallet commission rate with subscription
   */
  async syncWalletWithSubscription(doctorId) {
    try {
      const subscription = await subscriptionCompatibilityService.getUserSubscription(doctorId);
      const wallet = await doctorWalletRepository.findByDoctorId(doctorId);

      if (!wallet) {
        throw new Error('Wallet not found for doctor');
      }

      // Update wallet metadata with commission rate for easy access
      const walletMetadata = {
        ...wallet.metadata,
        commissionRate: subscription.commissionRate,
        subscriptionTier: subscription.tier,
        lastSyncedAt: new Date().toISOString(),
        syncedOnApproval: true
      };

      await doctorWalletRepository.repo.update(wallet.id, {
        metadata: walletMetadata,
        updatedAt: new Date()
      });

      console.log(`✅ Synced wallet with subscription for doctor ${doctorId}`);

    } catch (error) {
      console.error(`❌ Error syncing wallet with subscription for doctor ${doctorId}:`, error);
      // Don't throw error here as it's not critical for the approval process
    }
  }

  /**
   * ENHANCED: Enhanced approval notification with financial setup info
   */
  async sendEnhancedApprovalNotification(doctorId, verificationRequest, setupResult) {
    try {
      const user = await userRepository.findById(doctorId);
      if (!user) return;

      // Prepare enhanced notification data
      const enhancedData = {
        approvalDate: new Date(),
        confidenceScore: verificationRequest.confidenceScore,
        walletCreated: setupResult.wallet.created,
        subscriptionCreated: setupResult.subscription.created,
        commissionRate: 30, // Free plan default
        nextSteps: this.getEnhancedNextStepsMessage(setupResult)
      };

      // Send enhanced email notification
      await sendVerificationStatusEmail(user, VerificationStatus.APPROVED, verificationRequest, enhancedData);

      // Send enhanced real-time notification
      await getNotificationSocket().sendNotificationToUser(doctorId, {
        type: "verification_approved",
        message: "🎉 Congratulations! Your verification has been approved and your doctor profile is now active!",
        metadata: {
          action: "verification_approved",
          verificationRequestId: verificationRequest.id,
          status: VerificationStatus.APPROVED,
          walletSetup: setupResult.wallet.created,
          subscriptionSetup: setupResult.subscription.created,
          link: "/doctor/dashboard"
        }
      });

      // Send wallet setup notification if created
      if (setupResult.wallet.created) {
        await getNotificationSocket().sendNotificationToUser(doctorId, {
          type: "notification",
          message: "💰 Your doctor wallet has been automatically created and is ready to receive payments!",
          metadata: {
            action: "wallet_created",
            walletId: setupResult.wallet.walletId,
            commissionRate: 30,
            link: "/doctor/wallet"
          }
        });
      }

    } catch (error) {
      console.error("Error sending enhanced approval notification:", error);
      // Fallback to original notification
      await this.sendVerificationStatusNotification(
        doctorId,
        VerificationStatus.APPROVED,
        verificationRequest,
        {
          approvalDate: new Date(),
          confidenceScore: verificationRequest.confidenceScore,
          nextSteps: "You can now start offering consultations on CosmicForge Health!"
        }
      );
    }
  }

  /**
   * ENHANCED: Get enhanced next steps message based on setup result
   */
  getEnhancedNextStepsMessage(setupResult) {
    let message = "You can now start offering consultations on CosmicForge Health! ";

    if (setupResult.wallet.created) {
      message += "Your wallet has been created and is ready to receive payments. ";
    }

    if (setupResult.subscription.created) {
      message += "You're on the Free plan with a 30% commission rate. Upgrade anytime for better rates and features. ";
    }

    message += "Visit your dashboard to complete your profile and start accepting patients.";

    return message;
  }

  /**
   * ENHANCED: Get doctor onboarding status (for admin/support)
   */
  async getDoctorOnboardingStatus(doctorId) {
    try {
      const doctor = await userRepository.findById(doctorId);
      if (!doctor) {
        throw new Error('Doctor not found');
      }

      const verificationRequest = await verificationRequestRepo.findActiveByDoctorId(doctorId);
      const wallet = await doctorWalletRepository.findByDoctorId(doctorId);
      const subscription = await subscriptionRepository.findActiveByUserId(doctorId);

      return {
        doctorId,
        userStatus: doctor.status,
        verificationStatus: verificationRequest?.status || 'not_started',
        hasWallet: !!wallet,
        hasActiveSubscription: !!subscription,
        subscriptionTier: subscription?.tier || null,
        commissionRate: subscription?.commissionRate || null,
        isFullySetup: doctor.status === 'doctor_active' && !!wallet && !!subscription,
        verificationRequestId: verificationRequest?.id || null,
        walletId: wallet?.id || null,
        subscriptionId: subscription?.id || null
      };

    } catch (error) {
      console.error(`❌ Error getting onboarding status for doctor ${doctorId}:`, error);
      throw error;
    }
  }

  /**
   * ENHANCED: Fix incomplete doctor setups (for existing doctors)
   */
  async fixIncompleteSetups() {
    try {
      console.log('🔄 Finding doctors with incomplete setups...');

      // Find active doctors without complete financial setup
      const activeDoctors = await userRepository.repo.find({
        where: {
          role: 'doctor',
          status: 'doctor_active'
        }
      });

      const incompleteSetups = [];

      for (const doctor of activeDoctors) {
        const status = await this.getDoctorOnboardingStatus(doctor.id);

        if (!status.isFullySetup) {
          incompleteSetups.push({
            doctorId: doctor.id,
            missing: {
              wallet: !status.hasWallet,
              subscription: !status.hasActiveSubscription
            }
          });
        }
      }

      console.log(`Found ${incompleteSetups.length} doctors with incomplete setups`);

      const results = [];

      for (const incompleteSetup of incompleteSetups) {
        try {
          const setupResult = await this.setupDoctorFinancialProfile(incompleteSetup.doctorId);
          results.push({
            doctorId: incompleteSetup.doctorId,
            success: true,
            ...setupResult
          });
        } catch (error) {
          results.push({
            doctorId: incompleteSetup.doctorId,
            success: false,
            error: error.message
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log(`✅ Setup fix completed: ${successful} successful, ${failed} failed`);

      return {
        total: incompleteSetups.length,
        successful,
        failed,
        results
      };

    } catch (error) {
      console.error('❌ Error fixing incomplete setups:', error);
      throw error;
    }
  }

  /**
   * Reject verification with debugging
   */
  async rejectVerification(verificationRequestId, rejectedBy, rejectionReason) {
    try {
      // Add extensive debugging
      console.log(`🔍 Starting rejection process for verification ID: ${verificationRequestId}`);
      console.log(`🔍 Rejected by: ${rejectedBy}`);
      console.log(`🔍 Rejection reason: ${rejectionReason}`);

      // Validate input parameters
      if (!verificationRequestId) {
        console.error('❌ No verificationRequestId provided');
        throw new Error("Verification request ID is required");
      }

      if (!rejectionReason || rejectionReason.trim() === '') {
        console.error('❌ No rejection reason provided');
        throw new Error("Rejection reason is required");
      }

      // Try to find the verification request with debugging
      console.log(`🔍 Attempting to find verification request with ID: ${verificationRequestId}`);

      let verificationRequest;
      try {
        // First try without relations
        verificationRequest = await verificationRequestRepo.findById(verificationRequestId);
        console.log(`🔍 Database query result:`, verificationRequest ? 'FOUND' : 'NOT FOUND');

        if (verificationRequest) {
          console.log(`✅ Found verification request:`, {
            id: verificationRequest.id,
            doctorId: verificationRequest.doctorId,
            status: verificationRequest.status,
            countryCode: verificationRequest.countryCode,
            createdAt: verificationRequest.createdAt
          });
        } else {
          // Try with relations like in your original code
          console.log(`🔍 Trying with relations...`);
          verificationRequest = await verificationRequestRepo.findById(verificationRequestId, ['doctor']);
          console.log(`🔍 With relations result:`, verificationRequest ? 'FOUND' : 'NOT FOUND');
        }
      } catch (dbError) {
        console.error('❌ Database error when finding verification request:', dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }

      if (!verificationRequest) {
        // Additional debugging: check what verification requests exist
        console.log(`🔍 Verification request not found. Checking database contents...`);

        try {
          // Get recent verification requests
          const recentRequests = await verificationRequestRepo.repo.find({
            select: ['id', 'doctorId', 'status', 'createdAt'],
            order: { createdAt: 'DESC' },
            take: 10
          });
          console.log(`🔍 Recent verification requests:`,
            recentRequests.map(req => ({
              id: req.id,
              doctorId: req.doctorId,
              status: req.status,
              createdAt: req.createdAt
            }))
          );

          // Check if any request matches the ID pattern
          const similarId = recentRequests.find(req =>
            req.id.toString().includes(verificationRequestId.toString().slice(-4))
          );
          if (similarId) {
            console.log(`🔍 Found similar ID: ${similarId.id} (looking for: ${verificationRequestId})`);
          }

        } catch (debugError) {
          console.error('❌ Debug query failed:', debugError);
        }

        throw new Error(`Verification request not found with ID: ${verificationRequestId}`);
      }

      // Check if verification can be rejected
      const rejectableStatuses = [
        VerificationStatus.PENDING,
        VerificationStatus.IN_PROGRESS,
        VerificationStatus.MANUAL_REVIEW,
        VerificationStatus.API_VERIFICATION
      ];

      if (!rejectableStatuses.includes(verificationRequest.status)) {
        console.log(`❌ Cannot reject verification with status: ${verificationRequest.status}`);
        throw new Error(`Cannot reject verification with status: ${verificationRequest.status}`);
      }

      console.log(`🔄 Starting rejection for doctor ${verificationRequest.doctorId}`);

      // Update verification request
      console.log(`🔄 Updating verification status to REJECTED...`);
      await verificationRequestRepo.update(verificationRequestId, {
        status: VerificationStatus.REJECTED,
        rejectionReason,
        rejectedAt: new Date(),
        updatedBy: rejectedBy
      });

      // Log status change
      console.log(`🔄 Logging status change...`);
      await verificationStatusHistoryRepo.logStatusChange(
        verificationRequestId,
        verificationRequest.status,
        VerificationStatus.REJECTED,
        rejectedBy,
        rejectionReason,
        null,
        rejectedBy === 'system'
      );

      // Update doctor profile
      console.log(`🔄 Updating doctor profile...`);
      await this.updateDoctorProfileVerificationStatus(
        verificationRequest.doctorId,
        "rejected",
        verificationRequestId
      );

      // Remove from review queue
      console.log(`🔄 Removing from review queue...`);
      try {
        await queueRepo.markCompleted(verificationRequestId);
      } catch (queueError) {
        console.warn(`⚠️ Queue removal failed (non-critical):`, queueError.message);
      }

      // Send rejection notification
      console.log(`🔄 Sending rejection notification...`);
      await this.sendVerificationStatusNotification(
        verificationRequest.doctorId,
        VerificationStatus.REJECTED,
        verificationRequest,
        {
          rejectionReason,
          rejectionDate: new Date(),
          nextSteps: "You can submit a new verification request with updated documents."
        }
      );

      console.log(`✅ Verification rejection completed successfully`);
      return verificationRequest;

    } catch (error) {
      console.error("❌ Error rejecting verification:", error);
      console.error("❌ Error stack:", error.stack);
      throw error;
    }
  }

  /**
   * Update verification status with notifications
   */
  async updateVerificationStatus(verificationRequestId, newStatus, updatedBy, changeReason = null) {
    try {
      const verificationRequest = await verificationRequestRepo.findById(verificationRequestId);
      if (!verificationRequest) {
        throw new Error("Verification request not found");
      }

      const oldStatus = verificationRequest.status;

      // Validate status transition
      if (!VerificationHelpers.isStatusTransitionAllowed(oldStatus, newStatus)) {
        throw new Error(`Invalid status transition from ${oldStatus} to ${newStatus}`);
      }

      // Update status
      await verificationRequestRepo.updateStatus(verificationRequestId, newStatus, updatedBy, changeReason);

      // Log status change
      await verificationStatusHistoryRepo.logStatusChange(
        verificationRequestId,
        oldStatus,
        newStatus,
        updatedBy,
        changeReason,
        null,
        updatedBy === 'system'
      );

      // Update doctor profile if needed
      const profileStatus = this.mapVerificationStatusToProfileStatus(newStatus);
      if (profileStatus) {
        await this.updateDoctorProfileVerificationStatus(
          verificationRequest.doctorId,
          profileStatus,
          verificationRequestId
        );
      }

      // Send status update notification
      if (this.shouldNotifyStatusChange(oldStatus, newStatus)) {
        await this.sendVerificationStatusNotification(
          verificationRequest.doctorId,
          newStatus,
          verificationRequest,
          { changeReason, previousStatus: oldStatus }
        );
      }

      return verificationRequest;

    } catch (error) {
      console.error("Error updating verification status:", error);
      throw error;
    }
  }

  /**
   * Send verification status email notification
   */
  async sendVerificationStatusNotification(doctorId, status, verificationRequest, additionalData = {}) {
    try {
      const user = await userRepository.findById(doctorId);
      if (!user) return;

      // Send email notification
      await sendVerificationStatusEmail(user, status, verificationRequest, additionalData);

      // Send real-time notification
      await getNotificationSocket().sendNotificationToUser(doctorId, {
        type: "verification_status",
        message: this.getStatusMessage(status),
        metadata: {
          action: "verification_status_change",
          verificationRequestId: verificationRequest.id,
          status,
          link: "/doctor/verification"
        }
      });

    } catch (error) {
      console.error("Error sending verification notification:", error);
      // Don't throw - notification failure shouldn't break the main flow
    }
  }

  /**
   * Send document upload notification
   */
  async sendDocumentUploadNotification(doctorId, document) {
    // Get user for email
    const user = await userRepository.findById(doctorId);
    const verificationRequest = await verificationRequestRepo.findById(document.verificationRequestId);

    if (user && verificationRequest) {
      // Send email notification
      await sendDocumentUploadEmail(user, document, verificationRequest);
    }

    try {
      await getNotificationSocket().sendNotificationToUser(doctorId, {
        type: "info",
        message: `Document "${document.originalFileName}" uploaded successfully and is being processed.`,
        metadata: {
          action: "document_uploaded",
          documentId: document.id,
          documentType: document.documentType,
          link: "/doctor/verification"
        }
      });
    } catch (error) {
      console.error("Error sending document upload notification:", error);
    }
  }

  /**
   * Update doctor profile verification status
   */

  /**
   * Sync verified license data from the verification request to the public profile
   * This includes calculating years of experience from the issue date
   * @param {Object} verificationRequest - The approved verification request
   */
  async syncVerifiedDataToProfile(verificationRequest) {
    try {
      const doctorId = verificationRequest.doctorId;
      console.log(`🔄 Syncing verified data to profile for doctor: ${doctorId}`);
      
      // 1. Find the doctor profile with professional license relation
      const doctorProfile = await doctorProfileRepo.repo.findOne({
        where: { user: { id: doctorId } },
        relations: ['professionalLicense']
      });
      
      if (!doctorProfile) {
        console.warn(`⚠️ Doctor profile not found for ${doctorId} during sync`);
        return;
      }
      
      // 2. Calculate years of experience from the license issue date
      let yearsOfExperience = 0;
      if (verificationRequest.issueDate) {
        const issueYear = new Date(verificationRequest.issueDate).getFullYear();
        const currentYear = new Date().getFullYear();
        yearsOfExperience = Math.max(0, currentYear - issueYear);
        console.log(`📅 Calculated experience: ${yearsOfExperience} years (Issue Date: ${verificationRequest.issueDate})`);
      } else {
        console.log(`📅 No issue date found in verification, skipping experience calculation`);
      }
      
      // 3. Prepare the license data to be synced
      const licenseData = {
        medicalLicenseNumber: verificationRequest.licenseNumber,
        countryOfLicense: verificationRequest.countryCode,
        licenseAuthority: verificationRequest.issuingAuthority,
        licenseExpiryDate: verificationRequest.expiryDate,
        updatedAt: new Date()
      };

      // Only update yearsOfExperience if we successfully calculated it
      if (yearsOfExperience > 0 || verificationRequest.issueDate) {
        licenseData.yearsOfExperience = yearsOfExperience;
      }
      
      // 4. Update existing license or create a new one
      if (doctorProfile.professionalLicense) {
        console.log(`📝 Updating existing ProfessionalLicense ID: ${doctorProfile.professionalLicense.id}`);
        await doctorProfileRepo.professionalLicenseRepo.update(
          doctorProfile.professionalLicense.id, 
          licenseData
        );
      } else {
        console.log(`📝 Creating new ProfessionalLicense for profile ID: ${doctorProfile.id}`);
        const newLicense = doctorProfileRepo.professionalLicenseRepo.create({
          ...licenseData,
          doctorProfile: { id: doctorProfile.id }
        });
        await doctorProfileRepo.professionalLicenseRepo.save(newLicense);
      }
      
      console.log(`✅ Successfully synced verified license data and experience for doctor ${doctorId}`);
      
    } catch (error) {
      console.error(`❌ Error syncing verified data to profile for doctor ${verificationRequest.doctorId}:`, error);
    }
  }

  /**
   * Update doctor's profile verification status metadata
   */
  async updateDoctorProfileVerificationStatus(doctorId, status, verificationRequestId, tier = null, confidenceScore = null) {
    try {
      // Ensure profile exists first
      await doctorProfileRepo.createProfileIfNotExists(doctorId);

      const updateData = {
        verificationStatus: status,
        currentVerificationRequestId: verificationRequestId,
        lastVerificationAttempt: new Date()
      };

      if (status === 'verified') {
        updateData.lastVerificationSuccess = new Date();
        updateData.profileVerified = true;
      }

      if (tier) updateData.verificationTier = tier;
      if (confidenceScore) updateData.verificationConfidenceScore = confidenceScore;

      await doctorProfileRepo.updateByUserId(doctorId, updateData);

    } catch (error) {
      console.error("Error updating doctor profile verification status:", error);
    }
  }

  /**
   * Get verification request by ID
   */
  async getVerificationRequest(verificationRequestId, includeSensitive = false) {
    const relations = ['doctor', 'documents', 'statusHistory'];
    if (includeSensitive) {
      relations.push('assignedReviewer');
    }

    return await verificationRequestRepo.findById(verificationRequestId, relations);
  }

  /**
   * Get verification requests by doctor
   */
  async getVerificationRequestsByDoctor(doctorId) {
    return await verificationRequestRepo.findByDoctorId(doctorId, ['documents', 'statusHistory']);
  }

  /**
   * Get verification statistics
   */
  async getVerificationStatistics(startDate = null, endDate = null) {
    const stats = await verificationRequestRepo.getStatistics(startDate, endDate);
    const queueStats = await queueRepo.getQueueStatistics();
    const apiStats = await verificationApiLogRepo.getPerformanceStats();

    return {
      verificationStats: stats,
      queueStats,
      apiStats,
      summary: {
        totalRequests: stats.reduce((sum, stat) => sum + parseInt(stat.count), 0),
        avgConfidenceScore: stats.reduce((sum, stat) => sum + parseFloat(stat.avgconfidence || 0), 0) / stats.length,
        pendingReviews: queueStats.reduce((sum, stat) => sum + parseInt(stat.count), 0)
      }
    };
  }

  // Helper methods
  determineComplexity(tier) {
    const complexityMap = {
      'tier_1': 'simple',
      'tier_2': 'moderate',
      'tier_3': 'complex'
    };
    return complexityMap[tier] || 'moderate';
  }

  mapVerificationStatusToProfileStatus(verificationStatus) {
    const statusMap = {
      [VerificationStatus.PENDING]: 'pending',
      [VerificationStatus.IN_PROGRESS]: 'pending',
      [VerificationStatus.API_VERIFICATION]: 'in_progress',
      [VerificationStatus.MANUAL_REVIEW]: 'in_progress',
      [VerificationStatus.APPROVED]: 'verified',
      [VerificationStatus.REJECTED]: 'rejected',
      [VerificationStatus.EXPIRED]: 'rejected'
    };
    return statusMap[verificationStatus];
  }

  shouldNotifyStatusChange(oldStatus, newStatus) {
    // Notify on major status changes
    const majorStatuses = [
      VerificationStatus.APPROVED,
      VerificationStatus.REJECTED,
      VerificationStatus.MANUAL_REVIEW
    ];
    return majorStatuses.includes(newStatus);
  }

  getStatusMessage(status) {
    const messages = {
      [VerificationStatus.PENDING]: "Your verification request has been submitted and is pending review.",
      [VerificationStatus.IN_PROGRESS]: "Your verification is in progress. We're reviewing your documents.",
      [VerificationStatus.API_VERIFICATION]: "We're automatically verifying your credentials with official sources.",
      [VerificationStatus.MANUAL_REVIEW]: "Your verification is under manual review by our team.",
      [VerificationStatus.APPROVED]: "Congratulations! Your verification has been approved. You can now offer consultations.",
      [VerificationStatus.REJECTED]: "Your verification request has been rejected. Please review the feedback and resubmit.",
      [VerificationStatus.EXPIRED]: "Your verification request has expired. Please submit a new request."
    };
    return messages[status] || "Your verification status has been updated.";
  }

  getNextStepsMessage(method) {
    const messages = {
      'automated': "We'll verify your credentials automatically within 24 hours.",
      'manual': "Our team will manually review your documents within 5-7 business days.",
      'hybrid': "We'll first attempt automatic verification, then manual review if needed."
    };
    return messages[method] || "We'll process your verification request soon.";
  }
}

module.exports = new DoctorVerificationService();