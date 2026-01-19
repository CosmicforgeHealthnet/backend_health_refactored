// src/repositories/refreshTokenRepository.js
const { MoreThan } = require('typeorm');
const AppDataSource = require('../../../config/database');
const RefreshToken = require('../entities/RefreshToken');

class RefreshTokenRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(RefreshToken);
  }

  create(data) {
    return this.repo.create(data);
  }

  save(record) {
    return this.repo.save(record);
  }

  /** Find active (not revoked, not expired) tokens for a device */
  findActiveByFingerprint(fingerprint) {
    return this.repo.find({
      where: {
        deviceFingerprint: fingerprint,
        revokedAt: null,
        expiresAt: MoreThan(new Date())
      },
      relations: ['user']
    });
  }

  /** Optional: revoke a token record */
  revoke(record) {
    record.revokedAt = new Date();
    return this.repo.save(record);
  }
}

module.exports = new RefreshTokenRepository();
