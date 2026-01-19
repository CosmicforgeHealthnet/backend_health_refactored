/**
 * @fileoverview Step Validation Middleware
 * @description Validation middleware for first aid step routes
 * @author Chidex Health Backend Team
 * @version 1.0.0
 * @since 2025-01-16
 */

const { body, param, query, validationResult } = require("express-validator");

/**
 * Middleware to transform multipart form data for steps field
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const transformMultipartData = (req, res, next) => {
  // Transform steps from comma-separated string to array if needed
  if (req.body.steps && typeof req.body.steps === 'string') {
    req.body.steps = req.body.steps.split(',').map(step => step.trim()).filter(step => step.length > 0);
  }

  // Transform metadata from string to object if needed
  if (req.body.metadata && typeof req.body.metadata === 'string') {
    try {
      req.body.metadata = JSON.parse(req.body.metadata);
    } catch (error) {
      // Leave as string if not valid JSON
    }
  }

  next();
};

/**
 * Validation middleware to check for validation errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {Object} Validation error response or calls next()
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: errors.array()
    });
  }
  next();
};

/**
 * Validation middleware for step ID parameter
 */
const validateStepId = [
  param("id")
    .isUUID()
    .withMessage("ID must be a valid UUID"),
  validateRequest
];

/**
 * Validation middleware for condition ID parameter
 */
const validateConditionId = [
  param("conditionId")
    .isUUID()
    .withMessage("Condition ID must be a valid UUID"),
  query("category")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Category must be a non-empty string"),
  validateRequest
];

/**
 * Validation middleware for creating a new step
 */
const validateCreateStep = [
  body("conditionId")
    .isUUID()
    .withMessage("Condition ID must be a valid UUID"),
  body("categoryType")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Category type must be a string between 1 and 100 characters"),
  body("steps")
    .isArray({ min: 1 })
    .withMessage("Steps must be a non-empty array")
    .custom((steps) => {
      if (!Array.isArray(steps)) return false;
      return steps.every(step =>
        typeof step === 'string' && step.trim().length > 0
      );
    })
    .withMessage("Each step must be a non-empty string"),
  body("categoryImageId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Category image ID must be a valid positive integer"),
  body("sortOrder")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Sort order must be a non-negative integer"),
  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be a valid JSON object"),
  validateRequest
];

/**
 * Validation middleware for updating an existing step
 */
const validateUpdateStep = [
  param("id")
    .isUUID()
    .withMessage("ID must be a valid UUID"),
  body("conditionId")
    .optional()
    .isUUID()
    .withMessage("Condition ID must be a valid UUID"),
  body("categoryType")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Category type must be a string between 1 and 100 characters"),
  body("steps")
    .optional()
    .isArray({ min: 1 })
    .withMessage("Steps must be a non-empty array")
    .custom((steps) => {
      if (!Array.isArray(steps)) return false;
      return steps.every(step =>
        typeof step === 'string' && step.trim().length > 0
      );
    })
    .withMessage("Each step must be a non-empty string"),
  body("categoryImageId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Category image ID must be a valid positive integer"),
  body("sortOrder")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Sort order must be a non-negative integer"),
  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be a valid JSON object"),
  validateRequest
];

/**
 * Validation middleware for uploading step category images
 */
const validateUploadStepImage = [
  param("id")
    .isUUID()
    .withMessage("ID must be a valid UUID"),
  validateRequest
];

module.exports = {
  validateStepId,
  validateConditionId,
  validateCreateStep,
  validateUpdateStep,
  validateUploadStepImage,
  validateRequest,
  transformMultipartData
};