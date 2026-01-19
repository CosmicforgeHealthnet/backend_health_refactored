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
