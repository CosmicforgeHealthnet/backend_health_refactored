// src/services/mfa/mfaService.js
// =============================================================================
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const userRepository = require('../../repositories/userRepository');

class MFAService {
  /**
   * Generate MFA secret and QR code for user setup
   */
  async generateMFASetup(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `CosmicForge (${user.email})`,
      issuer: 'CosmicForge',
      length: 32
    });

    // Generate QR code data URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCodeUrl,
      manualEntryKey: secret.base32,
      backupCodes: this.generateBackupCodes()
    };
  }

  /**
   * Verify MFA token and enable 2FA for user
   */
  async enableMFA(userId, token, secret) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps (60 seconds) tolerance
    });

    if (!verified) {
      throw new Error('Invalid verification code');
    }

    // Enable MFA for user
    user.mfaEnabled = true;
    user.mfaSecret = secret;
    await userRepository.save(user);

    return {
      success: true,
      message: 'Two-factor authentication enabled successfully'
    };
  }

  /**
   * Disable MFA for user
   */
  async disableMFA(userId, token) {
    const user = await userRepository.findByIdWithAuthSecrets(userId);
    if (!user || !user.mfaEnabled) {
      throw new Error('MFA not enabled for this user');
    }

    // Verify current token before disabling
    const verified = this.verifyToken(user.mfaSecret, token);
    if (!verified) {
      throw new Error('Invalid verification code');
    }

    // Disable MFA
    user.mfaEnabled = false;
    user.mfaSecret = null;
    await userRepository.save(user);

    return {
      success: true,
      message: 'Two-factor authentication disabled successfully'
    };
  }

  /**
   * Verify MFA token for login
   */
  verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps tolerance
    });
  }

  /**
   * Generate backup codes for account recovery
   */
  generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }

  /**
   * Check if user has MFA enabled
   */
  async isMFAEnabled(userId) {
    const user = await userRepository.findById(userId);
    return user?.mfaEnabled || false;
  }
}

module.exports = new MFAService();