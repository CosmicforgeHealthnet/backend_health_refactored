/**
 * @fileoverview Sync Routes - First Aid Content Synchronization
 * @description Routes for mobile and web offline sync functionality
 * @author Chidex Health Backend Team
 * @version 1.0.0
 * @since 2025-01-16
 */

const router = require("express").Router();
const syncController = require("../../controllers/syncController");
const {
  validateCheckUpdates
} = require("../../middlewares/syncValidationMiddleware");

/**
 * @route GET /api/firstaid/sync/offline-manifest
 * @desc Get full offline manifest for mobile apps (public)
 * @access Public
 * @returns {Object} Success response with complete offline manifest
 * @description Provides all first aid content for mobile app offline functionality
 */
router.get("/offline-manifest", syncController.getOfflineManifest);

/**
 * @route GET /api/firstaid/sync/web-manifest
 * @desc Get lightweight manifest for Progressive Web App (public)
 * @access Public
 * @returns {Object} Success response with web-optimized manifest
 * @description Provides optimized first aid content for PWA offline functionality
 */
router.get("/web-manifest", syncController.getWebManifest);

/**
 * @route GET /api/firstaid/sync/check-updates
 * @desc Check if client needs to update content (public)
 * @access Public
 * @query {number} clientVersion - Current client version number (required)
 * @returns {Object} Success response with update status and latest version
 * @description Enables incremental sync by comparing client version with latest
 */
router.get("/check-updates", validateCheckUpdates, syncController.checkForUpdates);

/**
 * @route GET /api/firstaid/sync/health
 * @desc Get sync system health status (public)
 * @access Public
 * @returns {Object} Success response with health status information
 * @description Provides health check information for the sync system
 */
router.get("/health", syncController.getHealthCheck);

module.exports = router;
