// src/routes/searchRoutes.js
const express = require('express');
const router = express.Router();
const SearchController = require('../controllers/searchController');
const { authenticateJWT, authorizeRoles, optionalAuth } = require("../../auth/middlewares/authMiddleware");
const ValidationMiddleware = require('../../../shared/middlewares/validation');
const RateLimiterMiddleware = require('../../../shared/middlewares/rateLimiter');
const SanitizerMiddleware = require('../../../shared/middlewares/sanitizer');

// Auth is optional here (not mandatory) - anonymous visitors can still search
// public entities like doctors, products, and lab facilities. Logged-in users
// get the extra entities/fields their role is permissioned for.
router.use(optionalAuth);
router.use(SanitizerMiddleware.sanitizeInput);

/**
 * @route   GET /api/search
 * @desc    Universal search across all accessible entities
 * @access  Public (more entities/fields unlocked when authenticated)
 */
router.get('/',
  RateLimiterMiddleware.general(),
  ValidationMiddleware.validateSearchQuery(),
  SearchController.search
);

/**
 * @route   GET /api/search/suggestions
 * @desc    Get search suggestions based on partial query
 * @access  Public (more entities/fields unlocked when authenticated)
 */
router.get('/suggestions',
  RateLimiterMiddleware.general(),
  ValidationMiddleware.validateSearchSuggestions(),
  SearchController.getSuggestions
);

/**
 * @route   GET /api/search/entities
 * @desc    Get list of entities user can search
 * @access  Public (more entities/fields unlocked when authenticated)
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
  authenticateJWT,
  authorizeRoles('admin', 'super_admin'),
  SearchController.getSearchAnalytics
);

module.exports = router;