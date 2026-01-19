// src/services/marketingAnalyticsService.js
const AppDataSource = require('../../../config/database');
const User = require('../../auth/entities/User');
const { USER_ROLES } = require('../../../shared/utils/constants');

class MarketingAnalyticsService {
  constructor() {
    this.userRepo = AppDataSource.getRepository(User);
  }

  /**
   * Get signup analytics by time period
   * @param {string} period - 'day', 'week', 'month'
   * @param {string} startDate - ISO date string (optional)
   * @param {string} endDate - ISO date string (optional)
   */
  async getSignupAnalytics(period = 'day', startDate = null, endDate = null) {
    let dateFormat;
    let groupByExpression;

    // Set date format and grouping based on period
    switch (period) {
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        groupByExpression = 'DATE(user.createdAt)';
        break;
      case 'week':
        dateFormat = 'YYYY-"W"WW';
        groupByExpression = 'DATE_TRUNC(\'week\', user.createdAt)';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        groupByExpression = 'DATE_TRUNC(\'month\', user.createdAt)';
        break;
      default:
        throw new Error('Invalid period. Use day, week, or month');
    }

    let query = this.userRepo
      .createQueryBuilder('user')
      .select([
        `${groupByExpression} as date_group`,
        `TO_CHAR(${groupByExpression}, '${dateFormat}') as period`,
        'COUNT(*) as total_signups',
        `COUNT(CASE WHEN user.role = '${USER_ROLES.DOCTOR}' THEN 1 END) as doctor_signups`,
        `COUNT(CASE WHEN user.role = '${USER_ROLES.PATIENT}' THEN 1 END) as patient_signups`
      ])
      .groupBy('date_group')
      .orderBy('date_group', 'DESC');

    // Add date filters if provided
    if (startDate) {
      query = query.andWhere('user.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      query = query.andWhere('user.createdAt <= :endDate', { endDate });
    }

    const results = await query.getRawMany();

    return results.map(row => ({
      period: row.period,
      totalSignups: parseInt(row.total_signups),
      doctorSignups: parseInt(row.doctor_signups),
      patientSignups: parseInt(row.patient_signups)
    }));
  }

  /**
   * Get total signup counts
   */
  async getTotalSignups() {
    const result = await this.userRepo
      .createQueryBuilder('user')
      .select([
        'COUNT(*) as total',
        `COUNT(CASE WHEN user.role = '${USER_ROLES.DOCTOR}' THEN 1 END) as doctors`,
        `COUNT(CASE WHEN user.role = '${USER_ROLES.PATIENT}' THEN 1 END) as patients`
      ])
      .getRawOne();

    return {
      total: parseInt(result.total),
      doctors: parseInt(result.doctors),
      patients: parseInt(result.patients)
    };
  }

  /**
   * Get user emails by role
   * @param {string} role - 'doctor', 'patient', or 'all'
   */
  async getUserEmails(role = 'all') {
    let query = this.userRepo
      .createQueryBuilder('user')
      .select(['user.email', 'user.fullName', 'user.role', 'user.phoneNumber', 'user.createdAt'])
      .orderBy('user.createdAt', 'DESC');

    if (role !== 'all') {
      if (!Object.values(USER_ROLES).includes(role)) {
        throw new Error('Invalid role specified');
      }
      query = query.where('user.role = :role', { role });
    }

    const users = await query.getMany();

    return users.map(user => ({
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phoneNumber: user.phoneNumber,
      createdAt: user.createdAt
    }));
  }

  /**
   * Get signup trends (comparing periods)
   */
  async getSignupTrends(period = 'day', limit = 30) {
    const analytics = await this.getSignupAnalytics(period);

    if (analytics.length < 2) {
      return {
        trend: 'neutral',
        percentageChange: 0,
        data: analytics
      };
    }

    const latest = analytics[0];
    const previous = analytics[1];

    const change = latest.totalSignups - previous.totalSignups;
    const percentageChange = previous.totalSignups > 0
      ? ((change / previous.totalSignups) * 100).toFixed(2)
      : 0;

    let trend = 'neutral';
    if (change > 0) trend = 'up';
    if (change < 0) trend = 'down';

    return {
      trend,
      percentageChange: parseFloat(percentageChange),
      currentPeriod: latest,
      previousPeriod: previous,
      data: analytics.slice(0, limit)
    };
  }

  /**
   * Get user growth rate
   */
  async getUserGrowthRate(days = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const currentPeriodUsers = await this.userRepo
      .createQueryBuilder('user')
      .where('user.createdAt >= :startDate', { startDate })
      .andWhere('user.createdAt <= :endDate', { endDate })
      .getCount();

    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - days);

    const previousPeriodUsers = await this.userRepo
      .createQueryBuilder('user')
      .where('user.createdAt >= :previousStartDate', { previousStartDate })
      .andWhere('user.createdAt < :startDate', { startDate })
      .getCount();

    const growthRate = previousPeriodUsers > 0
      ? (((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) * 100).toFixed(2)
      : 0;

    return {
      currentPeriod: currentPeriodUsers,
      previousPeriod: previousPeriodUsers,
      growthRate: parseFloat(growthRate),
      period: `${days} days`
    };
  }
}

module.exports = new MarketingAnalyticsService();