const express = require("express");
const {
  authenticateJWT,
  authorizeRoles,
} = require("../../auth/middlewares/authMiddleware");
const serviceAvailabilityController = require("../controllers/serviceAvailabilityController");
const { USER_ROLES } = require("../../../shared/utils/constants");

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
// These routes are accessible without authentication

/**
 * @route   GET /api/services
 * @desc    Get all enabled services with their status
 * @access  Public
 */
router.get("/", (req, res, next) =>
  serviceAvailabilityController.getAllServices(req, res, next)
);

/**
 * @route   GET /api/services/:serviceKey/status
 * @desc    Get status of a specific service by key
 * @access  Public
 */
router.get("/:serviceKey/status", (req, res, next) =>
  serviceAvailabilityController.getServiceStatus(req, res, next)
);

/**
 * @route   POST /api/services/status/bulk
 * @desc    Check multiple service statuses at once
 * @access  Public
 * @body    { serviceKeys: ["appointments", "pharmacy", "lab"] }
 */
router.post("/status/bulk", (req, res, next) =>
  serviceAvailabilityController.getBulkServiceStatus(req, res, next)
);

/**
 * @route   GET /api/services/:serviceKey/available
 * @desc    Simple boolean check if service is available
 * @access  Public
 */
router.get("/:serviceKey/available", (req, res, next) =>
  serviceAvailabilityController.checkServiceAvailability(req, res, next)
);

// ==================== ADMIN ROUTES ====================
// These routes require admin authentication

const adminRoles = [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN];

/**
 * @route   GET /api/services/admin/all
 * @desc    Get all services including disabled ones (admin)
 * @access  Admin
 * @query   includeDisabled=true (optional)
 */
router.get(
  "/admin/all",
  authenticateJWT,
  authorizeRoles(...adminRoles),
  (req, res, next) => serviceAvailabilityController.adminGetAllServices(req, res, next)
);

/**
 * @route   GET /api/services/admin/history/all
 * @desc    Get all status change history (admin dashboard)
 * @access  Admin
 * @query   limit (default: 100), skip (default: 0)
 */
router.get(
  "/admin/history/all",
  authenticateJWT,
  authorizeRoles(...adminRoles),
  (req, res, next) => serviceAvailabilityController.getAllHistory(req, res, next)
);

/**
 * @route   GET /api/services/admin/:id
 * @desc    Get single service by ID (admin)
 * @access  Admin
 */
router.get(
  "/admin/:id",
  authenticateJWT,
  authorizeRoles(...adminRoles),
  (req, res, next) => serviceAvailabilityController.adminGetService(req, res, next)
);

/**
 * @route   POST /api/services/admin
 * @desc    Create a new service (admin)
 * @access  Admin
 * @body    { serviceKey, name, description?, category?, iconUrl?, displayOrder?, isEnabled? }
 */
router.post(
  "/admin",
  authenticateJWT,
  authorizeRoles(...adminRoles),
  (req, res, next) => serviceAvailabilityController.createService(req, res, next)
);

/**
 * @route   PUT /api/services/admin/:id
 * @desc    Update service details (admin)
 * @access  Admin
 * @body    { serviceKey?, name?, description?, category?, iconUrl?, displayOrder?, isEnabled? }
 */
router.put(
  "/admin/:id",
  authenticateJWT,
  authorizeRoles(...adminRoles),
  (req, res, next) => serviceAvailabilityController.updateService(req, res, next)
);

/**
 * @route   POST /api/services/admin/:id/down
 * @desc    Set service to DOWN status (admin)
 * @access  Admin
 * @body    { countdownEnd?, reason?, downtimeMessage?, showCountdown?, sendNotifications? }
 */
router.post(
  "/admin/:id/down",
  authenticateJWT,
  authorizeRoles(...adminRoles),
  (req, res, next) => serviceAvailabilityController.setServiceDown(req, res, next)
);

/**
 * @route   POST /api/services/admin/:id/active
 * @desc    Set service to ACTIVE status (admin override)
 * @access  Admin
 * @body    { sendNotifications? }
 */
router.post(
  "/admin/:id/active",
  authenticateJWT,
  authorizeRoles(...adminRoles),
  (req, res, next) => serviceAvailabilityController.setServiceActive(req, res, next)
);

/**
 * @route   POST /api/services/admin/:id/extend-countdown
 * @desc    Extend the countdown for a downed service (admin)
 * @access  Admin
 * @body    { newCountdownEnd, reason?, sendNotifications? }
 */
router.post(
  "/admin/:id/extend-countdown",
  authenticateJWT,
  authorizeRoles(...adminRoles),
  (req, res, next) => serviceAvailabilityController.extendCountdown(req, res, next)
);

/**
 * @route   POST /api/services/admin/:id/shorten-countdown
 * @desc    Shorten the countdown for a downed service (admin)
 * @access  Admin
 * @body    { newCountdownEnd, reason?, sendNotifications? }
 */
router.post(
  "/admin/:id/shorten-countdown",
  authenticateJWT,
  authorizeRoles(...adminRoles),
  (req, res, next) => serviceAvailabilityController.shortenCountdown(req, res, next)
);

/**
 * @route   DELETE /api/services/admin/:id
 * @desc    Delete a service (soft delete)
 * @access  Admin
 */
router.delete(
  "/admin/:id",
  authenticateJWT,
  authorizeRoles(...adminRoles),
  (req, res, next) => serviceAvailabilityController.deleteService(req, res, next)
);

/**
 * @route   GET /api/services/admin/:id/history
 * @desc    Get status history for a specific service (admin)
 * @access  Admin
 * @query   limit (default: 50), skip (default: 0)
 */
router.get(
  "/admin/:id/history",
  authenticateJWT,
  authorizeRoles(...adminRoles),
  (req, res, next) => serviceAvailabilityController.getServiceHistory(req, res, next)
);

/**
 * @route   GET /api/services/admin/:id/stats
 * @desc    Get downtime statistics for a service (admin)
 * @access  Admin
 * @query   startDate?, endDate? (ISO date strings)
 */
router.get(
  "/admin/:id/stats",
  authenticateJWT,
  authorizeRoles(...adminRoles),
  (req, res, next) => serviceAvailabilityController.getDowntimeStats(req, res, next)
);

module.exports = router;
