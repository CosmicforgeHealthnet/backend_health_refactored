/**
 * @fileoverview Sync Validation Middleware
 * @description Validation middleware for first aid sync routes
 * @author Chidex Health Backend Team
 * @version 1.0.0
 * @since 2025-01-16
 */

const { query, validationResult } = require("express-validator");

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
 * Validation middleware for checking updates with client version
 */
const validateCheckUpdates = [
  query("clientVersion")
    .notEmpty()
    .withMessage("clientVersion is required")
    .isInt({ min: 0 })
    .withMessage("clientVersion must be a non-negative integer")
    .toInt(),
  validateRequest
];

module.exports = {
  validateCheckUpdates,
  validateRequest
};