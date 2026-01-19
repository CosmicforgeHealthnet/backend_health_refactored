// src/routes/marketingRoutes.js
const router = require('express').Router();
const {
  getSignupAnalytics,
  getTotalSignups,
  getUserEmails,
  getSignupTrends,
  getUserGrowthRate,
  getDashboard
} = require('../controllers/marketingController');

// Middleware to check admin/super admin access
const { authenticateJWT, authorizeRoles } = require('../../auth/middlewares/authMiddleware');

// Apply authentication and admin role check to all routes
router.use(authenticateJWT);

// Analytics endpoints
router.get('/analytics/signups', authorizeRoles('admin', 'super_admin'), getSignupAnalytics);
router.get('/analytics/totals', authorizeRoles('admin', 'super_admin'), getTotalSignups);
router.get('/analytics/trends', authorizeRoles('admin', 'super_admin'), getSignupTrends);
router.get('/analytics/growth', authorizeRoles('admin', 'super_admin'), getUserGrowthRate);

// Email lists
router.get('/emails', authorizeRoles('admin', 'super_admin'), getUserEmails);

// Dashboard (comprehensive data)
router.get('/dashboard', authorizeRoles('admin', 'super_admin'), getDashboard);

module.exports = router;