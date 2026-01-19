// src/services/spinningWheelService.js
const spinningWheelRepository = require("../repositories/spinningWheelRepository");
const userRepository = require("../../auth/repositories/userRepository");
const { RewardType, RewardStatus } = require("../entities/SpinReward");
const crypto = require("node:crypto");
const sendEmail = require("../../../shared/services/email/emailHelpers"); // Assume you have email service

class SpinningWheelService {
  /**
   * Generate a unique reward code
   */
  generateRewardCode() {
    return crypto.randomBytes(6).toString('hex').toUpperCase();
  }

  /**
   * Generate email verification token
   */
  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Calculate expiration date based on reward validity
   */
  calculateExpirationDate(validityDays) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + validityDays);
    return expirationDate;
  }

  /**
   * Select a random reward based on weights
   */
  selectRandomReward(rewards) {
    const totalWeight = rewards.reduce((sum, reward) => sum + reward.weight, 0);
    const randomValue = Math.random() * totalWeight;

    let currentWeight = 0;
    for (const reward of rewards) {
      currentWeight += reward.weight;
      if (randomValue <= currentWeight) {
        return reward;
      }
    }

    // Fallback to last reward
    return rewards[rewards.length - 1];
  }

  /**
   * Spin the wheel and return a reward
   */
  async spinWheel(email, userId = null) {
    // Check rate limiting
    const hasSpunRecently = await spinningWheelRepository.hasUserSpunRecently(email, 24);
    if (hasSpunRecently) {
      throw new Error("You can only spin once every 24 hours");
    }

    // Get all active rewards
    const activeRewards = await spinningWheelRepository.findAllActiveRewards();
    if (activeRewards.length === 0) {
      throw new Error("No rewards available at the moment");
    }

    // Select random reward
    const selectedReward = this.selectRandomReward(activeRewards);

    // Generate reward code and verification token for eligible rewards
    let rewardCode = null;
    let emailVerificationToken = null;
    let expiresAt = null;

    if (selectedReward.type === RewardType.DISCOUNT || selectedReward.type === RewardType.FREE_GIFT) {
      rewardCode = this.generateRewardCode();
      emailVerificationToken = this.generateVerificationToken();
      expiresAt = this.calculateExpirationDate(selectedReward.validityDays);
    }

    // Create spin history record
    const spinHistoryData = {
      email,
      userId,
      rewardId: selectedReward.id,
      rewardCode,
      emailVerificationToken,
      expiresAt,
      status: RewardStatus.ACTIVE,
      emailVerified: false
    };

    const spinHistory = await spinningWheelRepository.createSpinHistory(spinHistoryData);

    // Send verification email for eligible rewards
    if (rewardCode && emailVerificationToken) {
      await sendEmail.sendRewardVerificationEmail(email, selectedReward, rewardCode, emailVerificationToken);
    }

    return {
      spin: spinHistory,
      reward: selectedReward,
      needsEmailVerification: !!rewardCode
    };
  }

  /**
   * Send reward verification email
   */


  /**
   * Verify email and activate reward
   */
  async verifyRewardEmail(verificationToken) {
    const spinHistory = await spinningWheelRepository.findSpinHistoryByVerificationToken(verificationToken);

    if (!spinHistory) {
      throw new Error("Invalid or expired verification token");
    }

    if (spinHistory.emailVerified) {
      throw new Error("Email already verified");
    }

    // Check if reward is still valid
    if (spinHistory.expiresAt && new Date() > spinHistory.expiresAt) {
      await spinningWheelRepository.updateSpinHistory(spinHistory.id, {
        status: RewardStatus.EXPIRED
      });
      throw new Error("Reward has expired");
    }

    // Verify email
    const updatedSpinHistory = await spinningWheelRepository.updateSpinHistory(spinHistory.id, {
      emailVerified: true,
      emailVerificationToken: null
    });

    return updatedSpinHistory;
  }

  /**
   * Get user's active rewards
   */
  async getUserActiveRewards(email, userId = null) {
    let rewards;

    if (userId) {
      rewards = await spinningWheelRepository.getActiveRewardsByUserId(userId);
    } else {
      rewards = await spinningWheelRepository.getActiveRewardsByEmail(email);
    }

    // Filter out expired rewards
    const now = new Date();
    return rewards.filter(reward =>
      !reward.expiresAt || reward.expiresAt > now
    );
  }

  /**
   * Validate and get reward by code
   */
  async validateRewardCode(rewardCode) {
    const spinHistory = await spinningWheelRepository.findSpinHistoryByRewardCode(rewardCode);

    if (!spinHistory) {
      throw new Error("Invalid reward code");
    }

    if (spinHistory.status !== RewardStatus.ACTIVE) {
      throw new Error("Reward is no longer active");
    }

    if (!spinHistory.emailVerified) {
      throw new Error("Email not verified for this reward");
    }

    if (spinHistory.expiresAt && new Date() > spinHistory.expiresAt) {
      await spinningWheelRepository.updateSpinHistory(spinHistory.id, {
        status: RewardStatus.EXPIRED
      });
      throw new Error("Reward has expired");
    }

    return spinHistory;
  }

  /**
   * Mark reward as used (called when user applies discount)
   */
  async markRewardAsUsed(rewardCode, usedByUserId = null) {
    const spinHistory = await this.validateRewardCode(rewardCode);

    await spinningWheelRepository.markRewardAsUsed(rewardCode);

    return {
      message: "Reward marked as used successfully",
      reward: spinHistory.reward
    };
  }

  /**
   * Get user spin history
   */
  async getUserSpinHistory(email, userId = null, limit = 10) {
    if (userId) {
      return await spinningWheelRepository.findSpinHistoryByUserId(userId, limit);
    }
    return await spinningWheelRepository.findSpinHistoryByEmail(email, limit);
  }

  /**
   * Admin: Create new spin reward
   */
  async createSpinReward(rewardData) {
    const reward = await spinningWheelRepository.createSpinReward(rewardData);
    return reward;
  }

  /**
   * Admin: Update spin reward
   */
  async updateSpinReward(rewardId, updateData) {
    const reward = await spinningWheelRepository.findRewardById(rewardId);
    if (!reward) {
      throw new Error("Reward not found");
    }

    return await spinningWheelRepository.updateSpinReward(rewardId, updateData);
  }

  /**
   * Admin: Get all rewards
   */
  async getAllRewards() {
    return await spinningWheelRepository.findAllActiveRewards();
  }

  /**
   * Admin: Get spin statistics
   */
  async getSpinStatistics(startDate, endDate) {
    return await spinningWheelRepository.getSpinStatistics(startDate, endDate);
  }

  /**
   * Cleanup expired rewards (run as cron job)
   */
  async cleanupExpiredRewards() {
    return await spinningWheelRepository.cleanupExpiredRewards();
  }

  /**
   * Associate existing spin history with user when they register/login
   */
  async associateSpinsWithUser(email, userId) {
    const userSpins = await spinningWheelRepository.findSpinHistoryByEmail(email);

    for (const spin of userSpins) {
      if (!spin.userId) {
        await spinningWheelRepository.updateSpinHistory(spin.id, {
          userId: userId
        });
      }
    }

    return userSpins.length;
  }
}

module.exports = new SpinningWheelService();