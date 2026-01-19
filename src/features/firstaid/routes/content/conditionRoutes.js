/**
 * @fileoverview Condition Routes - First Aid Content Management
 * @description Routes for managing first aid conditions (emergency & non-emergency)
 * @author Chidex Health Backend Team
 * @version 1.0.0
 * @since 2025-01-15
 */

const router = require("express").Router();
const conditionController = require("../../../firstaid/controllers/conditionController");
const {
  authenticateJWT,
  authorizeRoles,
} = require("../../../auth/middlewares/authMiddleware");
const DocumentUploadMiddleware = require("../../../documents/middlewares/documentUploadMiddleware");
const DocumentFolderMiddleware = require("../../../documents/middlewares/documentFolderMiddleware");
const {
  validateConditionId,
  validateGetAllConditions,
  validateCreateCondition,
  validateUpdateCondition,
  validateUploadConditionImage
} = require("../../middlewares/conditionValidationMiddleware");

/**
 * @route GET /api/firstaid/conditions/emergency
 * @desc Get all emergency conditions for mobile app (public)
 * @access Public
 * @returns {Object} Success response with emergency conditions array
 */
router.get("/emergency", conditionController.getEmergencyConditions);

/**
 * @route GET /api/firstaid/conditions/non-emergency
 * @desc Get all non-emergency conditions for mobile app (public)
 * @access Public
 * @returns {Object} Success response with non-emergency conditions array
 */
router.get("/non-emergency", conditionController.getNonEmergencyConditions);
/**
 * @route GET /api/firstaid/conditions/:id
 * @desc Get a specific condition by ID (public)
 * @access Public
 * @param {number} id - Condition ID
 * @returns {Object} Success response with condition details
 */
router.get(
  "/:id",
  validateConditionId,
  conditionController.getConditionById
);

/**
 * @route GET /api/firstaid/conditions
 * @desc Get all conditions with optional filters (admin only)
 * @access Admin
 * @query {string} [contentType] - Filter by content type (emergency/non_emergency)
 * @query {boolean} [isActive] - Filter by active status
 * @query {string} [severity] - Filter by severity level
 * @returns {Object} Success response with conditions array
 */
router.get(
  "/",
  authenticateJWT,
  authorizeRoles("admin"),
  validateGetAllConditions,
  conditionController.getAllConditions
);

/**
 * @route POST /api/firstaid/conditions
 * @desc Create a new condition with optional image upload (admin only)
 * @access Admin
 * @body {string} name - Condition name (required)
 * @body {string} description - Condition description (required)
 * @body {string} contentType - Type: emergency or non_emergency (required)
 * @body {string} [severity] - Severity level (optional)
 * @files {File} [images] - Condition images (optional)
 * @returns {Object} Success response with created condition
 */
router.post(
  "/",
  authenticateJWT,
  authorizeRoles("admin"),
  DocumentUploadMiddleware.uploadImages(),
  DocumentUploadMiddleware.handleUploadError,
  validateCreateCondition,
  DocumentUploadMiddleware.processOptionalImageFiles,
  DocumentFolderMiddleware.handleOptionalFolderCreation,
  DocumentFolderMiddleware.saveOptionalFilesToDatabase,
  conditionController.createCondition
);

/**
 * @route PUT /api/firstaid/conditions/:id
 * @desc Update an existing condition with optional image upload (admin only)
 * @access Admin
 * @param {number} id - Condition ID
 * @body {string} [name] - Condition name (optional)
 * @body {string} [description] - Condition description (optional)
 * @body {string} [contentType] - Type: emergency or non_emergency (optional)
 * @body {string} [severity] - Severity level (optional)
 * @body {boolean} [isActive] - Active status (optional)
 * @files {File} [images] - Condition images (optional)
 * @returns {Object} Success response with updated condition
 */
router.put(
  "/:id",
  authenticateJWT,
  authorizeRoles("admin"),
  DocumentUploadMiddleware.uploadImages(),
  DocumentUploadMiddleware.handleUploadError,
  validateUpdateCondition,
  DocumentUploadMiddleware.processOptionalImageFiles,
  DocumentFolderMiddleware.handleOptionalFolderCreation,
  DocumentFolderMiddleware.saveOptionalFilesToDatabase,
  conditionController.updateCondition
);

/**
 * @route DELETE /api/firstaid/conditions/:id
 * @desc Delete a condition (admin only)
 * @access Admin
 * @param {number} id - Condition ID
 * @returns {Object} Success response with deletion message
 */
router.delete(
  "/:id",
  authenticateJWT,
  authorizeRoles("admin"),
  validateConditionId,
  conditionController.deleteCondition
);

/**
 * @route PATCH /api/firstaid/conditions/:id/toggle
 * @desc Toggle condition active status (admin only)
 * @access Admin
 * @param {number} id - Condition ID
 * @returns {Object} Success response with updated condition status
 */
router.patch(
  "/:id/toggle",
  authenticateJWT,
  authorizeRoles("admin"),
  validateConditionId,
  conditionController.toggleConditionStatus
);

/**
 * @route POST /api/firstaid/conditions/:id/image
 * @desc Upload image for an existing condition (admin only)
 * @access Admin
 * @param {number} id - Condition ID
 * @files {File} images - Condition images (required, use field name "images")
 * @returns {Object} Success response with condition and uploaded images
 */
router.post(
  "/:id/image",
  authenticateJWT,
  authorizeRoles("admin"),
  validateUploadConditionImage,
  DocumentUploadMiddleware.uploadImages(),
  DocumentUploadMiddleware.handleUploadError,
  DocumentUploadMiddleware.processImageFiles,
  DocumentFolderMiddleware.handleOptionalFolderCreation,
  DocumentFolderMiddleware.saveOptionalFilesToDatabase,
  conditionController.uploadConditionImage
);

module.exports = router;
