// src/jobs/ReferralDrawJob.js
// ===================================
const cron = require("node-cron");
const ReferralDrawService = require("../services/referralDrawService");
const { LessThanOrEqual } = require("typeorm");

class ReferralDrawJob {
  constructor() {
    this.drawService = new ReferralDrawService();
  }

  start() {
    // Check for draws to start/end every minute
    cron.schedule("* * * * *", async () => {

      // console.log('🌀 Referral draw watching');

      await this.checkDrawStatus();
    });
  }

  async checkDrawStatus() {
    try {
      const now = new Date();

      // Check for draws that should start
      const pendingDraws = await this.drawService.drawRepository.find({
        where: {
          status: "pending",
          startDate: LessThanOrEqual(now),
          isActive: true
        },
      });

      for (const draw of pendingDraws) {
        await this.drawService.startDraw(draw.id);
        console.log(`🎉 Started draw: ${draw.title} (ID: ${draw.id})`);
      }

      // Check for draws that should end
      const activeDraws = await this.drawService.drawRepository.find({
        where: {
          status: "active",
          endDate: LessThanOrEqual(now),
          isActive: true,
        },
      });

      for (const draw of activeDraws) {
        await this.drawService.endDraw(draw.id);
        console.log(`Ended draw: ${draw.title} (ID: ${draw.id})`);
      }

      // console.log('🌀 Referral draw watching');

    } catch (error) {
      console.error("Error checking draw status:", error);
    }
  }
}

module.exports = ReferralDrawJob;
