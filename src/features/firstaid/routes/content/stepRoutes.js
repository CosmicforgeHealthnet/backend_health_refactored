/**
 * @fileoverview Emergency Step Routes - First Aid Content Management
 * @description Routes for managing first aid emergency steps
 * @author Chidex Health Backend Team
 * @version 1.0.0
 * @since 2025-01-16
 */

const router = require("express").Router();
const emergencyStepController = require("../../../firstaid/controllers/emergencyStepController");
const {
  authenticateJWT,
  authorizeRoles,
} = require("../../../auth/middlewares/authMiddleware");
const DocumentUploadMiddleware = require("../../../documents/middlewares/documentUploadMiddleware");
const DocumentFolderMiddleware = require("../../../documents/middlewares/documentFolderMiddleware");
const {
  validateStepId,
  validateConditionId,
  validateCreateStep,
  validateUpdateStep,
  validateUploadStepImage,
  transformMultipartData
} = require("../../middlewares/stepValidationMiddleware");

// Subscription middlewares
const requireFeature = require("../../../subscriptions/middlewares/requireFeature");

/**
 * @route GET /api/firstaid/steps/condition/:conditionId
 * @desc Get steps by condition ID
 * @access Requires firstAidInstructions feature
 * @param {number} conditionId - Condition ID
 * @query {string} [categoryType] - Optional category type filter
 * @returns {Object} Success response with steps array
 */
router.get(
  "/condition/:conditionId",
  authenticateJWT,
  requireFeature("firstAidInstructions"),
  validateConditionId,
  emergencyStepController.getStepsByCondition
);

/**
 * @route GET /api/firstaid/steps
 * @desc Get all steps (admin only)
 * @access Admin
 * @returns {Object} Success response with steps array
 */
router.get(
  "/",
  authenticateJWT,
  authorizeRoles("admin"),
  emergencyStepController.getAllSteps
);

/**
 * @route GET /api/firstaid/steps/:id
 * @desc Get step by ID (admin only)
 * @access Admin
 * @param {number} id - Step ID
 * @returns {Object} Success response with step details
 */
router.get(
  "/:id",
  authenticateJWT,
  authorizeRoles("admin"),
  validateStepId,
  emergencyStepController.getStepById
);

/**
 * @route POST /api/firstaid/steps
 * @desc Create a new step with optional image upload (admin only)
 * @access Admin
 * @body {number} conditionId - Condition ID (required)
 * @body {string} [categoryType] - Category type (optional, defaults to "general")
 * @body {string[]} steps - Array of step descriptions (required)
 * @body {number} [sortOrder] - Sort order (optional, defaults to 0)
 * @body {Object} [metadata] - Additional metadata (optional)
 * @files {File} [files] - Category images (optional)
 * @returns {Object} Success response with created step
 */
router.post(
  "/",
  authenticateJWT,
  authorizeRoles("admin"),
  DocumentUploadMiddleware.uploadImages(),
  DocumentUploadMiddleware.handleUploadError,
  transformMultipartData,
  validateCreateStep,
  DocumentUploadMiddleware.processOptionalImageFiles,
  DocumentFolderMiddleware.handleOptionalFolderCreation,
  DocumentFolderMiddleware.saveOptionalFilesToDatabase,
  emergencyStepController.createStep
);

/**
 * @route PUT /api/firstaid/steps/:id
 * @desc Update an existing step with optional image upload (admin only)
 * @access Admin
 * @param {number} id - Step ID
 * @body {number} [conditionId] - Condition ID (optional)
 * @body {string} [categoryType] - Category type (optional)
 * @body {string[]} [steps] - Array of step descriptions (optional)
 * @body {number} [sortOrder] - Sort order (optional)
 * @body {Object} [metadata] - Additional metadata (optional)
 * @files {File} [files] - Category images (optional)
 * @returns {Object} Success response with updated step
 */
router.put(
  "/:id",
  authenticateJWT,
  authorizeRoles("admin"),
  DocumentUploadMiddleware.uploadImages(),
  DocumentUploadMiddleware.handleUploadError,
  transformMultipartData,
  validateUpdateStep,
  DocumentUploadMiddleware.processOptionalImageFiles,
  DocumentFolderMiddleware.handleOptionalFolderCreation,
  DocumentFolderMiddleware.saveOptionalFilesToDatabase,
  emergencyStepController.updateStep
);

/**
 * @route DELETE /api/firstaid/steps/:id
 * @desc Delete a step (admin only)
 * @access Admin
 * @param {number} id - Step ID
 * @returns {Object} Success response with deletion message
 */
router.delete(
  "/:id",
  authenticateJWT,
  authorizeRoles("admin"),
  validateStepId,
  emergencyStepController.deleteStep
);

/**
 * @route POST /api/firstaid/steps/:id/image
 * @desc Upload image for an existing step category (admin only)
 * @access Admin
 * @param {number} id - Step ID
 * @files {File} files - Category images (required, use field name "files")
 * @returns {Object} Success response with step and uploaded images
 */
router.post(
  "/:id/image",
  authenticateJWT,
  authorizeRoles("admin"),
  validateUploadStepImage,
  DocumentUploadMiddleware.uploadImages(),
  DocumentUploadMiddleware.handleUploadError,
  DocumentUploadMiddleware.processImageFiles,
  DocumentFolderMiddleware.handleOptionalFolderCreation,
  DocumentFolderMiddleware.saveOptionalFilesToDatabase,
  emergencyStepController.uploadCategoryImage
);

module.exports = router;
