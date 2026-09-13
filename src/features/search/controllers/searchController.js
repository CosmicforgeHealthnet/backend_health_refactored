// src/controllers/searchController.js
const searchService = require('../services/searchService');

class SearchController {
  /**
   * Universal search endpoint
   * GET /api/search?q=query&category=optional&limit=10
   */
  static async search(req, res, next) {
    try {
      const { q: query, category, limit = 10, ...filters } = req.query;
      const userId = req.user?.sub || null;
      const userRole = req.user?.role || 'public';

      // Validate query
      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Search query must be at least 2 characters long'
        });
      }

      // Perform search
      const results = await searchService.search(
        query, 
        userId, 
        userRole, 
        { category, limit: parseInt(limit), ...filters }
      );

      res.json({
        success: true,
        message: 'Search completed successfully',
        data: results
      });

    } catch (error) {
      console.error('Search controller error:', error);
      next(error);
    }
  }

  /**
   * Get search suggestions
   * GET /api/search/suggestions?q=partial_query
   */
  static async getSuggestions(req, res, next) {
    try {
      const { q: query } = req.query;
      const userRole = req.user?.role || 'public';

      if (!query || query.trim().length < 1) {
        return res.json({
          success: true,
          data: { suggestions: [] }
        });
      }

      const suggestions = await searchService.generateSuggestions(query, userRole);

      res.json({
        success: true,
        message: 'Suggestions retrieved successfully',
        data: { suggestions }
      });

    } catch (error) {
      console.error('Search suggestions error:', error);
      next(error);
    }
  }

  /**
   * Get search analytics (Admin only)
   * GET /api/search/analytics
   */
  static async getSearchAnalytics(req, res, next) {
    try {
      if (!['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const analytics = await searchService.getSearchAnalytics();

      res.json({
        success: true,
        message: 'Search analytics retrieved successfully',
        data: analytics
      });

    } catch (error) {
      console.error('Search analytics error:', error);
      next(error);
    }
  }

  /**
   * Get searchable entities for current user
   * GET /api/search/entities
   */
  static async getSearchableEntities(req, res, next) {
    try {
      const userId = req.user?.sub || null;
      const userRole = req.user?.role || 'public';

      const entities = await searchService.getSearchableEntities(userId, userRole);

      res.json({
        success: true,
        message: 'Searchable entities retrieved successfully',
        data: { entities: Object.keys(entities) }
      });

    } catch (error) {
      console.error('Get searchable entities error:', error);
      next(error);
    }
  }
}

module.exports = SearchController;