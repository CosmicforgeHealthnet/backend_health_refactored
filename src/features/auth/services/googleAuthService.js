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
   * @param {string} state - encoded state sharing role, fingerprint, etc.
   */
  getAuthUrl(state) {
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid', 'email', 'profile'],
      redirect_uri: config.google.redirectUri,
      state: state
    });
  }

  /**
   * Exchange code and handle user login/signup, then issue rotating refresh
   * @param {string} code
   * @param {string} deviceFingerprint
   * @param {string} userAgent
   * @param {string} role - desired user role for new signup
   */
  async handleCallback(code, deviceFingerprint, userAgent, extraData) {
    console.log('🚀 [GoogleAuthService] handleCallback extraData:', extraData);
    const { role, departmentSpecialty, phoneNumber } = extraData || {};
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
      const targetRole = ['patient', 'doctor', 'pharmacy', 'lab'].includes(role) ? role : 'patient';

      // Lookup by email + role to link accounts (multi-role safe)
      user = await userRepository.findByEmailAndRole(email, targetRole);
      if (user) {
        // Link Google to existing local account for this role
        console.log('🚀 [GoogleAuthService] Existing user found by email+role, linking accounts. Email:', email, 'Role:', targetRole);
        user.provider = 'google';
        user.providerId = sub;
        user.profileImageUrl = picture;
        user.status = email_verified
          ? (user.role === 'doctor' ? 'pending_doctor_verification' : 'active')
          : 'pending_email_verification';
        await userRepository.save(user);
        await referralService.createUserReferralCode(user.id);
      } else {
        // New user — create with the requested role
        user = userRepository.create({
          email,
          fullName: name,
          provider: 'google',
          providerId: sub,
          profileImageUrl: picture,
          phoneNumber: phoneNumber,
          departmentSpecialty: departmentSpecialty,
          status: email_verified
            ? (targetRole === 'doctor' ? 'pending_doctor_verification' : 'active')
            : 'pending_email_verification',
          role: targetRole
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
  async verifyMobileIdToken(idToken, deviceFingerprint, userAgent, extraData) {
    console.log('🚀 [GoogleAuthService] verifyMobileIdToken extraData:', extraData);
    const { role, departmentSpecialty, phoneNumber } = extraData || {};
    // Accept tokens from web, Android, and iOS clients.
    // Mobile apps sign tokens with their own platform client ID, NOT the web client ID.
    // Passing only the web clientId causes "Wrong recipient" verification failure on mobile.
    const validAudiences = [
      config.google.clientId,
      config.google.androidClientId,
      config.google.iosClientId,
    ].filter(Boolean);

    // TEMP: log audiences for debugging — remove after fix
    const tokenAud = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString()).aud;
    console.log('[GoogleAuth] token aud:', tokenAud);
    console.log('[GoogleAuth] validAudiences:', validAudiences);

    const ticket = await client.verifyIdToken({
      idToken,
      audience: validAudiences
    });
    const payload = ticket.getPayload();
    const { sub, email, email_verified, name, picture } = payload;

    // Lookup existing Google-linked user
    let user = await userRepository.findByProvider('google', sub);

    if (!user) {
      const targetRole = ['patient', 'doctor', 'pharmacy', 'lab'].includes(role) ? role : 'patient';

      // Lookup by email + role to link accounts (multi-role safe)
      user = await userRepository.findByEmailAndRole(email, targetRole);
      if (user) {
        // Link Google to existing local account for this role
        console.log('🚀 [GoogleAuthService] Mobile: Existing user found by email+role, linking accounts. Email:', email, 'Role:', targetRole);
        user.provider = 'google';
        user.providerId = sub;
        user.profileImageUrl = picture;
        user.status = email_verified ? (user.role === 'doctor' ? 'pending_doctor_verification' : 'active') : 'pending_email_verification';
        await userRepository.save(user);
        await referralService.createUserReferralCode(user.id);
      } else {
        // New user — create with the requested role
        user = userRepository.create({
          email,
          fullName: name,
          provider: 'google',
          providerId: sub,
          profileImageUrl: picture,
          phoneNumber: phoneNumber,
          departmentSpecialty: departmentSpecialty,
          status: email_verified ? (targetRole === 'doctor' ? 'pending_doctor_verification' : 'active') : 'pending_email_verification',
          role: targetRole
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

    return { jwtPayload, accessToken, refreshToken };
  }
}

module.exports = new GoogleAuthService();
