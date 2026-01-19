// src/services/faqAnalyticsService.js
const faqRepository = require('../repositories/faqRepository');
const faqAnalyticsRepository = require('../repositories/faqAnalyticsRepository');

class FAQAnalyticsService {

  /**
   * Log search event
   */
  async logSearchEvent(searchData) {
    try {
      return await faqAnalyticsRepository.create({
        eventType: 'search',
        ...searchData,
      });
    } catch (error) {
      console.error('Error logging search analytics:', error);
      // Don't throw error for analytics failures
    }
  }

  /**
   * Log view event
   */
  async logViewEvent(viewData) {
    try {
      return await faqAnalyticsRepository.create({
        eventType: 'view',
        ...viewData,
      });
    } catch (error) {
      console.error('Error logging view analytics:', error);
      // Don't throw error for analytics failures
    }
  }

  /**
   * Log vote event
   */
  async logVoteEvent(voteData) {
    try {
      return await faqAnalyticsRepository.create({
        eventType: 'vote',
        ...voteData,
      });
    } catch (error) {
      console.error('Error logging vote analytics:', error);
      // Don't throw error for analytics failures
    }
  }

  /**
   * Get comprehensive analytics
   */
  async getComprehensiveAnalytics(startDate = null, endDate = null) {
    try {
      const [
        faqStats,
        searchAnalytics,
        viewAnalytics,
        userRoleStats
      ] = await Promise.all([
        faqRepository.getStatistics(),
        faqAnalyticsRepository.getSearchAnalytics(startDate, endDate),
        faqAnalyticsRepository.getViewAnalytics(startDate, endDate),
        faqAnalyticsRepository.getUserRoleStats(startDate, endDate)
      ]);

      return {
        overview: {
          faqStats,
          timeRange: { startDate, endDate }
        },
        searchAnalytics: {
          topSearches: searchAnalytics.slice(0, 20),
          total: searchAnalytics.length
        },
        viewAnalytics: {
          mostViewed: viewAnalytics.slice(0, 20),
          total: viewAnalytics.length
        },
        userRoleStats
      };
    } catch (error) {
      console.error('Error getting comprehensive analytics:', error);
      throw error;
    }
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(startDate = null, endDate = null) {
    try {
      return await faqAnalyticsRepository.getSearchAnalytics(startDate, endDate);
    } catch (error) {
      console.error('Error getting search analytics:', error);
      throw error;
    }
  }

  /**
   * Get view analytics
   */
  async getViewAnalytics(startDate = null, endDate = null) {
    try {
      return await faqAnalyticsRepository.getViewAnalytics(startDate, endDate);
    } catch (error) {
      console.error('Error getting view analytics:', error);
      throw error;
    }
  }

  /**
   * Get user role statistics
   */
  async getUserRoleStats(startDate = null, endDate = null) {
    try {
      return await faqAnalyticsRepository.getUserRoleStats(startDate, endDate);
    } catch (error) {
      console.error('Error getting user role stats:', error);
      throw error;
    }
  }
}

module.exports = new FAQAnalyticsService();
