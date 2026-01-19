// Add these routes to your existing labRoutes.js file

const express = require("express");
const router = express.Router();

const labWaitlistController = require('../controllers/labPharmWaitlistController');
const { validateLabWaitlistJoin } = require("../validator/waitlist");
const { USER_ROLES } = require("../../../shared/utils/constants");
const {
  authorizeRoles,
  authenticateJWT,
} = require("../../auth/middlewares/authMiddleware");


// ==================== PUBLIC WAITLIST ROUTES ====================

/**
 * Join lab registration waitlist (no auth required)
 * POST /api/lab/waitlist/join
 */
router.post(
  "/waitlist/join",
  validateLabWaitlistJoin,
  labWaitlistController.joinWaitlist
);

/**
 * Check if email exists in waitlist (public)
 * GET /api/lab/waitlist/check?email=example@email.com
 */
router.get("/waitlist/check", labWaitlistController.checkEmailExists);

// ==================== ADMIN WAITLIST ROUTES ====================

/**
 * Get all waitlist entries (admin only)
 * GET /api/lab/admin/waitlist?status=pending&limit=50&offset=0
 */
router.get(
  "/admin/waitlist",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labWaitlistController.getAllWaitlistEntries
);

/**
 * Search waitlist entries (admin only)
 * GET /api/lab/admin/waitlist/search?q=searchterm
 */
router.get(
  "/admin/waitlist/search",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labWaitlistController.searchWaitlist
);

/**
 * Get waitlist entry by ID (admin only)
 * GET /api/lab/admin/waitlist/:id
 */
router.get(
  "/admin/waitlist/:id",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labWaitlistController.getWaitlistEntryById
);

/**
 * Update waitlist entry status (admin only)
 * PUT /api/lab/admin/waitlist/:id/status
 */
router.put(
  "/admin/waitlist/:id/status",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labWaitlistController.updateWaitlistStatus
);

/**
 * Send launch notifications to all pending entries (admin only)
 * POST /api/lab/admin/waitlist/send-launch-notifications
 */
router.post(
  "/admin/waitlist/send-launch-notifications",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labWaitlistController.sendLaunchNotifications
);

/**
 * Send launch notification to specific entry (admin only)
 * POST /api/lab/admin/waitlist/:id/send-launch-notification
 */
router.post(
  "/admin/waitlist/:id/send-launch-notification",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labWaitlistController.sendLaunchNotificationToEntry
);

/**
 * Get waitlist statistics (admin only)
 * GET /api/lab/admin/waitlist/stats
 */
router.get(
  "/admin/waitlist/stats",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labWaitlistController.getWaitlistStats
);

/**
 * Get waitlist entries by location (admin only)
 * GET /api/lab/admin/waitlist/location?city=CityName&state=StateName
 */
router.get(
  "/admin/waitlist/location",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labWaitlistController.getWaitlistByLocation
);

/**
 * Get recent waitlist registrations (admin only)
 * GET /api/lab/admin/waitlist/recent?limit=10
 */
router.get(
  "/admin/waitlist/recent",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labWaitlistController.getRecentRegistrations
);

/**
 * Cleanup old waitlist entries (admin only)
 * DELETE /api/lab/admin/waitlist/cleanup?olderThanDays=365
 */
router.delete(
  "/admin/waitlist/cleanup",
  authenticateJWT,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  labWaitlistController.cleanupOldEntries
);


module.exports = router;