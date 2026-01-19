// src/services/authService.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');  // ← your repo
const refreshTokenService = require('./refreshTokenService');

const JWT_SECRET = process.env.JWT_SECRET;
// const ACCESS_EXPIRES = '15m';
const ACCESS_EXPIRES = '30d';
const REFRESH_EXPIRES = '30d';

class AuthService {
  // no constructor needed–we can just call userRepository directly

  async register({ email, password, fullName, role, phoneNumber = null, departmentSpecialty = null, country = null }) {
    if (await userRepository.findByEmail(email)) {
      throw new Error('Email already in use');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = userRepository.create({
      email,
      fullName,
      passwordHash,
      role,
      phoneNumber,
      departmentSpecialty,
      country,
      status: 'pending_email_verification'
    });
    return userRepository.save(user);
  }

  /**
   * Authenticate and issue tokens (access + rotating refresh)
   * @param {{ email: string, password: string }} creds
   * @param {string} deviceFingerprint
   * @param {string} userAgent
   */

  async login({ email, password }, deviceFingerprint, userAgent) {
    // 1) Lookup & validate
    const user = await userRepository.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new Error('Invalid credentials');
    }

    // 2) Prepare JWT payload (all user fields except passwordHash)
    const payload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      provider: user.provider,
      providerId: user.providerId,
      profileImageUrl: user.profileImageUrl,
      phoneNumber: user.phoneNumber,
      departmentSpecialty: user.departmentSpecialty,
      bannerUrl: user.bannerUrl,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    // 3) Sign access token
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });

    // 4) Issue a rotating refresh token (raw string)
    const refreshToken = await refreshTokenService.issueRefreshToken(
      user,
      deviceFingerprint,
      userAgent
    );

    // 5) Return full payload + tokens
    return { payload, accessToken, refreshToken };
  }
}

module.exports = new AuthService();