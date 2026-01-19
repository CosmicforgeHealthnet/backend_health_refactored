// src/repositories/emailVerificationRepository.js
const { MoreThan } = require('typeorm');
const AppDataSource = require('../../../config/database');
const EmailVerification = require('../entities/EmailVerification');

class EmailVerificationRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(EmailVerification);
  }

  /**
   * Create a new EmailVerification instance (not yet saved)
   * @param {{ user: import('../entities/User'), token: string, expiresAt: Date }} data
   */
  create(data) {
    return this.repo.create(data);
  }

  /**
   * Save (insert or update) an EmailVerification record
   * @param {import('../entities/EmailVerification')} record
   */
  save(record) {
    return this.repo.save(record);
  }

  /**
   * Find a verification record by its token
   * @param {string} token
   */
  findByToken(token) {
    return this.repo.findOne({
      where: { token },
      relations: ['user']
    });
  }

  /**
   * Optionally: find all tokens for a given user
   * @param {string} userId
   */
  findByUser(userId) {
    return this.repo.find({
      where: { user: { id: userId } }
    });
  }

  /**
   * Delete expired or used tokens (optional cleanup)
   * @param {Date} beforeDate
   */

  async deleteOlderThan(beforeDate) {
    await this.repo.createQueryBuilder()
      .delete()
      .from(EmailVerification)
      .where('expiresAt < :before OR usedAt IS NOT NULL', { before: beforeDate })
      .execute();
  }

  countByUserSince(userId, sinceDate) {
    return this.repo.count({
      where: {
        user: { id: userId },
        createdAt: MoreThan(sinceDate)
      }
    });
  }

  /** Get the most recent token record for a user */
  findLatestByUser(userId) {
    return this.repo.findOne({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' }
    });
  }
}

module.exports = new EmailVerificationRepository();