// src/controllers/mfa/mfaController.js
// =============================================================================
const mfaService = require('../../services/mfa/mfaService');
const { getNotificationSocket } = require('../../../../shared/utils/notificationUtils');

// Generate MFA setup (QR code, secret)
exports.setupMFA = async (req, res, next) => {
  try {
    const userId = req.user.sub; // From JWT middleware

    if (req.user.mfaEnabled) {
      return res.status(400).json({
        error: 'Two-factor authentication is already enabled'
      });
    }

    const setupData = await mfaService.generateMFASetup(userId);

    res.json({
      message: 'MFA setup data generated',
      qrCodeUrl: setupData.qrCodeUrl,
      manualEntryKey: setupData.manualEntryKey,
      secret: setupData.secret,
      backupCodes: setupData.backupCodes
    });
  } catch (err) {
    next(err);
  }
};

// Verify setup and enable MFA
exports.enableMFA = async (req, res, next) => {
  try {
    const { token, secret } = req.body;
    const userId = req.user.sub;

    if (!token || !secret) {
      return res.status(400).json({
        error: 'Verification code and secret are required'
      });
    }

    if (req.user.mfaEnabled) {
      return res.status(400).json({
        error: 'Two-factor authentication is already enabled'
      });
    }

    const result = await mfaService.enableMFA(userId, token, secret);

    // Send notification
    try {
      await getNotificationSocket().sendNotificationToUser(userId, {
        type: 'notification',
        message: 'Two-factor authentication has been enabled for your account.',
        metadata: { action: 'mfa_enabled', link: '/settings/security' }
      });
    } catch (notifErr) {
      console.error('Notification failed:', notifErr.message);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Disable MFA
exports.disableMFA = async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.sub;
    console.log('let see the mfa ', req.user.mfaEnabled);

    if (!token) {
      return res.status(400).json({
        error: 'Verification code is required'
      });
    }

    if (!req.user.mfaEnabled) {
      return res.status(400).json({
        error: 'Two-factor authentication is not enabled'
      });
    }

    const result = await mfaService.disableMFA(userId, token);

    // Send notification
    try {
      await getNotificationSocket().sendNotificationToUser(userId, {
        type: 'notification',
        message: 'Two-factor authentication has been disabled for your account.',
        metadata: { action: 'mfa_disabled', link: '/settings/security' }
      });
    } catch (notifErr) {
      console.error('Notification failed:', notifErr.message);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Get MFA status
exports.getMFAStatus = async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const isEnabled = await mfaService.isMFAEnabled(userId);

    res.json({
      mfaEnabled: isEnabled,
      message: isEnabled ? 'MFA is enabled' : 'MFA is disabled'
    });
  } catch (err) {
    next(err);
  }
};