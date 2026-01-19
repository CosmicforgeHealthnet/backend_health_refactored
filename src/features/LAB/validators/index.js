// src/validators/labValidators.js
const { body, validationResult } = require("express-validator");

const validateLabFacilityRegistration = [
  // Basic facility information
  body("facilityName")
    .notEmpty()
    .withMessage("Facility name is required")
    .isLength({ min: 2, max: 255 })
    .withMessage("Facility name must be between 2 and 255 characters")
    .trim(),

  body("facilityType")
    .notEmpty()
    .withMessage("Facility type is required")
    .isIn([
      "diagnostic_lab",
      "pathology_lab",
      "radiology_center",
      "medical_center",
      "hospital_lab",
    ])
    .withMessage("Invalid facility type"),

  body("registrationNumber")
    .notEmpty()
    .withMessage("Registration number is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Registration number must be between 3 and 100 characters")
    .trim(),

  body("licenseNumber")
    .notEmpty()
    .withMessage("License number is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("License number must be between 3 and 100 characters")
    .trim(),

  // Contact information
  body("email")
    .isEmail()
    .withMessage("Valid facility email is required")
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage("Email must not exceed 255 characters"),

  body("phone")
    .notEmpty()
    .withMessage("Phone number is required")
    .isLength({ min: 7, max: 20 })
    .withMessage("Phone number must be between 7 and 20 characters")
    .matches(/^[+\-()\s\d]+$/)
    .withMessage("Phone number contains invalid characters"),

  body("website")
    .optional()
    .isURL()
    .withMessage("Website must be a valid URL")
    .isLength({ max: 255 })
    .withMessage("Website URL must not exceed 255 characters"),

  // Address information
  body("address")
    .notEmpty()
    .withMessage("Address is required")
    .isLength({ min: 5, max: 500 })
    .withMessage("Address must be between 5 and 500 characters")
    .trim(),

  body("city")
    .notEmpty()
    .withMessage("City is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("City must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s\-'.]+$/)
    .withMessage("City contains invalid characters")
    .trim(),

  body("state")
    .notEmpty()
    .withMessage("State is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("State must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s\-'.]+$/)
    .withMessage("State contains invalid characters")
    .trim(),

  body("country")
    .notEmpty()
    .withMessage("Country is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Country must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s\-'.]+$/)
    .withMessage("Country contains invalid characters")
    .trim(),

  body("postalCode")
    .notEmpty()
    .withMessage("Postal code is required")
    .isLength({ min: 3, max: 20 })
    .withMessage("Postal code must be between 3 and 20 characters")
    .matches(/^[a-zA-Z0-9\s-]+$/)
    .withMessage("Postal code contains invalid characters")
    .trim(),

  // Lab admin information
  body("adminFullName")
    .notEmpty()
    .withMessage("Lab admin full name is required")
    .isLength({ min: 2, max: 255 })
    .withMessage("Lab admin name must be between 2 and 255 characters")
    .matches(/^[a-zA-Z\s\-'.]+$/)
    .withMessage("Lab admin name contains invalid characters")
    .trim(),

  body("adminEmail")
    .isEmail()
    .withMessage("Valid lab admin email is required")
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage("Admin email must not exceed 255 characters"),

  body("adminPhone")
    .optional()
    .isLength({ min: 7, max: 20 })
    .withMessage("Admin phone number must be between 7 and 20 characters")
    .matches(/^[+\-()\s\d]+$/)
    .withMessage("Admin phone number contains invalid characters"),

  // Optional operational details
  body("operatingHours")
    .optional()
    .isObject()
    .withMessage("Operating hours must be valid JSON"),

  body("servicesOffered")
    .optional()
    .isArray()
    .withMessage("Services offered must be an array"),

  body("equipmentList")
    .optional()
    .isArray()
    .withMessage("Equipment list must be an array"),

  // Document URLs (optional)
  body("licenseDocument")
    .optional()
    .isURL()
    .withMessage("License document must be a valid URL"),

  body("registrationDocument")
    .optional()
    .isURL()
    .withMessage("Registration document must be a valid URL"),

  body("accreditationDocument")
    .optional()
    .isURL()
    .withMessage("Accreditation document must be a valid URL"),

  // Custom validation to ensure facility email and admin email are different
  body("adminEmail").custom((adminEmail, { req }) => {
    if (adminEmail === req.body.email) {
      throw new Error("Facility email and lab admin email must be different");
    }
    return true;
  }),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

const validatePersonnelInvitation = [
  // Personnel basic information
  body("fullName")
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ min: 2, max: 255 })
    .withMessage("Full name must be between 2 and 255 characters")
    .matches(/^[a-zA-Z\s\-'.]+$/)
    .withMessage("Full name contains invalid characters")
    .trim(),

  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage("Email must not exceed 255 characters"),

  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn([
      "lab_manager",
      "sample_collector",
      "lab_technician",
      "radiologist",
      "result_reviewer",
    ])
    .withMessage(
      "Invalid personnel role. Must be one of: lab_manager, sample_collector, lab_technician, radiologist, result_reviewer"
    ),

  // Optional contact information
  body("phone")
    .optional()
    .isLength({ min: 7, max: 20 })
    .withMessage("Phone number must be between 7 and 20 characters")
    .matches(/^[+\-()\s\d]+$/)
    .withMessage("Phone number contains invalid characters"),

  // Professional information (optional)
  body("licenseNumber")
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage("License number must be between 3 and 100 characters")
    .trim(),

  body("specialization")
    .optional()
    .isLength({ min: 2, max: 255 })
    .withMessage("Specialization must be between 2 and 255 characters")
    .trim(),

  body("yearsOfExperience")
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage("Years of experience must be between 0 and 50"),

  body("qualifications")
    .optional()
    .isArray()
    .withMessage("Qualifications must be an array"),

  // Access control (optional)
  body("permissions")
    .optional()
    .isArray()
    .withMessage("Permissions must be an array"),

  body("departments")
    .optional()
    .isArray()
    .withMessage("Departments must be an array"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

// Validation for facility updates (less strict than registration)
const validateFacilityUpdate = [
  body("facilityName")
    .optional()
    .isLength({ min: 2, max: 255 })
    .withMessage("Facility name must be between 2 and 255 characters")
    .trim(),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Must be a valid email")
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage("Email must not exceed 255 characters"),

  body("phone")
    .optional()
    .isLength({ min: 7, max: 20 })
    .withMessage("Phone number must be between 7 and 20 characters")
    .matches(/^[+\-()\s\d]+$/)
    .withMessage("Phone number contains invalid characters"),

  body("website").optional().isURL().withMessage("Website must be a valid URL"),

  body("address")
    .optional()
    .isLength({ min: 5, max: 500 })
    .withMessage("Address must be between 5 and 500 characters")
    .trim(),

  body("operatingHours")
    .optional()
    .isJSON()
    .withMessage("Operating hours must be valid JSON"),

  body("servicesOffered")
    .optional()
    .isArray()
    .withMessage("Services offered must be an array"),

  body("equipmentList")
    .optional()
    .isArray()
    .withMessage("Equipment list must be an array"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

// Validation for personnel status updates
const validatePersonnelStatusUpdate = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn([
      "pending_registration",
      "invitation_sent",
      "registered",
      "active",
      "suspended",
      "terminated",
    ])
    .withMessage(
      "Invalid status. Must be one of: pending_registration, invitation_sent, registered, active, suspended, terminated"
    ),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }
    next();
  },
];

// Validation for personnel role updates
const validatePersonnelRoleUpdate = [
  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn([
      "lab_manager",
      "sample_collector",
      "lab_technician",
      "radiologist",
      "result_reviewer",
    ])
    .withMessage(
      "Invalid role. Must be one of: lab_manager, sample_collector, lab_technician, radiologist, result_reviewer"
    ),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }
    next();
  },
];

// Validation for personnel registration completion
const validatePersonnelRegistration = [
  body("registrationToken")
    .notEmpty()
    .withMessage("Registration token is required")
    .isLength({ min: 32, max: 64 })
    .withMessage("Invalid registration token format"),

  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),

  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Password confirmation is required")
    .custom((confirmPassword, { req }) => {
      if (confirmPassword !== req.body.password) {
        throw new Error("Password confirmation does not match password");
      }
      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }
    next();
  },
];

const validateOrderCreation = [
  // Facility ID validation
  body("facilityId")
    .notEmpty()
    .withMessage("Facility ID is required")
    .isUUID()
    .withMessage("Facility ID must be a valid UUID"),

  // Tests validation
  body("tests")
    .isArray({ min: 1 })
    .withMessage("At least one test must be specified")
    .custom((tests) => {
      for (const test of tests) {
        if (!test.name || typeof test.name !== "string") {
          throw new Error("Each test must have a valid name");
        }
        if (
          !test.unitPrice ||
          typeof test.unitPrice !== "number" ||
          test.unitPrice <= 0
        ) {
          throw new Error("Each test must have a valid unit price");
        }
        if (
          test.quantity &&
          (typeof test.quantity !== "number" || test.quantity <= 0)
        ) {
          throw new Error("Test quantity must be a positive number");
        }
      }
      return true;
    }),

  // Service type validation
  body("serviceType")
    .optional()
    .isIn(["lab_visit", "home_collection"])
    .withMessage("Service type must be either lab_visit or home_collection"),

  // Collection address for home collection
  body("collectionAddress")
    .if(body("serviceType").equals("home_collection"))
    .notEmpty()
    .withMessage("Collection address is required for home collection")
    .isLength({ min: 10, max: 500 })
    .withMessage("Collection address must be between 10 and 500 characters"),

  // Optional fields validation
  body("patientInstructions")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Patient instructions must not exceed 1000 characters"),

  body("medicalHistory")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Medical history must not exceed 2000 characters"),

  body("preferredDate")
    .optional()
    .isISO8601()
    .withMessage("Preferred date must be a valid date")
    .custom((value) => {
      const preferredDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (preferredDate < today) {
        throw new Error("Preferred date cannot be in the past");
      }
      return true;
    }),

  body("preferredTime")
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Preferred time must be in HH:MM format"),

  body("urgentProcessing")
    .optional()
    .isBoolean()
    .withMessage("Urgent processing must be a boolean"),

  body("doctorReferral")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Doctor referral must not exceed 500 characters"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

const validateOrderReview = [
  // Base amount validation
  body("baseAmount")
    .isFloat({ min: 0 })
    .withMessage("Base amount must be a positive number"),

  // Optional fees
  body("homeVisitFee")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Home visit fee must be a positive number"),

  body("urgentFee")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Urgent fee must be a positive number"),

  body("currency")
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a 3-character code"),

  // Notes for the invoice
  body("invoiceNotes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Invoice notes must not exceed 500 characters"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }
    next();
  },
];

const validatePersonnelAssignment = [
  body("personnelId")
    .notEmpty()
    .withMessage("Personnel ID is required")
    .isUUID()
    .withMessage("Personnel ID must be a valid UUID"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }
    next();
  },
];

const validateResultsUpload = [
  body("resultsFileUrl")
    .optional()
    .isURL()
    .withMessage("Results file URL must be a valid URL"),

  body("resultsData")
    .optional()
    .isObject()
    .withMessage("Results data must be an object"),

  body("itemResults")
    .optional()
    .isArray()
    .withMessage("Item results must be an array")
    .custom((itemResults) => {
      if (itemResults) {
        for (const item of itemResults) {
          if (!item.itemId || !item.result) {
            throw new Error("Each item result must have itemId and result");
          }
        }
      }
      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }
    next();
  },
];

const validateResultsReview = [
  body("approved")
    .isBoolean()
    .withMessage("Approved status is required and must be boolean"),

  body("notes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Review notes must not exceed 1000 characters"),

  body("notes")
    .if(body("approved").equals(false))
    .notEmpty()
    .withMessage("Review notes are required when results are not approved"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }
    next();
  },
];

const validateOrderCancellation = [
  body("reason")
    .notEmpty()
    .withMessage("Cancellation reason is required")
    .isLength({ min: 10, max: 500 })
    .withMessage("Cancellation reason must be between 10 and 500 characters"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }
    next();
  },
];

const validateScheduling = [
  body("scheduledDateTime")
    .notEmpty()
    .withMessage("Scheduled date and time is required")
    .isISO8601()
    .withMessage("Scheduled date and time must be a valid ISO date")
    .custom((value) => {
      const scheduledDate = new Date(value);
      const now = new Date();

      if (scheduledDate <= now) {
        throw new Error("Scheduled date and time must be in the future");
      }
      return true;
    }),

  body("notes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Scheduling notes must not exceed 500 characters"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }
    next();
  },
];

module.exports = {
  validateLabFacilityRegistration,
  validatePersonnelInvitation,
  validateFacilityUpdate,
  validatePersonnelStatusUpdate,
  validatePersonnelRoleUpdate,
  validatePersonnelRegistration,
  validateOrderCreation,
  validateOrderReview,
  validatePersonnelAssignment,
  validateResultsUpload,
  validateResultsReview,
  validateOrderCancellation,
  validateScheduling,
};
