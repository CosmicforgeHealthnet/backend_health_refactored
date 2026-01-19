/**
 * @fileoverview Condition Validation Middleware
 * @description Validation middleware for first aid condition routes
 * @author Chidex Health Backend Team
 * @version 1.0.0
 * @since 2025-01-15
 */

const { body, param, query, validationResult } = require("express-validator");

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
 * Validation middleware for condition ID parameter
 */
const validateConditionId = [
  param("id")
    .isUUID()
    .withMessage("ID must be a valid UUID"),
  validateRequest
];

/**
 * Validation middleware for getting all conditions with query filters
 */
const validateGetAllConditions = [
  query("contentType")
    .optional()
    .isIn(["emergency", "non_emergency"])
    .withMessage("Content type must be either 'emergency' or 'non_emergency'"),
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
  query("severity")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Severity must be a non-empty string"),
  validateRequest
];

/**
 * Validation middleware for creating a new condition
 */
const validateCreateCondition = [
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage("Name must be between 2 and 255 characters"),
  body("description")
    .notEmpty()
    .withMessage("Description is required")
    .trim()
    .isLength({ min: 10 })
    .withMessage("Description must be at least 10 characters long"),
  body("contentType")
    .isIn(["emergency", "non_emergency"])
    .withMessage("Content type must be either 'emergency' or 'non_emergency'"),
  body("severity")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Severity must be a string between 1 and 50 characters"),
  body("symptoms")
    .optional()
    .isArray()
    .withMessage("Symptoms must be an array"),
  body("firstAidSteps")
    .optional()
    .isArray()
    .withMessage("First aid steps must be an array"),
  body("whenToSeekHelp")
    .optional()
    .isString()
    .trim()
    .withMessage("When to seek help must be a string"),
  body("prevention")
    .optional()
    .isString()
    .trim()
    .withMessage("Prevention must be a string"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
  validateRequest
];

/**
 * Validation middleware for updating an existing condition
 */
const validateUpdateCondition = [
  param("id")
    .isUUID()
    .withMessage("ID must be a valid UUID"),
  body("name")
    .optional()
    .notEmpty()
    .withMessage("Name cannot be empty if provided")
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage("Name must be between 2 and 255 characters"),
  body("description")
    .optional()
    .notEmpty()
    .withMessage("Description cannot be empty if provided")
    .trim()
    .isLength({ min: 10 })
    .withMessage("Description must be at least 10 characters long"),
  body("contentType")
    .optional()
    .isIn(["emergency", "non_emergency"])
    .withMessage("Content type must be either 'emergency' or 'non_emergency'"),
  body("severity")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Severity must be a string between 1 and 50 characters"),
  body("symptoms")
    .optional()
    .isArray()
    .withMessage("Symptoms must be an array"),
  body("firstAidSteps")
    .optional()
    .isArray()
    .withMessage("First aid steps must be an array"),
  body("whenToSeekHelp")
    .optional()
    .isString()
    .trim()
    .withMessage("When to seek help must be a string"),
  body("prevention")
    .optional()
    .isString()
    .trim()
    .withMessage("Prevention must be a string"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
  validateRequest
];

/**
 * Validation middleware for uploading condition images
 */
const validateUploadConditionImage = [
  param("id")
    .isUUID()
    .withMessage("ID must be a valid UUID"),
  validateRequest
];

module.exports = {
  validateConditionId,
  validateGetAllConditions,
  validateCreateCondition,
  validateUpdateCondition,
  validateUploadConditionImage,
  validateRequest
};