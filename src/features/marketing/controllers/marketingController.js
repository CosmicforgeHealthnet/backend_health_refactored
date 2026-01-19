// src/controllers/marketingController.js
const marketingAnalyticsService = require('../services/marketingAnalyticsService');

/**
 * Get signup analytics by period
 */
exports.getSignupAnalytics = async (req, res, next) => {
  try {
    const { period = 'day', startDate, endDate } = req.query;
    
    const analytics = await marketingAnalyticsService.getSignupAnalytics(
      period, 
      startDate, 
      endDate
    );

    res.json({
      success: true,
      data: analytics,
      period,
      filters: { startDate, endDate }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get total signup counts
 */
exports.getTotalSignups = async (req, res, next) => {
  try {
    const totals = await marketingAnalyticsService.getTotalSignups();
    
    res.json({
      success: true,
      data: totals
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get user emails by role
 */
exports.getUserEmails = async (req, res, next) => {
  try {
    const { role = 'all' } = req.query;
    
    const emails = await marketingAnalyticsService.getUserEmails(role);
    
    res.json({
      success: true,
      data: emails,
      count: emails.length,
      role
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get signup trends with comparison
 */
exports.getSignupTrends = async (req, res, next) => {
  try {
    const { period = 'day', limit = 30 } = req.query;
    
    const trends = await marketingAnalyticsService.getSignupTrends(
      period, 
      parseInt(limit)
    );
    
    res.json({
      success: true,
      data: trends
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get user growth rate
 */
exports.getUserGrowthRate = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    
    const growthRate = await marketingAnalyticsService.getUserGrowthRate(
      parseInt(days)
    );
    
    res.json({
      success: true,
      data: growthRate
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get comprehensive marketing dashboard data
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const { period = 'day' } = req.query;
    
    // Get all data in parallel
    const [
      totals,
      analytics,
      trends,
      growthRate
    ] = await Promise.all([
      marketingAnalyticsService.getTotalSignups(),
      marketingAnalyticsService.getSignupAnalytics(period),
      marketingAnalyticsService.getSignupTrends(period),
      marketingAnalyticsService.getUserGrowthRate(30)
    ]);

    res.json({
      success: true,
      data: {
        totals,
        analytics: analytics.slice(0, 30), // Last 30 periods
        trends,
        growthRate
      },
      period
    });
  } catch (err) {
    next(err);
  }
};