const AppDataSource = require("../../../config/database");
const User = require('../entities/User');
const ReferralDraw = require('../entities/ReferralDraw');
const ReferralDrawStats = require('../entities/ReferralDrawStats');
const { LessThanOrEqual, MoreThanOrEqual, In } = require("typeorm");

// src/services/ReferralDrawService.js
// ===================================
class ReferralDrawService {
  constructor() {
    this.drawRepository = AppDataSource.getRepository(ReferralDraw);
    this.drawStatsRepository = AppDataSource.getRepository(ReferralDrawStats);
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Create new referral draw (Marketing Team)
   */
  async createDraw(drawData, createdBy) {
    const { title, description, startDate, endDate, maxWinners } = drawData;

    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
      throw new Error("Start date must be before end date");
    }

    // // Check for overlapping draws
    // const overlappingDraw = await this.drawRepository.findOne({
    //   where: [
    //     {
    //       startDate: LessThanOrEqual(new Date(endDate)),
    //       endDate: MoreThanOrEqual(new Date(startDate)),
    //       status: In(['pending', 'active']),
    //       isActive: true
    //     }
    //   ]
    // });

    // if (overlappingDraw) {
    //   throw new Error('Draw period overlaps with existing draw');
    // }

    // Cancel any existing active or pending draws
    await this.cancelExistingDraws(createdBy);

    const draw = this.drawRepository.create({
      title,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxWinners: maxWinners || 10,
      createdBy,
      status: "pending",
    });

    return await this.drawRepository.save(draw);
  }

  /**
   * Start a draw (automatically or manually)
   */
  async startDraw(drawId) {
    const draw = await this.drawRepository.findOne({ where: { id: drawId } });
    if (!draw) {
      throw new Error("Draw not found");
    }

    if (draw.status !== "pending") {
      throw new Error("Draw is not in pending status");
    }

    await this.drawRepository.update(drawId, { status: "active" });
    return draw;
  }

  /**
   * End a draw and calculate final positions
   */
  async endDraw(drawId) {
    const draw = await this.drawRepository.findOne({ where: { id: drawId } });
    if (!draw) {
      throw new Error("Draw not found");
    }

    if (draw.status !== "active") {
      throw new Error("Draw is not active");
    }

    // Get all participants sorted by referral count
    const participants = await this.drawStatsRepository.find({
      where: { drawId },
      order: { referralCount: "DESC" },
    });

    // Update positions and mark winners
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      const position = i + 1;
      const isWinner = position <= draw.maxWinners;

      await this.drawStatsRepository.update(participant.id, {
        position,
        isWinner,
      });
    }

    // Update draw status
    await this.drawRepository.update(drawId, { status: "ended" });

    return {
      draw,
      totalParticipants: participants.length,
      winners: participants.slice(0, draw.maxWinners),
    };
  }

  /**
   * Get all draws (for admin)
   */
  async getAllDraws(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [draws, total] = await this.drawRepository.findAndCount({
      relations: ["creator"],
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    });

    return {
      draws: draws.map((draw) => ({
        id: draw.id,
        title: draw.title,
        description: draw.description,
        startDate: draw.startDate,
        endDate: draw.endDate,
        status: draw.status,
        maxWinners: draw.maxWinners,
        createdBy: draw.creator.username || draw.creator.email,
        createdAt: draw.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get draw statistics
   */
  async getDrawStats(drawId) {
    const draw = await this.drawRepository.findOne({ where: { id: drawId } });
    if (!draw) {
      throw new Error("Draw not found");
    }

    const totalParticipants = await this.drawStatsRepository.count({
      where: { drawId },
    });

    const topReferrers = await this.drawStatsRepository.find({
      where: { drawId },
      relations: ["user"],
      order: { referralCount: "DESC" },
      take: 10,
    });

    const winners = await this.drawStatsRepository.find({
      where: { drawId, isWinner: true },
      relations: ["user"],
      order: { position: "ASC" },
    });

    return {
      draw,
      totalParticipants,
      topReferrers: topReferrers.map((entry, index) => ({
        position: index + 1,
        user: {
          id: entry.user.id,
          username: entry.user.username || entry.user.email,
          role: entry.user.role,
        },
        referralCount: entry.referralCount,
      })),
      winners: winners.map((entry) => ({
        position: entry.position,
        user: {
          id: entry.user.id,
          username: entry.user.username || entry.user.email,
          role: entry.user.role,
          email: entry.user.email,
        },
        referralCount: entry.referralCount,
      })),
    };
  }

  /**
   * Cancel all existing active or pending draws
   */
  async cancelExistingDraws(createdBy) {
    // Find all active or pending draws
    const existingDraws = await this.drawRepository.find({
      where: [
        { status: "active", isActive: true },
        { status: "pending", isActive: true },
      ],
    });

    if (existingDraws.length > 0) {
      // Cancel all existing draws
      await this.drawRepository.update(
        {
          status: In(["pending", "active"]),
          isActive: true,
        },
        {
          status: "cancelled",
          updatedAt: new Date(),
        }
      );

      console.log(
        `Cancelled ${existingDraws.length} existing draws when creating new draw by user ${createdBy}`
      );
    }

    return existingDraws.length;
  }
}

module.exports = ReferralDrawService;
