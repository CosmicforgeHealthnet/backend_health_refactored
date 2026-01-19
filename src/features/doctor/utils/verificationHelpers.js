// src/features/doctor/utils/verificationHelpers.js
const config = require('../../../config/verificationConfig');

class VerificationHelpers {

    /**
     * Calculate confidence score based on verification data
     */
    static calculateConfidenceScore(verificationData, countryConfig, apiResult = null) {
        let score = 0;

        // Base score by tier
        const tierScores = config.CONFIDENCE_WEIGHTINGS.BASE_TIER_SCORE;
        score += tierScores[countryConfig.tier] || 0;

        // API verification adds significant confidence
        if (apiResult && apiResult.success) {
            score += config.CONFIDENCE_WEIGHTINGS.API_SUCCESS_BONUS;
            if (apiResult.confidence) {
                score += apiResult.confidence * config.CONFIDENCE_WEIGHTINGS.API_CONFIDENCE_MULTIPLIER;
            }
        }

        // Document verification
        if (verificationData.documentsVerified) {
            const docPoints = Math.min(
                verificationData.documentsVerified * config.CONFIDENCE_WEIGHTINGS.DOCUMENT_VERIFICATION_POINTS,
                25
            );
            score += docPoints;
        }

        // Manual review adds confidence
        if (verificationData.manuallyReviewed) {
            score += config.CONFIDENCE_WEIGHTINGS.MANUAL_REVIEW_BONUS;
        }

        // Cross-reference checks
        if (verificationData.crossReferencesValid) {
            score += config.CONFIDENCE_WEIGHTINGS.CROSS_REFERENCE_BONUS;
        }

        return Math.min(Math.round(score), 100);
    }

    /**
     * Determine verification method based on country config
     */
    static determineVerificationMethod(countryCode, countryConfigs) {
        const config = countryConfigs.find(c => c.countryCode === countryCode);
        if (!config) {
            return {
                method: 'manual',
                tier: 'tier_3',
                requiresManualReview: true,
                avgProcessingTime: 168
            };
        }

        return {
            method: config.method,
            tier: config.tier,
            requiresManualReview: config.requiresManualReview,
            apiProvider: config.apiProvider,
            avgProcessingTime: config.avgProcessingTime
        };
    }

    /**
     * Calculate SLA target timestamp
     */
    static calculateSlaTarget(tier, submittedAt = new Date()) {
        const hoursToAdd = config.SLA_TARGETS[tier] || config.SLA_TARGETS.tier_3;
        const target = new Date(submittedAt);
        target.setHours(target.getHours() + hoursToAdd);
        return target;
    }

    /**
     * Determine queue priority
     */
    static determineQueuePriority(verificationRequest, userTier = 'free') {
        // Premium users get urgent priority
        if (userTier === 'premium') {
            return 'urgent';
        }

        // Resubmissions get high priority
        if (verificationRequest.attempt > 1) {
            return 'high';
        }

        // Default by tier
        return config.QUEUE_PRIORITY_RULES[verificationRequest.tier] || config.QUEUE_PRIORITY_RULES.default;
    }

    /**
     * Check if status transition is allowed
     */
    static isStatusTransitionAllowed(fromStatus, toStatus) {
        const allowedTransitions = config.ALLOWED_STATUS_TRANSITIONS[fromStatus] || [];
        return allowedTransitions.includes(toStatus);
    }

    /**
     * Get required documents for country/tier
     */
    static getRequiredDocuments(countryConfig) {
        const tierRequirements = config.DOCUMENT_REQUIREMENTS[countryConfig.tier] || [];
        const countryRequirements = countryConfig.requiredDocuments || [];

        // Merge and deduplicate
        return [...new Set([...tierRequirements, ...countryRequirements])];
    }

    /**
     * Get optional documents for country/tier
     */
    static getOptionalDocuments(countryConfig) {
        const tierOptional = config.OPTIONAL_DOCUMENTS[countryConfig.tier] || [];
        const countryOptional = countryConfig.optionalDocuments || [];

        // Merge and deduplicate
        return [...new Set([...tierOptional, ...countryOptional])];
    }

    /**
     * Validate uploaded documents against requirements
     */
    static validateDocuments(uploadedDocuments, requiredDocuments) {
        const uploadedTypes = uploadedDocuments.map(doc => doc.documentType);
        const missing = requiredDocuments.filter(req => !uploadedTypes.includes(req));

        return {
            isValid: missing.length === 0,
            missingDocuments: missing,
            uploadedCount: uploadedDocuments.length,
            requiredCount: requiredDocuments.length,
            completionPercentage: Math.round((uploadedDocuments.length / requiredDocuments.length) * 100)
        };
    }

    /**
     * Check if verification can be auto-approved
     */
    static canAutoApprove(confidenceScore) {
        return confidenceScore >= config.CONFIDENCE_THRESHOLDS.AUTO_APPROVE;
    }

    /**
     * Check if verification should go to manual review
     */
    static requiresManualReview(confidenceScore) {
        return confidenceScore >= config.CONFIDENCE_THRESHOLDS.MANUAL_REVIEW &&
            confidenceScore < config.CONFIDENCE_THRESHOLDS.AUTO_APPROVE;
    }

    /**
     * Check if verification should be auto-rejected
     */
    static shouldAutoReject(confidenceScore) {
        return confidenceScore < config.CONFIDENCE_THRESHOLDS.AUTO_REJECT;
    }

    /**
     * Calculate verification expiry date
     */
    static calculateExpiryDate(submittedAt = new Date(), tier = 'tier_3') {
        const hoursToAdd = config.VERIFICATION_TIMEOUTS[tier] || config.VERIFICATION_TIMEOUTS.tier_3;
        const expiry = new Date(submittedAt);
        expiry.setHours(expiry.getHours() + hoursToAdd);
        return expiry;
    }

    /**
     * Check if verification is near expiry
     */
    static isNearExpiry(expiryDate, warningDays = 7) {
        const now = new Date();
        const timeUntilExpiry = expiryDate.getTime() - now.getTime();
        const daysUntilExpiry = Math.ceil(timeUntilExpiry / (1000 * 60 * 60 * 24));

        return {
            isNearExpiry: daysUntilExpiry <= warningDays && daysUntilExpiry > 0,
            daysUntilExpiry,
            isExpired: daysUntilExpiry <= 0
        };
    }

    /**
     * Validate file upload
     */
    static validateFileUpload(file) {
        const errors = [];

        // Check file size
        if (file.size > config.FILE_LIMITS.MAX_FILE_SIZE) {
            errors.push(`File size exceeds maximum of ${config.FILE_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB`);
        }

        // Check file type
        if (!config.FILE_LIMITS.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            errors.push(`File type ${file.mimetype} is not allowed`);
        }

        // Check file extension
        const ext = file.originalname.toLowerCase().split('.').pop();
        const allowedExts = config.FILE_LIMITS.ALLOWED_EXTENSIONS.map(e => e.replace('.', ''));
        if (!allowedExts.includes(ext)) {
            errors.push(`File extension .${ext} is not allowed`);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Format processing time for display
     */
    static formatProcessingTime(hours) {
        if (!hours) return 'Not specified';

        if (hours < 1) {
            const minutes = Math.round(hours * 60);
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }

        if (hours < 24) {
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        }

        const days = Math.round(hours / 24);
        return `${days} day${days !== 1 ? 's' : ''}`;
    }

    /**
     * Get verification method description
     */
    static getMethodDescription(method) {
        const descriptions = {
            'automated': 'Automated verification through official APIs',
            'manual': 'Manual verification by our expert team',
            'hybrid': 'Combination of automated and manual verification'
        };

        return descriptions[method] || 'Standard verification process';
    }

    /**
     * Get tier description
     */
    static getTierDescription(tier) {
        const descriptions = {
            'tier_1': 'Fast track verification (API supported)',
            'tier_2': 'Standard verification (hybrid approach)',
            'tier_3': 'Comprehensive verification (manual review)'
        };

        return descriptions[tier] || 'Standard verification process';
    }
}

module.exports = VerificationHelpers;
