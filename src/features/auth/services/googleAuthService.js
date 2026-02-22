// src/services/googleAuthService.js
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const config = require('../../../config');
const userRepository = require('../repositories/userRepository');
const refreshTokenService = require('./refreshTokenService');
const referralService = require("./referralService");


// Initialize OAuth2Client with correct redirect URI
const client = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
);

class GoogleAuthService {
  /**
   * Generate Google OAuth2 consent screen URL
   * @param {string} role - desired user role (patient|doctor|pharmacy|lab)
   */
  getAuthUrl(role) {
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid', 'email', 'profile'],
      redirect_uri: config.google.redirectUri,
      state: role  // pass desired role through state
    });
  }

  /**
   * Exchange code and handle user login/signup, then issue rotating refresh
   * @param {string} code
   * @param {string} deviceFingerprint
   * @param {string} userAgent
   * @param {string} role - desired user role for new signup
   */
  async handleCallback(code, deviceFingerprint, userAgent, role) {
    // Exchange code for tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Verify ID token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.google.clientId
    });
    const payload = ticket.getPayload();
    const { sub, email, email_verified, name, picture } = payload;

    // Lookup existing Google-linked user
    let user = await userRepository.findByProvider('google', sub);

    if (!user) {
      // Lookup by email to link accounts
      user = await userRepository.findByEmail(email);
      if (user) {
        // Link Google to existing local account
        user.provider = 'google';
        user.providerId = sub;
        user.profileImageUrl = picture;
        user.status = email_verified
          ? 'active'
          : 'pending_email_verification';
        await userRepository.save(user);
        await referralService.createUserReferralCode(user.id);
      } else {
        // New user flow with role from state
        const newRole = ['patient', 'doctor', 'pharmacy', 'lab'].includes(role)
          ? role
          : 'patient';
        user = userRepository.create({
          email,
          fullName: name,
          provider: 'google',
          providerId: sub,
          profileImageUrl: picture,
          status: email_verified
            ? (newRole === 'doctor'
              ? 'pending_doctor_verification'
              : 'active')
            : 'pending_email_verification',
          role: newRole
        });
        await userRepository.save(user);
        await referralService.createUserReferralCode(user.id);
      }
    }

    // Build JWT payload (all user fields)
    const jwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      provider: user.provider,
      providerId: user.providerId,
      bannerUrl: user.bannerUrl,
      profileImageUrl: user.profileImageUrl,
      phoneNumber: user.phoneNumber,
      departmentSpecialty: user.departmentSpecialty,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    // Issue access token
    const accessToken = jwt.sign(jwtPayload, config.jwt.secret, {
      expiresIn: config.jwt.accessExpires
    });

    // Issue rotating refresh token
    const refreshToken = await refreshTokenService.issueRefreshToken(
      user,
      deviceFingerprint,
      userAgent
    );

    // Return full payload + tokens
    return { jwtPayload, accessToken, refreshToken };
  }

  /**
   * Verify Google ID Token from mobile device and handle login/signup
   * @param {string} idToken
   * @param {string} deviceFingerprint
   * @param {string} userAgent
   * @param {string} role
   */
  async verifyMobileIdToken(idToken, deviceFingerprint, userAgent, role) {
    // Verify ID token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.google.clientId
    });
    const payload = ticket.getPayload();
    const { sub, email, email_verified, name, picture } = payload;

    // Lookup existing Google-linked user
    let user = await userRepository.findByProvider('google', sub);

    if (!user) {
      // Lookup by email to link accounts
      user = await userRepository.findByEmail(email);
      if (user) {
        // Link Google to existing local account
        user.provider = 'google';
        user.providerId = sub;
        user.profileImageUrl = picture;
        user.status = email_verified ? 'active' : 'pending_email_verification';
        await userRepository.save(user);
        await referralService.createUserReferralCode(user.id);
      } else {
        // New user flow
        const newRole = ['patient', 'doctor', 'pharmacy', 'lab'].includes(role) ? role : 'patient';
        user = userRepository.create({
          email,
          fullName: name,
          provider: 'google',
          providerId: sub,
          profileImageUrl: picture,
          status: email_verified ? (newRole === 'doctor' ? 'pending_doctor_verification' : 'active') : 'pending_email_verification',
          role: newRole
        });
        await userRepository.save(user);
        await referralService.createUserReferralCode(user.id);
      }
    }

    // Build JWT payload
    const jwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      provider: user.provider,
      providerId: user.providerId,
      profileImageUrl: user.profileImageUrl,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    // Issue access token
    const accessToken = jwt.sign(jwtPayload, config.jwt.secret, {
      expiresIn: config.jwt.accessExpires
    });

    // Issue rotating refresh token
    const refreshToken = await refreshTokenService.issueRefreshToken(
      user,
      deviceFingerprint,
      userAgent
    );

    return { jwtPayload, accessToken, refreshToken };
  }
}

module.exports = new GoogleAuthService();
