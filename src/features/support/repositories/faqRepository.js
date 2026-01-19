// src/repositories/faqRepository.js
const AppDataSource = require('../../../config/database');
const FAQ = require('../entities/FAQ');

class FAQRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(FAQ);
  }

  async findById(id, relations = []) {
    return this.repo.findOne({
      where: { id },
      relations,
    });
  }

  async findBySlug(slug, relations = ['category']) {
    return this.repo.findOne({
      where: { slug },
      relations,
    });
  }

  async findByRole(targetRole, status = 'published') {
    return this.repo.find({
      where: [
        { targetRole, status },
        { targetRole: 'all', status }
      ],
      relations: ['category'],
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async findByCategory(categoryId, targetRole = null) {
    const where = { categoryId, status: 'published' };
    if (targetRole) {
      where.targetRole = targetRole;
    }

    return this.repo.find({
      where,
      relations: ['category'],
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async search(query, targetRole = null, limit = 20) {
    let queryBuilder = this.repo
      .createQueryBuilder('faq')
      .leftJoinAndSelect('faq.category', 'category')
      .where('faq.status = :status', { status: 'published' })
      .andWhere(
        '(faq.title ILIKE :query OR faq.content ILIKE :query OR faq.searchKeywords ILIKE :query)',
        { query: `%${query}%` }
      );

    if (targetRole) {
      queryBuilder = queryBuilder.andWhere(
        '(faq.targetRole = :targetRole OR faq.targetRole = :all)',
        { targetRole, all: 'all' }
      );
    }

    return queryBuilder
      .orderBy('faq.priority', 'DESC')
      .addOrderBy('faq.viewCount', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getMostViewed(targetRole = null, limit = 10) {
    const where = { status: 'published' };
    if (targetRole) {
      where.targetRole = targetRole;
    }

    return this.repo.find({
      where,
      relations: ['category'],
      order: { viewCount: 'DESC', helpfulVotes: 'DESC' },
      take: limit,
    });
  }

  async getPopular(targetRole = null, limit = 10) {
    let queryBuilder = this.repo
      .createQueryBuilder('faq')
      .leftJoinAndSelect('faq.category', 'category')
      .where('faq.status = :status', { status: 'published' });

    if (targetRole) {
      queryBuilder = queryBuilder.andWhere(
        '(faq.targetRole = :targetRole OR faq.targetRole = :all)',
        { targetRole, all: 'all' }
      );
    }

    return queryBuilder
      .orderBy('(faq.helpfulVotes::float / GREATEST(faq.helpfulVotes + faq.notHelpfulVotes, 1))', 'DESC')
      .addOrderBy('faq.viewCount', 'DESC')
      .limit(limit)
      .getMany();
  }

  async incrementViewCount(id) {
    return this.repo.increment({ id }, 'viewCount', 1);
  }

  async updateVoteCounts(id, helpfulVotes, notHelpfulVotes) {
    return this.repo.update(id, {
      helpfulVotes,
      notHelpfulVotes,
      updatedAt: new Date(),
    });
  }

  async create(faqData) {
    const faq = this.repo.create(faqData);
    return this.repo.save(faq);
  }

  async update(id, updateData) {
    updateData.updatedAt = new Date();
    await this.repo.update(id, updateData);
    return this.findById(id, ['category']);
  }

  async delete(id) {
    return this.repo.delete(id);
  }

  async findAll(filters = {}) {
    const { status, targetRole, isStatic, page = 1, limit = 50 } = filters;

    let queryBuilder = this.repo
      .createQueryBuilder('faq')
      .leftJoinAndSelect('faq.category', 'category')
      .leftJoinAndSelect('faq.creator', 'creator')
      .leftJoinAndSelect('faq.updater', 'updater');

    if (status) {
      queryBuilder = queryBuilder.andWhere('faq.status = :status', { status });
    }

    if (targetRole) {
      queryBuilder = queryBuilder.andWhere('faq.targetRole = :targetRole', { targetRole });
    }

    if (typeof isStatic === 'boolean') {
      queryBuilder = queryBuilder.andWhere('faq.isStatic = :isStatic', { isStatic });
    }

    return queryBuilder
      .orderBy('faq.priority', 'DESC')
      .addOrderBy('faq.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  }

  async getStatistics() {
    return this.repo
      .createQueryBuilder('faq')
      .select([
        'faq.targetRole as target_role',
        'faq.status as status',
        'COUNT(*) as count',
        'AVG(faq.viewCount) as avg_views',
        'SUM(faq.helpfulVotes) as total_helpful',
        'SUM(faq.notHelpfulVotes) as total_not_helpful',
      ])
      .groupBy('faq.targetRole, faq.status')
      .getRawMany();
  }
}

module.exports = new FAQRepository();
