// src/features/auth/services/refreshTokenService.js
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const refreshTokenRepository = require('../repositories/refreshTokenRepository');
const { getSetting } = require('../../../shared/services/adminSettingsService');

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_SALT_ROUNDS = 12;

// Default fallbacks when admin_settings has no entry yet
const DEFAULT_ACCESS_EXPIRES   = '1h';
const DEFAULT_SESSION_DAYS     = 30; // refresh token lifetime

function toJwtExpiry(setting, fallback) {
    if (!setting || setting.enabled === false) return fallback;
    const v = setting.value;
    const u = (setting.unit || '').toLowerCase();
    if (!v) return fallback;
    if (u === 'minutes' || u === 'minute') return `${v}m`;
    if (u === 'hours'   || u === 'hour')   return `${v}h`;
    if (u === 'days'    || u === 'day')     return `${v}d`;
    return fallback;
}

function toMs(setting, fallbackMs) {
    if (!setting || setting.enabled === false) return fallbackMs;
    const v = setting.value;
    const u = (setting.unit || '').toLowerCase();
    if (!v) return fallbackMs;
    if (u === 'minutes' || u === 'minute') return v * 60 * 1000;
    if (u === 'hours'   || u === 'hour')   return v * 60 * 60 * 1000;
    if (u === 'days'    || u === 'day')     return v * 24 * 60 * 60 * 1000;
    return fallbackMs;
}

class RefreshTokenService {

    /** Issue a new refresh token for a given user and device */
    async issueRefreshToken(user, deviceFingerprint, userAgent) {
        const sessionSetting = await getSetting(
            'security', 'session_expiry',
            { enabled: true, value: DEFAULT_SESSION_DAYS, unit: 'Days' }
        );
        const sessionMs = toMs(sessionSetting, DEFAULT_SESSION_DAYS * 24 * 60 * 60 * 1000);

        const rawToken  = crypto.randomBytes(64).toString('hex');
        const tokenHash = await bcrypt.hash(rawToken, BCRYPT_SALT_ROUNDS);
        const expiresAt = new Date(Date.now() + sessionMs);

        const record = refreshTokenRepository.create({ user, tokenHash, deviceFingerprint, userAgent, expiresAt });
        await refreshTokenRepository.save(record);

        return rawToken;
    }

    /** Rotate: consume an existing raw refresh token, issue new access & refresh tokens */
    async rotateRefreshToken(rawToken, deviceFingerprint, userAgent) {
        const candidates = await refreshTokenRepository.findActiveByFingerprint(deviceFingerprint);
        const record = candidates.find(r => bcrypt.compareSync(rawToken, r.tokenHash));
        if (!record) {
            throw new Error('Invalid or expired refresh token');
        }

        await refreshTokenRepository.revoke(record);

        const newRawToken = await this.issueRefreshToken(record.user, deviceFingerprint, userAgent);

        const tokenExpirySetting = await getSetting(
            'security', 'token_expiry',
            { enabled: true, value: 1, unit: 'Hours' }
        );
        const accessExpires = toJwtExpiry(tokenExpirySetting, DEFAULT_ACCESS_EXPIRES);

        const payload = {
            sub:              record.user.id,
            email:            record.user.email,
            fullName:         record.user.fullName,
            role:             record.user.role,
            status:           record.user.status,
            provider:         record.user.provider,
            providerId:       record.user.providerId,
            profileImageUrl:  record.user.profileImageUrl,
            mfaEnabled:       record.user.mfaEnabled,
            createdAt:        record.user.createdAt,
            updatedAt:        record.user.updatedAt,
        };
        const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: accessExpires });

        return { payload, accessToken, refreshToken: newRawToken };
    }

    /** Explicitly revoke a refresh token (for logout) */
    async revokeToken(rawToken, deviceFingerprint) {
        const candidates = await refreshTokenRepository.findActiveByFingerprint(deviceFingerprint);
        const record = candidates.find(r => bcrypt.compareSync(rawToken, r.tokenHash));
        if (record) {
            await refreshTokenRepository.revoke(record);
        }
    }
}

module.exports = new RefreshTokenService();
