// src/services/ReferralService.js
// ===================================
const AppDataSource = require('../../../config/database');
const User = require('../entities/User');
const UserReferral = require('../entities/UserReferral');
const ReferralDraw = require('../entities/ReferralDraw');
const ReferralDrawStats = require('../entities/ReferralDrawStats');
const { LessThanOrEqual, MoreThanOrEqual } = require('typeorm');


const crypto = require('node:crypto');

class ReferralService {
  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.referralRepository = AppDataSource.getRepository(UserReferral);
    this.drawRepository = AppDataSource.getRepository(ReferralDraw);
    this.drawStatsRepository = AppDataSource.getRepository(ReferralDrawStats);
  }

  /**
   * Generate unique referral code for user
   */
  generateReferralCode(userId) {
    const hash = crypto.createHash('sha256').update(userId + Date.now()).digest('hex');
    return hash.substring(0, 12).toUpperCase();
  }

  /**
   * Create referral code for user (called during user registration)
   */
  async createUserReferralCode(userId) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    if (user.referralCode) {
      return user.referralCode;
    }

    const referralCode = this.generateReferralCode(userId);

    // Ensure code is unique
    const existingCode = await this.userRepository.findOne({
      where: { referralCode }
    });

    if (existingCode) {
      return this.createUserReferralCode(userId); // Retry with new code
    }

    await this.userRepository.update(userId, { referralCode });
    return referralCode;
  }



  /**
   * Get user's referral link
   */
  async getUserReferralLink(userId) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.referralCode) {
      throw new Error('User or referral code not found');
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://dashboard.cosmicforge-healthnet.com';
    return `${baseUrl}/auth/register?ref=${user.referralCode}`;
  }

  /**
   * Process referral when new user signs up
   */
  async processReferral(newUserId, referralCode) {
    if (!referralCode) {
      return null;
    }

    const referrer = await this.userRepository.findOne({
      where: { referralCode }
    });

    if (!referrer) {
      console.log('no referral code')
      // throw new Error('Invalid referral code');
      return null
    }

    // Check if user is trying to refer themselves
    if (referrer.id === newUserId) {
      console.log('cannot refer yourself')
      // throw new Error('Cannot refer yourself');
      return null
    }

    // Check if user was already referred
    const existingReferral = await this.referralRepository.findOne({
      where: { referredUserId: newUserId }
    });

    if (existingReferral) {
      console.log('user already has a referrer')
      // throw new Error('User already has a referrer');
      return null
    }

    // Get active draw if any
    const activeDraw = await this.getActiveDraw();

    // Create referral record
    const referral = this.referralRepository.create({
      referrerId: referrer.id,
      referredUserId: newUserId,
      referralCode: referralCode,
      drawId: activeDraw?.id || null,
      status: 'pending'
    });

    await this.referralRepository.save(referral);

    // Update user's referredBy field
    await this.userRepository.update(newUserId, {
      referredBy: referrer.id
    });
    return referral;
  }

  /**
   * Verify referral (called when user completes verification)
   */
  async verifyReferral(referredUserId) {
    const referral = await this.referralRepository.findOne({
      where: { referredUserId, status: 'pending' }
    });

    if (!referral) {
      return null;
    }

    // Update referral status
    await this.referralRepository.update(referral.id, {
      status: 'verified',
      verifiedAt: new Date()
    });

    // Increment referrer's total referrals
    await this.userRepository.increment(
      { id: referral.referrerId },
      'totalReferrals',
      1
    );
    // Update draw stats if referral was made during active draw
    if (referral.drawId) {
      await this.updateDrawStats(referral.drawId, referral.referrerId);
    }

    console.log(referral);
    return referral;
  }

  /**
   * Get active draw
   */
  async getActiveDraw() {
    const now = new Date();
    return await this.drawRepository.findOne({
      where: {
        status: 'active',
        startDate: LessThanOrEqual(now),
        endDate: MoreThanOrEqual(now),
        isActive: true
      }
    });
  }

  /**
   * Update draw statistics
   */
  async updateDrawStats(drawId, userId) {
    let stats = await this.drawStatsRepository.findOne({
      where: { drawId, userId }
    });

    if (!stats) {
      stats = this.drawStatsRepository.create({
        drawId,
        userId,
        referralCount: 1
      });
    } else {
      stats.referralCount += 1;
    }

    await this.drawStatsRepository.save(stats);
  }

  /**
   * Get user's referral statistics
   */
  async getUserReferralStats(userId) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const totalReferrals = await this.referralRepository.count({
      where: { referrerId: userId, status: 'verified' }
    });

    const activeDraw = await this.getActiveDraw();
    let currentDrawStats = null;
    let leaderboardPosition = null;

    if (activeDraw) {
      currentDrawStats = await this.drawStatsRepository.findOne({
        where: { drawId: activeDraw.id, userId }
      });

      // Get leaderboard position
      const leaderboard = await this.getDrawLeaderboard(activeDraw.id, 100);
      const userPosition = leaderboard.findIndex(entry => entry.userId === userId);
      leaderboardPosition = userPosition >= 0 ? userPosition + 1 : null;
    }

    return {
      totalReferrals,
      referralCode: user.referralCode,
      referralLink: await this.getUserReferralLink(userId),
      currentDraw: activeDraw,
      currentDrawReferrals: currentDrawStats?.referralCount || 0,
      leaderboardPosition
    };
  }

  /**
   * Get draw leaderboard
   */
  async getDrawLeaderboard(drawId, limit = 10) {
    const leaderboard = await this.drawStatsRepository.find({
      where: { drawId },
      relations: ['user'],
      order: { referralCount: 'DESC' },
      take: limit
    });

    return leaderboard.map((entry, index) => ({
      position: index + 1,
      userId: entry.userId,
      username: entry.user.username || entry.user.email,
      userType: entry.user.role,
      referralCount: entry.referralCount,
      isWinner: entry.isWinner
    }));
  }

  /**
   * Get user's referral list
   */
  async getUserReferrals(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [referrals, total] = await this.referralRepository.findAndCount({
      where: { referrerId: userId },
      relations: ['referredUser'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit
    });

    return {
      referrals: referrals.map(ref => ({
        id: ref.id,
        referredUser: {
          id: ref.referredUser.id,
          username: ref.referredUser.username || ref.referredUser.email,
          role: ref.referredUser.role
        },
        status: ref.status,
        verifiedAt: ref.verifiedAt,
        createdAt: ref.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }



  /**
   * Get all draws for users (public view)
   */
  async getAllDrawsForUsers(page = 1, limit = 20, statusFilter = null) {
    const skip = (page - 1) * limit;
    const whereCondition = { isActive: true };

    if (statusFilter) {
      whereCondition.status = statusFilter;
    }

    const [draws, total] = await this.drawRepository.findAndCount({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      skip,
      take: limit
    });

    return {
      draws: draws.map(draw => ({
        id: draw.id,
        title: draw.title,
        description: draw.description,
        startDate: draw.startDate,
        endDate: draw.endDate,
        status: draw.status,
        maxWinners: draw.maxWinners,
        createdAt: draw.createdAt,
        timeRemaining: this.calculateTimeRemaining(draw.endDate),
        duration: this.calculateDrawDuration(draw.startDate, draw.endDate)
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get specific draw leaderboard with user context
   */
  async getSpecificDrawLeaderboard(drawId, limit = 10, userId = null) {
    const draw = await this.drawRepository.findOne({ where: { id: drawId } });
    if (!draw) {
      throw new Error('Draw not found');
    }

    const leaderboard = await this.drawStatsRepository.find({
      where: { drawId },
      relations: ['user'],
      order: { referralCount: 'DESC' },
      take: limit
    });

    let userStats = null;
    let userPosition = null;

    if (userId) {
      // Get user's stats for this draw
      userStats = await this.drawStatsRepository.findOne({
        where: { drawId, userId },
        relations: ['user']
      });

      // If user participated, find their position
      if (userStats) {
        const allParticipants = await this.drawStatsRepository.find({
          where: { drawId },
          order: { referralCount: 'DESC' }
        });

        userPosition = allParticipants.findIndex(p => p.userId === userId) + 1;
      }
    }

    return {
      draw: {
        id: draw.id,
        title: draw.title,
        description: draw.description,
        startDate: draw.startDate,
        endDate: draw.endDate,
        status: draw.status,
        maxWinners: draw.maxWinners
      },
      leaderboard: leaderboard.map((entry, index) => ({
        position: index + 1,
        userId: entry.userId,
        username: entry.user.username || entry.user.email,
        userType: entry.user.role,
        referralCount: entry.referralCount,
        isWinner: entry.isWinner,
        isCurrentUser: entry.userId === userId
      })),
      userStats: userStats ? {
        referralCount: userStats.referralCount,
        position: userPosition,
        isWinner: userStats.isWinner,
        participated: true
      } : {
        participated: false
      }
    };
  }

  /**
   * Get user's statistics for specific draw
   */
  async getUserDrawStats(drawId, userId) {
    const draw = await this.drawRepository.findOne({ where: { id: drawId } });
    if (!draw) {
      throw new Error('Draw not found');
    }

    const userDrawStats = await this.drawStatsRepository.findOne({
      where: { drawId, userId }
    });

    let position = null;
    if (userDrawStats) {
      // Calculate user's position in this draw
      const allParticipants = await this.drawStatsRepository.find({
        where: { drawId },
        order: { referralCount: 'DESC' }
      });
      position = allParticipants.findIndex(p => p.userId === userId) + 1;
    }

    // Get user's referrals made during this draw period
    const referralsMade = await this.referralRepository.find({
      where: {
        referrerId: userId,
        drawId: drawId,
        status: 'verified'
      },
      relations: ['referredUser'],
      order: { createdAt: 'DESC' }
    });

    return {
      draw: {
        id: draw.id,
        title: draw.title,
        description: draw.description,
        startDate: draw.startDate,
        endDate: draw.endDate,
        status: draw.status,
        maxWinners: draw.maxWinners
      },
      userPerformance: {
        participated: !!userDrawStats,
        referralCount: userDrawStats?.referralCount || 0,
        position: position,
        isWinner: userDrawStats?.isWinner || false,
        finalPosition: userDrawStats?.position // Final calculated position after draw ends
      },
      referralsMade: referralsMade.map(ref => ({
        id: ref.id,
        referredUser: {
          id: ref.referredUser.id,
          username: ref.referredUser.username || ref.referredUser.email,
          role: ref.referredUser.role
        },
        verifiedAt: ref.verifiedAt,
        createdAt: ref.createdAt
      }))
    };
  }

  /**
   * Helper method to calculate time remaining
   */
  calculateTimeRemaining(endDate) {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;

    if (diff <= 0) {
      return { expired: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return {
      expired: false,
      days,
      hours,
      minutes,
      totalMinutes: Math.floor(diff / (1000 * 60))
    };
  }

  /**
   * Helper method to calculate draw duration
   */
  calculateDrawDuration(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }






}

module.exports = new ReferralService();