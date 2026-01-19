const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const magicLinkRepo = require('../repositories/magicLinkRepository');
const userRepository = require('../repositories/userRepository');
const refreshTokenService = require('./refreshTokenService');     // ← import
const { sendMagicLinkEmail } = require('../../../shared/services/email/helper/index');

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '30d';
const LINK_EXPIRES_MIN = 10;

class MagicLinkService {
  /**
   * Send a magic-link email (signup or login)
   */
  async requestMagicLink({ email, fullName, role = 'patient' }, ip, userAgent) {
    // 1) Find or create user
    let user = await userRepository.findByEmail(email);
    // signup branch: require non‐empty fullName
    if (!user) {
      if (!fullName || !fullName.trim()) {
        throw new Error('User does not exist. Sign-up using MagicLink');
      }
      user = userRepository.create({
        email,
        fullName: fullName.trim(),
        role,
        status: 'pending_email_verification'
      });
      await userRepository.save(user);
    }

    // 2) Create token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + LINK_EXPIRES_MIN * 60 * 1000);
    const record = magicLinkRepo.create({ user, token, purpose: user.status === 'pending_email_verification' ? 'signup' : 'login', ip, userAgent, expiresAt });
    await magicLinkRepo.save(record);

    // 3) Email link
    await sendMagicLinkEmail(user, token, LINK_EXPIRES_MIN, record.purpose);
  }

  /**
   * Consume magic link, verify token, check IP/UA, issue JWTs
   */
  async consumeMagicLink(token, ip, userAgent, deviceFingerprint) {
    const record = await magicLinkRepo.findByToken(token);
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new Error('Invalid or expired token');
    }
    // if (record.ip !== ip || record.userAgent !== userAgent) {
    //   throw new Error('Link must be opened from the same browser and IP');
    // }

    // Mark used
    record.usedAt = new Date();
    await magicLinkRepo.save(record);

    // Activate user if signup link
    const user = record.user;
    if (record.purpose === 'signup' && user.status === 'pending_email_verification') {
      user.status = user.role === 'doctor' ? 'pending_doctor_verification' : 'active';
      await userRepository.save(user);
    }

    // Issue JWTs
    const payload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      provider: user.provider,
      providerId: user.providerId,
      bannerUrl: user.bannerUrl,
      profileImageUrl: user.profileImageUrl,
      phoneNumber: user.phoneNumber,        // Add this
      departmentSpecialty: user.departmentSpecialty,  // Add this
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    // 1) Sign access JWT
    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES
    });

    // 2) Issue rotating refresh token (raw string + hashed save)
    const refreshToken = await refreshTokenService.issueRefreshToken(
      user,
      deviceFingerprint,
      userAgent
    );

    return { payload, accessToken, refreshToken };
  }
}

module.exports = new MagicLinkService();