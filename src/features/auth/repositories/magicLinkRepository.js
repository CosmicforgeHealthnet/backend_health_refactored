// src/repositories/magicLinkRepository.js
const { MoreThan } = require('typeorm');
const AppDataSource = require('../../../config/database');
const MagicLinkToken = require('../entities/MagicLinkToken');

class MagicLinkRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(MagicLinkToken);
  }

  /**
   * Create a new MagicLinkToken instance
   * @param {{ user: import('../entities/User'), token: string, purpose: string, ip: string, userAgent: string, expiresAt: Date }} data
   */
  create(data) {
    return this.repo.create(data);
  }

  /** Save (insert or update) MagicLinkToken */
  save(record) {
    return this.repo.save(record);
  }

  /** Find a token record by its token value, including user relation */
  findByToken(token) {
    return this.repo.findOne({
      where: { token },
      relations: ['user'],
    });
  }

  /** Optional cleanup: delete expired or used tokens older than given date */
  async deleteOlderThan(beforeDate) {
    await this.repo.createQueryBuilder()
      .delete()
      .from(MagicLinkToken)
      .where('expiresAt < :before OR usedAt IS NOT NULL', { before: beforeDate })
      .execute();
  }
}

module.exports = new MagicLinkRepository();
