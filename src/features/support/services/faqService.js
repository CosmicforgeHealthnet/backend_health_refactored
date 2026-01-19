// src/services/faqService.js
const faqRepository = require('../repositories/faqRepository');
const faqCategoryRepository = require('../repositories/faqCategoryRepository');
const faqVoteRepository = require('../repositories/faqVoteRepository');
const faqAnalyticsRepository = require('../repositories/faqAnalyticsRepository');
const faqHelpers = require('../helpers/faqHelpers');
const faqAnalyticsService = require('./faqAnalyticsService');
const faqVoteService = require('./faqVoteService');

class FAQService {

  /**
   * Get FAQs for a specific role
   */
  async getFAQsByRole(targetRole, categorySlug = null) {
    try {
      let faqs;

      if (categorySlug) {
        const category = await faqCategoryRepository.findBySlug(categorySlug);
        if (!category) {
          throw new Error('Category not found');
        }
        faqs = await faqRepository.findByCategory(category.id, targetRole);
      } else {
        faqs = await faqRepository.findByRole(targetRole);
      }

      // Group FAQs by category using helper
      const groupedFAQs = faqHelpers.groupFAQsByCategory(faqs);

      return {
        faqs: groupedFAQs,
        total: faqs.length,
        role: targetRole,
        category: categorySlug || 'all'
      };
    } catch (error) {
      console.error('Error getting FAQs by role:', error);
      throw error;
    }
  }

  /**
   * Search FAQs
   */
  async searchFAQs(query, targetRole = null, limit = 20, userId = null, sessionId = null, userAgent = null, ipAddress = null) {
    try {
      // Log search analytics
      await faqAnalyticsService.logSearchEvent({
        searchQuery: query,
        userRole: targetRole,
        userId,
        sessionId,
        userAgent,
        ipAddress,
      });

      const faqs = await faqRepository.search(query, targetRole, limit);

      return {
        faqs,
        query,
        total: faqs.length,
        role: targetRole || 'all'
      };
    } catch (error) {
      console.error('Error searching FAQs:', error);
      throw error;
    }
  }

  /**
   * Get single FAQ by slug
   */
  async getFAQBySlug(slug, userId = null, sessionId = null, userAgent = null, ipAddress = null, userRole = null) {
    try {
      const faq = await faqRepository.findBySlug(slug);

      if (!faq || faq.status !== 'published') {
        throw new Error('FAQ not found');
      }

      // Increment view count
      await faqRepository.incrementViewCount(faq.id);

      // Log view analytics
      await faqAnalyticsService.logViewEvent({
        faqId: faq.id,
        userRole,
        userId,
        sessionId,
        userAgent,
        ipAddress,
      });

      return faq;
    } catch (error) {
      console.error('Error getting FAQ by slug:', error);
      throw error;
    }
  }

  /**
   * Vote on FAQ
   */
  async voteFAQ(faqId, voteType, userId = null, ipAddress = null, userRole = null, feedback = null, userAgent = null) {
    try {
      return await faqVoteService.processFAQVote(
        faqId,
        voteType,
        userId,
        ipAddress,
        userRole,
        feedback,
        userAgent
      );
    } catch (error) {
      console.error('Error voting on FAQ:', error);
      throw error;
    }
  }

  /**
   * Get categories for role
   */
  async getCategoriesByRole(targetRole) {
    try {
      return await faqCategoryRepository.findByRole(targetRole);
    } catch (error) {
      console.error('Error getting categories by role:', error);
      throw error;
    }
  }

  /**
   * Get popular FAQs
   */
  async getPopularFAQs(targetRole = null, limit = 10) {
    try {
      return await faqRepository.getPopular(targetRole, limit);
    } catch (error) {
      console.error('Error getting popular FAQs:', error);
      throw error;
    }
  }

  /**
   * Get most viewed FAQs
   */
  async getMostViewedFAQs(targetRole = null, limit = 10) {
    try {
      return await faqRepository.getMostViewed(targetRole, limit);
    } catch (error) {
      console.error('Error getting most viewed FAQs:', error);
      throw error;
    }
  }
}

module.exports = new FAQService();