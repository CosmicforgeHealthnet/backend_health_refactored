// ===================================
// middlewares/validationMiddleware.js
// ===================================
const { body, param, query, validationResult } = require('express-validator');

// ===================================
// ACCOUNT SUPPORT VALIDATION MIDDLEWARE
// ===================================
const validateCreateAccountTicket = [
  // Core Identifiers
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),

  // Issue Information
  body('issueType')
    .notEmpty()
    .withMessage('Issue type is required')
    .isIn([
      'account_information_error',
      'dependent_account_issue',
      'unable_to_update_profile',
      'deactivation_request',
      'double_accounts_conflict'
    ])
    .withMessage('Invalid issue type'),

  // Description and Documentation
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters')
    .trim()
    .escape(),

  body('screenshotUrl')
    .optional()
    .isURL()
    .withMessage('Screenshot URL must be a valid URL')
    .isLength({ max: 500 })
    .withMessage('Screenshot URL must not exceed 500 characters'),

  // Priority and Status Management
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level'),

  body('status')
    .optional()
    .isIn(['pending', 'in_progress', 'resolved', 'closed'])
    .withMessage('Invalid status'),

  // Custom validation for issue-specific requirements
  body()
    .custom((value, { req }) => {
      const { issueType, description } = req.body;

      // For certain critical issues, description should be more detailed
      if (['deactivation_request', 'double_accounts_conflict'].includes(issueType)) {
        if (!description || description.trim().length < 20) {
          throw new Error('Detailed description (minimum 20 characters) is required for this issue type');
        }
      }

      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateUpdateAccountTicket = [
  body('issueType')
    .optional()
    .isIn([
      'account_information_error',
      'dependent_account_issue',
      'unable_to_update_profile',
      'deactivation_request',
      'double_accounts_conflict'
    ])
    .withMessage('Invalid issue type'),

  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters')
    .trim()
    .escape(),

  body('screenshotUrl')
    .optional()
    .isURL()
    .withMessage('Screenshot URL must be a valid URL')
    .isLength({ max: 500 })
    .withMessage('Screenshot URL must not exceed 500 characters'),

  body('status')
    .optional()
    .isIn(['pending', 'in_progress', 'resolved', 'closed'])
    .withMessage('Invalid status'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level'),

  body('assignedTo')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Assigned to must not exceed 255 characters')
    .trim()
    .escape(),

  body('resolutionNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Resolution notes must not exceed 1000 characters')
    .trim()
    .escape(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateAssignTicket = [
  body('assignedTo')
    .notEmpty()
    .withMessage('Assigned to field is required')
    .isLength({ min: 2, max: 255 })
    .withMessage('Assigned to must be between 2 and 255 characters')
    .trim()
    .escape(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateResolveTicket = [
  body('resolutionNotes')
    .notEmpty()
    .withMessage('Resolution notes are required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Resolution notes must be between 10 and 1000 characters')
    .trim()
    .escape(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];


// ===================================
// INSURANCE VALIDATION MIDDLEWARE
// ===================================

const validateCreateInsurance = [
  // Core Identifiers
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),

  // Issue Information
  body('issueType')
    .notEmpty()
    .withMessage('Issue type is required')
    .isIn([
      'insurance_not_recognized',
      'policy_details_incorrect',
      'claim_status_delay',
      'coverage_rejected',
      'upload_document_error',
      'wrong_billing'
    ])
    .withMessage('Invalid issue type'),

  body('insuranceProviderName')
    .optional()
    .isLength({ min: 2, max: 255 })
    .withMessage('Insurance provider name must be between 2 and 255 characters')
    .trim()
    .escape(),

  body('policyNumber')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Policy number must be between 1 and 100 characters')
    .trim()
    .escape(),

  body('serviceAffected')
    .optional()
    .isIn(['consultation', 'lab', 'pharmacy'])
    .withMessage('Service affected must be consultation, lab, or pharmacy'),

  // Description and Documentation
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters')
    .trim()
    .escape(),

  body('screenshotUrl')
    .optional()
    .isURL()
    .withMessage('Screenshot URL must be a valid URL')
    .isLength({ max: 500 })
    .withMessage('Screenshot URL must not exceed 500 characters'),

  // Status Management
  body('status')
    .optional()
    .isIn(['pending', 'in_progress', 'resolved', 'closed'])
    .withMessage('Invalid status'),

  // Custom validation for issue-specific required fields
  body()
    .custom((value, { req }) => {
      const { issueType, insuranceProviderName, policyNumber, serviceAffected } = req.body;

      // If issue type requires insurance provider name
      if (['insurance_not_recognized', 'policy_details_incorrect', 'claim_status_delay', 'coverage_rejected'].includes(issueType)) {
        if (!insuranceProviderName || insuranceProviderName.trim().length === 0) {
          throw new Error('Insurance provider name is required for this issue type');
        }
      }

      // If issue type requires policy number
      if (['policy_details_incorrect', 'claim_status_delay', 'coverage_rejected'].includes(issueType)) {
        if (!policyNumber || policyNumber.trim().length === 0) {
          throw new Error('Policy number is required for this issue type');
        }
      }

      // If issue type requires service affected
      if (['coverage_rejected', 'wrong_billing'].includes(issueType)) {
        if (!serviceAffected) {
          throw new Error('Service affected is required for this issue type');
        }
      }

      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateUpdateInsurance = [
  body('issueType')
    .optional()
    .isIn([
      'insurance_not_recognized',
      'policy_details_incorrect',
      'claim_status_delay',
      'coverage_rejected',
      'upload_document_error',
      'wrong_billing'
    ])
    .withMessage('Invalid issue type'),

  body('insuranceProviderName')
    .optional()
    .isLength({ min: 2, max: 255 })
    .withMessage('Insurance provider name must be between 2 and 255 characters')
    .trim()
    .escape(),

  body('policyNumber')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Policy number must be between 1 and 100 characters')
    .trim()
    .escape(),

  body('serviceAffected')
    .optional()
    .isIn(['consultation', 'lab', 'pharmacy'])
    .withMessage('Service affected must be consultation, lab, or pharmacy'),

  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters')
    .trim()
    .escape(),

  body('screenshotUrl')
    .optional()
    .isURL()
    .withMessage('Screenshot URL must be a valid URL')
    .isLength({ max: 500 })
    .withMessage('Screenshot URL must not exceed 500 characters'),

  body('status')
    .optional()
    .isIn(['pending', 'in_progress', 'resolved', 'closed'])
    .withMessage('Invalid status'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

// ===================================
// REPORT VALIDATION MIDDLEWARE
// ===================================

const validateCreateReport = [
  // Core Identifiers
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),

  body('providerId')
    .notEmpty()
    .withMessage('Provider ID is required')
    .isUUID()
    .withMessage('Provider ID must be a valid UUID'),

  // Provider and Issue Information
  body('providerType')
    .notEmpty()
    .withMessage('Provider type is required')
    .isIn(['healthcare_provider', 'lab', 'pharmacy'])
    .withMessage('Provider type must be healthcare_provider, lab, or pharmacy'),

  body('issueType')
    .notEmpty()
    .withMessage('Issue type is required')
    .isIn([
      'unprofessional_behavior',
      'harassment_verbal_abuse',
      'medical_negligence',
      'fraud_fake_profile',
      'wrong_diagnosis',
      'appointment_issues',
      'prescription_error',
      'privacy_violation',
      'wrong_lab_result',
      'lab_misconduct',
      'pharmacy_misconduct'
    ])
    .withMessage('Invalid issue type'),

  // Description and Documentation
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters')
    .trim()
    .escape(),

  body('screenshotUrl')
    .optional()
    .isURL()
    .withMessage('Screenshot URL must be a valid URL')
    .isLength({ max: 500 })
    .withMessage('Screenshot URL must not exceed 500 characters'),

  // Status Management
  body('status')
    .optional()
    .isIn(['pending', 'under_review', 'resolved', 'closed'])
    .withMessage('Invalid status'),

  // Custom validation for provider-specific issue types
  body()
    .custom((value, { req }) => {
      const { issueType, providerType } = req.body;

      // Define valid issue types for each provider type
      const doctorIssues = [
        'unprofessional_behavior',
        'harassment_verbal_abuse',
        'medical_negligence',
        'fraud_fake_profile',
        'wrong_diagnosis',
        'appointment_issues',
        'prescription_error',
        'privacy_violation'
      ];

      const labIssues = [
        'unprofessional_behavior',
        'harassment_verbal_abuse',
        'fraud_fake_profile',
        'wrong_lab_result',
        'lab_misconduct',
        'privacy_violation'
      ];

      const pharmacyIssues = [
        'unprofessional_behavior',
        'harassment_verbal_abuse',
        'fraud_fake_profile',
        'prescription_error',
        'pharmacy_misconduct',
        'privacy_violation'
      ];

      // Validate issue type based on provider type
      if (providerType === 'healthcare_provider' && !doctorIssues.includes(issueType)) {
        throw new Error('Invalid issue type for healthcare provider');
      }

      if (providerType === 'lab' && !labIssues.includes(issueType)) {
        throw new Error('Invalid issue type for lab');
      }

      if (providerType === 'pharmacy' && !pharmacyIssues.includes(issueType)) {
        throw new Error('Invalid issue type for pharmacy');
      }

      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateUpdateReport = [
  body('issueType')
    .optional()
    .isIn([
      'unprofessional_behavior',
      'harassment_verbal_abuse',
      'medical_negligence',
      'fraud_fake_profile',
      'wrong_diagnosis',
      'appointment_issues',
      'prescription_error',
      'privacy_violation',
      'wrong_lab_result',
      'lab_misconduct',
      'pharmacy_misconduct'
    ])
    .withMessage('Invalid issue type'),

  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters')
    .trim()
    .escape(),

  body('screenshotUrl')
    .optional()
    .isURL()
    .withMessage('Screenshot URL must be a valid URL')
    .isLength({ max: 500 })
    .withMessage('Screenshot URL must not exceed 500 characters'),

  body('status')
    .optional()
    .isIn(['pending', 'under_review', 'resolved', 'closed'])
    .withMessage('Invalid status'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

// ===================================
// DISPUTE VALIDATION MIDDLEWARE
// ===================================

const validateCreateDispute = [
  // Core Identifiers
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),

  body('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required')
    .isUUID()
    .withMessage('Transaction ID must be a valid UUID'),

  // Dispute Information
  body('disputeType')
    .notEmpty()
    .withMessage('Dispute type is required')
    .isIn([
      'incorrect_billing',
      'doctor_no_show',
      'poor_service_quality',
      'refund_request',
      'transaction_issues'
    ])
    .withMessage('Invalid dispute type'),

  // Description and Documentation
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters')
    .trim()
    .escape(),

  body('screenshotUrl')
    .optional()
    .isURL()
    .withMessage('Screenshot URL must be a valid URL')
    .isLength({ max: 500 })
    .withMessage('Screenshot URL must not exceed 500 characters'),

  // Status Management
  body('status')
    .optional()
    .isIn(['pending', 'under_review', 'resolved', 'closed'])
    .withMessage('Invalid status'),

  // Refund Information
  body('refundRequested')
    .optional()
    .isBoolean()
    .withMessage('Refund requested must be a boolean'),

  body('refundAmount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Refund amount must be a positive number')
    .toFloat(),

  // Custom validation for dispute-specific requirements
  body()
    .custom((value, { req }) => {
      const { disputeType, refundRequested, refundAmount, description } = req.body;

      // If refund is requested, ensure amount is provided
      if (refundRequested && !refundAmount) {
        throw new Error('Refund amount is required when refund is requested');
      }

      // For certain dispute types, description should be more detailed
      // if (['poor_service_quality', 'doctor_no_show'].includes(disputeType)) {
      //   if (!description || description.trim().length < 20) {
      //     throw new Error('Detailed description (minimum 20 characters) is required for this dispute type');
      //   }
      // }

      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateUpdateDispute = [
  body('disputeType')
    .optional()
    .isIn([
      'incorrect_billing',
      'doctor_no_show',
      'poor_service_quality',
      'refund_request',
      'transaction_issues'
    ])
    .withMessage('Invalid dispute type'),

  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters')
    .trim()
    .escape(),

  body('screenshotUrl')
    .optional()
    .isURL()
    .withMessage('Screenshot URL must be a valid URL')
    .isLength({ max: 500 })
    .withMessage('Screenshot URL must not exceed 500 characters'),

  body('status')
    .optional()
    .isIn(['pending', 'under_review', 'resolved', 'closed'])
    .withMessage('Invalid status'),

  body('refundRequested')
    .optional()
    .isBoolean()
    .withMessage('Refund requested must be a boolean'),

  body('refundAmount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Refund amount must be a positive number')
    .toFloat(),

  body('resolutionNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Resolution notes must not exceed 1000 characters')
    .trim()
    .escape(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

// ===================================
// COMMON PARAMETER VALIDATIONS
// ===================================

const validateIdParam = [
  param('id')
    .isUUID()
    .withMessage('ID must be a valid UUID'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateUserIdParam = [
  param('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),

  (req, res, next) => {
    const errors = validationResult(req);
    console.dir(req.params);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

// ===================================
// QUERY FILTERS VALIDATION
// ===================================

const validateInsuranceFilters = [
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),

  query('issueType')
    .optional()
    .isIn([
      'insurance_not_recognized',
      'policy_details_incorrect',
      'claim_status_delay',
      'coverage_rejected',
      'upload_document_error',
      'wrong_billing'
    ])
    .withMessage('Invalid issue type'),

  query('status')
    .optional()
    .isIn(['pending', 'in_progress', 'resolved', 'closed'])
    .withMessage('Invalid status'),

  query('serviceAffected')
    .optional()
    .isIn(['consultation', 'lab', 'pharmacy'])
    .withMessage('Invalid service affected'),

  query('startDate')
    .optional()
    .isDate()
    .withMessage('Start date must be a valid date'),

  query('endDate')
    .optional()
    .isDate()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (req.query.startDate && value && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateReportFilters = [
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),

  query('providerId')
    .optional()
    .isUUID()
    .withMessage('Provider ID must be a valid UUID'),

  query('providerType')
    .optional()
    .isIn(['healthcare_provider', 'lab', 'pharmacy'])
    .withMessage('Invalid provider type'),

  query('issueType')
    .optional()
    .isIn([
      'unprofessional_behavior',
      'harassment_verbal_abuse',
      'medical_negligence',
      'fraud_fake_profile',
      'wrong_diagnosis',
      'appointment_issues',
      'prescription_error',
      'privacy_violation',
      'wrong_lab_result',
      'lab_misconduct',
      'pharmacy_misconduct'
    ])
    .withMessage('Invalid issue type'),

  query('status')
    .optional()
    .isIn(['pending', 'under_review', 'resolved', 'closed'])
    .withMessage('Invalid status'),

  query('startDate')
    .optional()
    .isDate()
    .withMessage('Start date must be a valid date'),

  query('endDate')
    .optional()
    .isDate()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (req.query.startDate && value && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateDisputeFilters = [
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),

  query('transactionId')
    .optional()
    .isUUID()
    .withMessage('Transaction ID must be a valid UUID'),

  query('disputeType')
    .optional()
    .isIn([
      'incorrect_billing',
      'doctor_no_show',
      'poor_service_quality',
      'refund_request',
      'transaction_issues'
    ])
    .withMessage('Invalid dispute type'),

  query('status')
    .optional()
    .isIn(['pending', 'under_review', 'resolved', 'closed'])
    .withMessage('Invalid status'),

  query('refundRequested')
    .optional()
    .isBoolean()
    .withMessage('Refund requested must be a boolean'),

  query('startDate')
    .optional()
    .isDate()
    .withMessage('Start date must be a valid date'),

  query('endDate')
    .optional()
    .isDate()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (req.query.startDate && value && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

const validateAccountFilters = [
  // User ID filter
  query('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
    .toInt(),

  // Issue type filter
  query('issueType')
    .optional()
    .isIn([
      'account_information_error',
      'dependent_account_issue',
      'unable_to_update_profile',
      'deactivation_request',
      'double_accounts_conflict'
    ])
    .withMessage('Invalid issue type. Must be one of: account_information_error, dependent_account_issue, unable_to_update_profile, deactivation_request, double_accounts_conflict'),

  // Status filter
  query('status')
    .optional()
    .isIn(['pending', 'in_progress', 'resolved', 'closed'])
    .withMessage('Invalid status. Must be one of: pending, in_progress, resolved, closed'),

  // Priority filter
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority. Must be one of: low, medium, high, urgent'),

  // Assigned to filter
  query('assignedTo')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Assigned to must be between 1 and 255 characters')
    .trim(),

  // Date range filters
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)')
    .toDate(),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)')
    .toDate()
    .custom((value, { req }) => {
      if (req.query.startDate && value && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('End date must be after or equal to start date');
      }
      return true;
    }),

  // Created date filter (for filtering by creation date)
  query('createdAfter')
    .optional()
    .isISO8601()
    .withMessage('Created after must be a valid ISO 8601 date')
    .toDate(),

  query('createdBefore')
    .optional()
    .isISO8601()
    .withMessage('Created before must be a valid ISO 8601 date')
    .toDate()
    .custom((value, { req }) => {
      if (req.query.createdAfter && value && new Date(value) < new Date(req.query.createdAfter)) {
        throw new Error('Created before date must be after created after date');
      }
      return true;
    }),

  // Resolved date filter (for filtering by resolution date)
  query('resolvedAfter')
    .optional()
    .isISO8601()
    .withMessage('Resolved after must be a valid ISO 8601 date')
    .toDate(),

  query('resolvedBefore')
    .optional()
    .isISO8601()
    .withMessage('Resolved before must be a valid ISO 8601 date')
    .toDate()
    .custom((value, { req }) => {
      if (req.query.resolvedAfter && value && new Date(value) < new Date(req.query.resolvedAfter)) {
        throw new Error('Resolved before date must be after resolved after date');
      }
      return true;
    }),

  // Search filter (for searching in description or resolution notes)
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters')
    .trim()
    .escape(),

  // Pagination filters
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer starting from 1')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  // Sort filters
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'priority', 'status', 'resolvedAt'])
    .withMessage('Sort by must be one of: createdAt, updatedAt, priority, status, resolvedAt'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc', 'ASC', 'DESC'])
    .withMessage('Sort order must be either asc or desc')
    .toLowerCase(),

  // Include resolved tickets filter
  query('includeResolved')
    .optional()
    .isBoolean()
    .withMessage('Include resolved must be a boolean (true/false)')
    .toBoolean(),

  // Has resolution notes filter
  query('hasResolutionNotes')
    .optional()
    .isBoolean()
    .withMessage('Has resolution notes must be a boolean (true/false)')
    .toBoolean(),

  // Is assigned filter (to check if ticket is assigned to anyone)
  query('isAssigned')
    .optional()
    .isBoolean()
    .withMessage('Is assigned must be a boolean (true/false)')
    .toBoolean(),

  // Custom validation for logical combinations
  query()
    .custom((value, { req }) => {
      const { startDate, endDate, createdAfter, createdBefore, resolvedAfter, resolvedBefore } = req.query;

      // Ensure date ranges don't overlap inappropriately
      if (startDate && endDate && createdAfter && createdBefore) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const createdA = new Date(createdAfter);
        const createdB = new Date(createdBefore);

        if (start > createdB || end < createdA) {
          throw new Error('Date range filters have conflicting values');
        }
      }

      // If filtering by resolved dates, should probably include resolved tickets
      if ((resolvedAfter || resolvedBefore) && req.query.includeResolved === 'false') {
        throw new Error('Cannot filter by resolved dates when excluding resolved tickets');
      }

      // If filtering by assigned person but also filtering for unassigned tickets
      if (req.query.assignedTo && req.query.isAssigned === 'false') {
        throw new Error('Cannot filter by assignedTo when filtering for unassigned tickets');
      }

      return true;
    }),

  // Error handling middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg,
          value: error.value
        }))
      });
    }
    next();
  },
];

module.exports = {
  // Insurance validators
  validateCreateInsurance,
  validateUpdateInsurance,

  // Report validators
  validateCreateReport,
  validateUpdateReport,

  // Dispute validators
  validateCreateDispute,
  validateUpdateDispute,

  // Account validators
  validateCreateAccountTicket,
  validateUpdateAccountTicket,
  validateAssignTicket,
  validateResolveTicket,

  // Common validators
  validateIdParam,
  validateUserIdParam,

  // Filter validators
  validateInsuranceFilters,
  validateReportFilters,
  validateDisputeFilters,
  validateAccountFilters,


};