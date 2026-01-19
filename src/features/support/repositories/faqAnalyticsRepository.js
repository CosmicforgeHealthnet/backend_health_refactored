// src/repositories/faqAnalyticsRepository.js
const AppDataSource = require('../../../config/database');
const FAQAnalytics = require('../entities/FAQAnalytics');

class FAQAnalyticsRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(FAQAnalytics);
  }

  async create(analyticsData) {
    const analytics = this.repo.create(analyticsData);
    return this.repo.save(analytics);
  }

  async getSearchAnalytics(startDate = null, endDate = null) {
    let queryBuilder = this.repo
      .createQueryBuilder('analytics')
      .select([
        'analytics.searchQuery as search_query',
        'COUNT(*) as search_count',
        'analytics.userRole as user_role',
      ])
      .where('analytics.eventType = :eventType', { eventType: 'search' })
      .andWhere('analytics.searchQuery IS NOT NULL');

    if (startDate) {
      queryBuilder = queryBuilder.andWhere('analytics.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder = queryBuilder.andWhere('analytics.createdAt <= :endDate', { endDate });
    }

    return queryBuilder
      .groupBy('analytics.searchQuery, analytics.userRole')
      .orderBy('search_count', 'DESC')
      .limit(100)
      .getRawMany();
  }

  async getViewAnalytics(startDate = null, endDate = null) {
    let queryBuilder = this.repo
      .createQueryBuilder('analytics')
      .leftJoin('analytics.faq', 'faq')
      .select([
        'faq.id as faq_id',
        'faq.title as faq_title',
        'COUNT(*) as view_count',
        'analytics.userRole as user_role',
      ])
      .where('analytics.eventType = :eventType', { eventType: 'view' });

    if (startDate) {
      queryBuilder = queryBuilder.andWhere('analytics.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder = queryBuilder.andWhere('analytics.createdAt <= :endDate', { endDate });
    }

    return queryBuilder
      .groupBy('faq.id, faq.title, analytics.userRole')
      .orderBy('view_count', 'DESC')
      .limit(50)
      .getRawMany();
  }

  async getUserRoleStats(startDate = null, endDate = null) {
    let queryBuilder = this.repo
      .createQueryBuilder('analytics')
      .select([
        'analytics.userRole as user_role',
        'analytics.eventType as event_type',
        'COUNT(*) as count',
      ]);

    if (startDate) {
      queryBuilder = queryBuilder.where('analytics.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder = queryBuilder.andWhere('analytics.createdAt <= :endDate', { endDate });
    }

    return queryBuilder
      .groupBy('analytics.userRole, analytics.eventType')
      .orderBy('count', 'DESC')
      .getRawMany();
  }
}

module.exports = new FAQAnalyticsRepository();
