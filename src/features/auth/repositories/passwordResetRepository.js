// src/repositories/passwordResetRepository.js
const AppDataSource = require('../../../config/database');
const PasswordResetToken = require('../entities/PasswordResetToken');
const { MoreThan } = require('typeorm');

class PasswordResetRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(PasswordResetToken);
  }

  create(data) {
    return this.repo.create(data);
  }

  save(record) {
    return this.repo.save(record);
  }

  findByToken(token) {
    return this.repo.findOne({
      where: { token },
      relations: ['user']
    });
  }

  /**
   * Find a reset record by its token or OTP for a specific user
   * @param {string} tokenOrOtp
   * @param {string} userId
   */
  findByTokenAndUser(tokenOrOtp, userId) {
    return this.repo.findOne({
      where: { token: tokenOrOtp, user: { id: userId } },
      relations: ['user']
    });
  }

  async deleteExpired(beforeDate) {
    await this.repo.createQueryBuilder()
      .delete()
      .from(PasswordResetToken)
      .where('expiresAt < :d OR usedAt IS NOT NULL', { d: beforeDate })
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

  findLatestByUser(userId) {
    return this.repo.findOne({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' }
    });
  }
}


module.exports = new PasswordResetRepository();
