// src/services/refreshTokenService.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const refreshTokenRepository = require('../repositories/refreshTokenRepository');

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES_DAYS = 30;
const BCRYPT_SALT_ROUNDS = 12;

class RefreshTokenService {
  /** Issue a new refresh token for a given user and device */
  async issueRefreshToken(user, deviceFingerprint, userAgent) {
    // Generate a secure random token
    const rawToken = crypto.randomBytes(64).toString('hex');
    // Hash before storing
    const tokenHash = await bcrypt.hash(rawToken, BCRYPT_SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    // Create & save record
    const record = refreshTokenRepository.create({
      user,
      tokenHash,
      deviceFingerprint,
      userAgent,
      expiresAt
    });
    await refreshTokenRepository.save(record);

    // Return the raw token to client
    return rawToken;
  }

  /** Rotate: consume an existing raw refresh token, issue new access & refresh tokens */
  async rotateRefreshToken(rawToken, deviceFingerprint, userAgent) {
    // Find all active tokens for this device
    const candidates = await refreshTokenRepository.findActiveByFingerprint(deviceFingerprint);
    // Identify matching record by comparing hashes
    const record = candidates.find(r =>
      bcrypt.compareSync(rawToken, r.tokenHash)
    );
    if (!record) {
      throw new Error('Invalid or expired refresh token');
    }

    // Revoke the old token
    await refreshTokenRepository.revoke(record);

    // Issue a new refresh token
    const newRawToken = await this.issueRefreshToken(record.user, deviceFingerprint, userAgent);

    // Issue a new access token
    const payload = {
      sub: record.user.id,
      email: record.user.email,
      fullName: record.user.fullName,
      role: record.user.role,
      status: record.user.status,
      provider: record.user.provider,
      providerId: record.user.providerId,
      profileImageUrl: record.user.profileImageUrl,
      mfaEnabled: record.user.mfaEnabled,
      createdAt: record.user.createdAt,
      updatedAt: record.user.updatedAt
    };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });

    return { payload, accessToken, refreshToken: newRawToken };
  }

  /** Explicitly revoke a refresh token (for logout) */
  async revokeToken(rawToken, deviceFingerprint) {
    const candidates = await refreshTokenRepository.findActiveByFingerprint(deviceFingerprint);
    const record = candidates.find(r =>
      bcrypt.compareSync(rawToken, r.tokenHash)
    );
    if (record) {
      await refreshTokenRepository.revoke(record);
    }
  }
}

module.exports = new RefreshTokenService();
