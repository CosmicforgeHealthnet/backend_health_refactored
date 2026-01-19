// src/routes/searchRoutes.js
const express = require('express');
const router = express.Router();
const SearchController = require('../controllers/searchController');
const { authenticateJWT, authorizeRoles } = require("../../auth/middlewares/authMiddleware");
const ValidationMiddleware = require('../../../shared/middlewares/validation');
const RateLimiterMiddleware = require('../../../shared/middlewares/rateLimiter');
const SanitizerMiddleware = require('../../../shared/middlewares/sanitizer');

// Apply common middlewares
router.use(authenticateJWT);
router.use(SanitizerMiddleware.sanitizeInput);

/**
 * @route   GET /api/search
 * @desc    Universal search across all accessible entities
 * @access  Private (All authenticated users)
 */
router.get('/',
  RateLimiterMiddleware.general(),
  ValidationMiddleware.validateSearchQuery(),
  SearchController.search
);

/**
 * @route   GET /api/search/suggestions
 * @desc    Get search suggestions based on partial query
 * @access  Private (All authenticated users)
 */
router.get('/suggestions',
  RateLimiterMiddleware.general(),
  ValidationMiddleware.validateSearchSuggestions(),
  SearchController.getSuggestions
);

/**
 * @route   GET /api/search/entities
 * @desc    Get list of entities user can search
 * @access  Private (All authenticated users)
 */
router.get('/entities',
  SearchController.getSearchableEntities
);

/**
 * @route   GET /api/search/analytics
 * @desc    Get search analytics and metrics
 * @access  Private (Admin only)
 */
router.get('/analytics',
  authorizeRoles('admin', 'super_admin'),
  SearchController.getSearchAnalytics
);

module.exports = router;