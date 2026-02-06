// src/config/verificationConfig.js
module.exports = {
  // Verification timeouts (in hours)
  VERIFICATION_TIMEOUTS: {
    tier_1: 24,   // 1 day for automated
    tier_2: 168,  // 7 days for hybrid  
    tier_3: 336   // 14 days for manual
  },

  // SLA targets (in hours)
  SLA_TARGETS: {
    tier_1: 4,    // 4 hours
    tier_2: 72,   // 3 days
    tier_3: 168   // 7 days
  },

  // Confidence score thresholds
  CONFIDENCE_THRESHOLDS: {
    AUTO_APPROVE: 85,     // Auto-approve if score >= 85
    MANUAL_REVIEW: 50,    // Manual review if score >= 50
    AUTO_REJECT: 30       // Auto-reject if score < 30
  },

  // File upload limits
  FILE_LIMITS: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_FILES_PER_REQUEST: 10,
    ALLOWED_MIME_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    ALLOWED_EXTENSIONS: ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif', '.doc', '.docx']
  },

  // API rate limits (requests per hour)
  API_RATE_LIMITS: {
    mdcn_nigeria: 100,
    hpcsa_south_africa: 500,
    kmpdc_kenya: 200,
    mdc_ghana: 50,
    surepass: 1000,
    idfy: 800,
    default: 100
  },

  // Queue priorities based on various factors
  QUEUE_PRIORITY_RULES: {
    // Higher tier = higher priority
    tier_1: 'high',
    tier_2: 'normal',
    tier_3: 'low',

    // Urgent for premium users
    premium_user: 'urgent',

    // High priority for resubmissions
    resubmission: 'high',

    // Default priority
    default: 'normal'
  },

  // Status transition rules
  ALLOWED_STATUS_TRANSITIONS: {
    pending: ['in_progress', 'api_verification', 'manual_review', 'expired'],
    in_progress: ['api_verification', 'manual_review', 'approved', 'rejected'],
    api_verification: ['approved', 'rejected', 'manual_review'],
    manual_review: ['approved', 'rejected'],
    approved: [], // Terminal state
    rejected: ['pending'], // Can resubmit
    expired: ['pending'] // Can resubmit
  },

  // Required documents by country tier
  DOCUMENT_REQUIREMENTS: {
    tier_1: ['medical_license', 'government_id'],
    tier_2: ['medical_license', 'medical_degree', 'government_id'],
    tier_3: ['medical_license', 'medical_degree', 'government_id', 'proof_of_practice']
  },

  // Optional documents by tier
  OPTIONAL_DOCUMENTS: {
    tier_1: ['board_certification', 'good_standing_certificate'],
    tier_2: ['board_certification', 'postgraduate_certificate', 'good_standing_certificate'],
    tier_3: ['board_certification', 'postgraduate_certificate', 'good_standing_certificate', 'proof_of_practice']
  },

  // Email notification triggers
  NOTIFICATION_TRIGGERS: {
    status_change: true,
    document_upload: true,
    verification_approved: true,
    verification_rejected: true,
    sla_breach_warning: true,
    escalation: true,
    expiry_warning: true
  },

  // Expiry warning days
  EXPIRY_WARNING_DAYS: [30, 14, 7, 3, 1], // Days before expiry to send warnings

  // Verification attempt limits
  MAX_VERIFICATION_ATTEMPTS: 3,
  VERIFICATION_COOLDOWN_HOURS: 24, // Hours to wait between failed attempts

  // OCR and AI processing settings
  PROCESSING_SETTINGS: {
    OCR_CONFIDENCE_THRESHOLD: 70,
    AI_FRAUD_RISK_THRESHOLD: 70,
    AI_AUTHENTICITY_THRESHOLD: 80,
    PROCESSING_TIMEOUT_MINUTES: 30
  },

  // Country tier configurations
  COUNTRY_TIERS: {
    // Tier 1: High confidence, API available
    tier_1: {
      countries: ['ZA', 'KE'], // South Africa, Kenya
      method: 'automated',
      avgProcessingTime: 2, // hours
      hasApi: true,
      requiresManualReview: false
    },

    // Tier 2: Medium confidence, hybrid approach
    tier_2: {
      countries: ['NG', 'GH', 'TZ', 'UG'], // Nigeria, Ghana, Tanzania, Uganda
      method: 'hybrid',
      avgProcessingTime: 72, // hours
      hasApi: false,
      requiresManualReview: true
    },

    // Tier 3: Lower confidence, manual only
    tier_3: {
      countries: ['ET', 'ZM', 'ZW'], // Ethiopia, Zambia, Zimbabwe
      method: 'manual',
      avgProcessingTime: 168, // hours
      hasApi: false,
      requiresManualReview: true
    }
  },

  // API endpoints (defaults)
  API_ENDPOINTS: {
    hpcsa_south_africa: 'https://api.hpcsa.co.za/verify',
    kmpdc_kenya: 'https://api.kmpdc.go.ke/verify',
    surepass: 'https://api.surepass.io/doctor-verification',
    idfy: 'https://api.idfy.com/doctor-verification'
  },

  // Confidence score weightings
  CONFIDENCE_WEIGHTINGS: {
    BASE_TIER_SCORE: {
      tier_1: 40,
      tier_2: 25,
      tier_3: 15
    },
    API_SUCCESS_BONUS: 35,
    API_CONFIDENCE_MULTIPLIER: 0.2, // Max 20 points from API confidence
    DOCUMENT_VERIFICATION_POINTS: 5, // Per verified document, max 25
    MANUAL_REVIEW_BONUS: 15,
    CROSS_REFERENCE_BONUS: 10
  }
};
