// src/controllers/spinningWheelController.js
const spinningWheelService = require("../services/spinningWheelService");
const { body, param, query, validationResult } = require("express-validator");

class SpinningWheelController {
  /**
   * Spin the wheel
   */
  spinWheel = [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    
    async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const { email } = req.body;
        const userId = req.user?.sub || null; // Get user ID if authenticated

        const result = await spinningWheelService.spinWheel(email, userId);

        return res.status(200).json({
          success: true,
          message: "Wheel spun successfully",
          data: {
            reward: {
              type: result.reward.type,
              description: result.reward.description,
              value: result.reward.value
            },
            needsEmailVerification: result.needsEmailVerification,
            rewardCode: result.needsEmailVerification ? result.spin.rewardCode : null
          }
        });
      } catch (error) {
        if (error.message === "You can only spin once every 24 hours" || 
            error.message === "No rewards available at the moment") {
          return res.status(400).json({
            success: false,
            error: error.message
          });
        }
        next(error);
      }
    }
  ];

  /**
   * Verify reward email
   */
  verifyRewardEmail = [
    param("token")
      .isLength({ min: 32, max: 64 })
      .withMessage("Invalid verification token"),

    async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const { token } = req.params;
        const result = await spinningWheelService.verifyRewardEmail(token);

        return res.status(200).json({
          success: true,
          message: "Email verified successfully! Your reward is now active.",
          data: {
            rewardCode: result.rewardCode,
            reward: result.reward,
            expiresAt: result.expiresAt
          }
        });
      } catch (error) {
        if (error.message === "Invalid or expired verification token" ||
            error.message === "Email already verified" ||
            error.message === "Reward has expired") {
          return res.status(400).json({
            success: false,
            error: error.message
          });
        }
        next(error);
      }
    }
  ];

  /**
   * Get user's active rewards
   */
  getUserActiveRewards = [
    query("email")
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),

    async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const { email } = req.query;
        const userId = req.user?.sub || null;

        if (!email && !userId) {
          return res.status(400).json({
            success: false,
            error: "Email or user authentication required"
          });
        }

        const rewards = await spinningWheelService.getUserActiveRewards(
          email || req.user?.email, 
          userId
        );

        return res.status(200).json({
          success: true,
          message: "Active rewards retrieved successfully",
          data: rewards
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Validate reward code
   */
  validateRewardCode = [
    param("rewardCode")
      .isLength({ min: 6, max: 20 })
      .withMessage("Invalid reward code format"),

    async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const { rewardCode } = req.params;
        const spinHistory = await spinningWheelService.validateRewardCode(rewardCode);

        return res.status(200).json({
          success: true,
          message: "Reward code is valid",
          data: {
            rewardCode: spinHistory.rewardCode,
            reward: spinHistory.reward,
            email: spinHistory.email,
            expiresAt: spinHistory.expiresAt,
            status: spinHistory.status
          }
        });
      } catch (error) {
        if (error.message === "Invalid reward code" ||
            error.message === "Reward is no longer active" ||
            error.message === "Email not verified for this reward" ||
            error.message === "Reward has expired") {
          return res.status(400).json({
            success: false,
            error: error.message
          });
        }
        next(error);
      }
    }
  ];

  /**
   * Mark reward as used
   */
  markRewardAsUsed = [
    param("rewardCode")
      .isLength({ min: 6, max: 20 })
      .withMessage("Invalid reward code format"),

    async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const { rewardCode } = req.params;
        const userId = req.user?.sub || null;

        const result = await spinningWheelService.markRewardAsUsed(rewardCode, userId);

        return res.status(200).json({
          success: true,
          message: result.message,
          data: {
            rewardCode,
            reward: result.reward
          }
        });
      } catch (error) {
        if (error.message === "Invalid reward code" ||
            error.message === "Reward is no longer active" ||
            error.message === "Email not verified for this reward" ||
            error.message === "Reward has expired") {
          return res.status(400).json({
            success: false,
            error: error.message
          });
        }
        next(error);
      }
    }
  ];

  /**
   * Get user spin history
   */
  getUserSpinHistory = [
    query("email")
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),

    async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const { email, limit = 10 } = req.query;
        const userId = req.user?.sub || null;

        if (!email && !userId) {
          return res.status(400).json({
            success: false,
            error: "Email or user authentication required"
          });
        }

        const history = await spinningWheelService.getUserSpinHistory(
          email || req.user?.email,
          userId,
          parseInt(limit)
        );

        return res.status(200).json({
          success: true,
          message: "Spin history retrieved successfully",
          data: history
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Associate spins with user (when they register/login)
   */
  associateSpinsWithUser = [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),

    async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const { email } = req.body;
        const userId = req.user?.sub;

        if (!userId) {
          return res.status(401).json({
            success: false,
            error: "User authentication required"
          });
        }

        const associatedCount = await spinningWheelService.associateSpinsWithUser(email, userId);

        return res.status(200).json({
          success: true,
          message: `${associatedCount} spin records associated with user account`,
          data: { associatedCount }
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  // Admin endpoints
  /**
   * Create new spin reward (Admin only)
   */
  createSpinReward = [
    body("type")
      .isIn(["discount", "free_gift", "try_again", "no_reward"])
      .withMessage("Invalid reward type"),
    body("description")
      .isLength({ min: 1, max: 255 })
      .withMessage("Description is required"),
    body("value")
      .optional()
      .isDecimal()
      .withMessage("Value must be a decimal number"),
    body("weight")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Weight must be a positive integer"),
    body("validityDays")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Validity days must be a positive integer"),

    async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const rewardData = req.body;
        const reward = await spinningWheelService.createSpinReward(rewardData);

        return res.status(201).json({
          success: true,
          message: "Spin reward created successfully",
          data: reward
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Update spin reward (Admin only)
   */
  updateSpinReward = [
    param("rewardId")
      .isUUID()
      .withMessage("Invalid reward ID"),
    body("type")
      .optional()
      .isIn(["discount", "free_gift", "try_again", "no_reward"])
      .withMessage("Invalid reward type"),
    body("description")
      .optional()
      .isLength({ min: 1, max: 255 })
      .withMessage("Description must be between 1-255 characters"),
    body("value")
      .optional()
      .isDecimal()
      .withMessage("Value must be a decimal number"),
    body("weight")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Weight must be a positive integer"),
    body("validityDays")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Validity days must be a positive integer"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),

    async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const { rewardId } = req.params;
        const updateData = req.body;

        const reward = await spinningWheelService.updateSpinReward(rewardId, updateData);

        return res.status(200).json({
          success: true,
          message: "Spin reward updated successfully",
          data: reward
        });
      } catch (error) {
        if (error.message === "Reward not found") {
          return res.status(404).json({
            success: false,
            error: error.message
          });
        }
        next(error);
      }
    }
  ];

  /**
   * Get all rewards (Admin only)
   */
  getAllRewards = async (req, res, next) => {
    try {
      const rewards = await spinningWheelService.getAllRewards();

      return res.status(200).json({
        success: true,
        message: "All rewards retrieved successfully",
        data: rewards
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get spin statistics (Admin only)
   */
  getSpinStatistics = [
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be in ISO format"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be in ISO format"),

    async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const { startDate, endDate } = req.query;
        const statistics = await spinningWheelService.getSpinStatistics(
          startDate ? new Date(startDate) : null,
          endDate ? new Date(endDate) : null
        );

        return res.status(200).json({
          success: true,
          message: "Spin statistics retrieved successfully",
          data: statistics
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  /**
   * Cleanup expired rewards (Admin only)
   */
  cleanupExpiredRewards = async (req, res, next) => {
    try {
      const result = await spinningWheelService.cleanupExpiredRewards();

      return res.status(200).json({
        success: true,
        message: "Expired rewards cleaned up successfully",
        data: result
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new SpinningWheelController();