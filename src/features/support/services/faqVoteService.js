// src/services/faqVoteService.js
const faqRepository = require('../repositories/faqRepository');
const faqVoteRepository = require('../repositories/faqVoteRepository');
const faqAnalyticsService = require('./faqAnalyticsService');

class FAQVoteService {

  /**
   * Process FAQ vote
   */
  async processFAQVote(faqId, voteType, userId = null, ipAddress = null, userRole = null, feedback = null, userAgent = null) {
    try {
      // Check if user already voted
      const existingVote = await faqVoteRepository.findUserVote(faqId, userId, ipAddress);

      if (existingVote) {
        if (existingVote.voteType === voteType) {
          throw new Error('You have already voted this way on this FAQ');
        }

        // Update existing vote
        await faqVoteRepository.update(existingVote.id, {
          voteType,
          feedback,
          userAgent,
        });
      } else {
        // Create new vote
        await faqVoteRepository.create({
          faqId,
          voteType,
          userId,
          ipAddress,
          userRole,
          feedback,
          userAgent,
        });
      }

      // Update FAQ vote counts
      await this.updateFAQVoteCounts(faqId);

      // Log vote analytics
      await faqAnalyticsService.logVoteEvent({
        faqId,
        userRole,
        userId,
        userAgent,
        ipAddress,
        metadata: { voteType, feedback }
      });

      return { success: true, message: 'Vote recorded successfully' };
    } catch (error) {
      console.error('Error processing FAQ vote:', error);
      throw error;
    }
  }

  /**
   * Update FAQ vote counts
   */
  async updateFAQVoteCounts(faqId) {
    try {
      const voteCounts = await faqVoteRepository.getVoteCounts(faqId);

      let helpfulVotes = 0;
      let notHelpfulVotes = 0;

      voteCounts.forEach(vote => {
        if (vote.vote_type === 'helpful') {
          helpfulVotes = parseInt(vote.count);
        } else if (vote.vote_type === 'not_helpful') {
          notHelpfulVotes = parseInt(vote.count);
        }
      });

      await faqRepository.updateVoteCounts(faqId, helpfulVotes, notHelpfulVotes);
    } catch (error) {
      console.error('Error updating FAQ vote counts:', error);
    }
  }

  /**
   * Get vote statistics for FAQ
   */
  async getFAQVoteStats(faqId) {
    try {
      return await faqVoteRepository.getVoteCounts(faqId);
    } catch (error) {
      console.error('Error getting FAQ vote stats:', error);
      throw error;
    }
  }
}

module.exports = new FAQVoteService();
