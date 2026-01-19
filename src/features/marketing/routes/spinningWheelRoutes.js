// src/routes/spinningWheelRoutes.js
const router = require("express").Router();
const spinningWheelController = require("../controllers/spinningWheelController");
const { authorizeRoles } = require("../../auth/middlewares/authMiddleware");
const { USER_ROLES } = require("../../../shared/utils/constants");

// Public routes
/**
 * @route POST /api/spinning-wheel/spin
 * @desc Spin the wheel for rewards
 * @access Public (but can be enhanced with optional auth)
 */
router.post("/spin", spinningWheelController.spinWheel);

/**
 * @route GET /api/spinning-wheel/verify/:token
 * @desc Verify email for reward activation
 * @access Public
 */
router.get("/verify/:token", spinningWheelController.verifyRewardEmail);

/**
 * @route GET /api/spinning-wheel/validate/:rewardCode
 * @desc Validate a reward code
 * @access Public
 */
router.get("/validate/:rewardCode", spinningWheelController.validateRewardCode);

// Protected routes (require authentication or email)
/**
 * @route GET /api/spinning-wheel/rewards/active
 * @desc Get user's active rewards
 * @access Protected (requires auth or email)
 */
router.get("/rewards/active", spinningWheelController.getUserActiveRewards);

/**
 * @route GET /api/spinning-wheel/history
 * @desc Get user's spin history
 * @access Protected (requires auth or email)
 */
router.get("/history", spinningWheelController.getUserSpinHistory);

/**
 * @route PUT /api/spinning-wheel/rewards/:rewardCode/use
 * @desc Mark reward as used
 * @access Protected (optional auth for tracking)
 */
router.put("/rewards/:rewardCode/use", spinningWheelController.markRewardAsUsed);

/**
 * @route POST /api/spinning-wheel/associate
 * @desc Associate existing spins with user account
 * @access Protected (requires authentication)
 */
router.post("/associate",
  authorizeRoles(USER_ROLES.PATIENT, USER_ROLES.DOCTOR, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  spinningWheelController.associateSpinsWithUser
);

// Admin routes
/**
 * @route POST /api/spinning-wheel/admin/rewards
 * @desc Create new spin reward
 * @access Admin only
 */
router.post("/admin/rewards",
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  spinningWheelController.createSpinReward
);

/**
 * @route PUT /api/spinning-wheel/admin/rewards/:rewardId
 * @desc Update spin reward
 * @access Admin only
 */
router.put("/admin/rewards/:rewardId",
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  spinningWheelController.updateSpinReward
);

/**
 * @route GET /api/spinning-wheel/admin/rewards
 * @desc Get all rewards
 * @access Admin only
 */
router.get("/admin/rewards",
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  spinningWheelController.getAllRewards
);

/**
 * @route GET /api/spinning-wheel/admin/statistics
 * @desc Get spin statistics
 * @access Admin only
 */
router.get("/admin/statistics",
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  spinningWheelController.getSpinStatistics
);

/**
 * @route POST /api/spinning-wheel/admin/cleanup
 * @desc Cleanup expired rewards
 * @access Admin only
 */
router.post("/admin/cleanup",
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  spinningWheelController.cleanupExpiredRewards
);

module.exports = router;