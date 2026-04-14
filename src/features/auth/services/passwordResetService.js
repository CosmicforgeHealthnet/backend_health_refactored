// src/services/passwordResetService.js
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const passwordResetRepository = require('../repositories/passwordResetRepository');
const { sendPasswordResetEmail, sendPasswordResetOtpEmail } = require('../../../shared/services/email/helper/index');
const otpService = require('./otpService');
const {
  sendGenericWhatsAppNotification,
} = require('../../notifications/whatsapp/helper');
const RESET_EXPIRES_MINUTES = 60;
const OTP_EXPIRES_MINUTES = 15;

class PasswordResetService {
  /**
   * Kick off a reset: generate token, store it, email the link.
   */
  async requestReset(email) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      // Do not reveal whether email exists
      return;
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + RESET_EXPIRES_MINUTES * 60 * 1000);
    const link = `${process.env.APP_BASE_URL}/auth/reset-password?token=${token}`;

    const record = passwordResetRepository.create({ user, token, expiresAt });
    await passwordResetRepository.save(record);

    // Send email asynchronously to prevent blocking the request
    sendPasswordResetEmail(user, token, RESET_EXPIRES_MINUTES)
      .catch(err => console.error(`❌ Background email sending failed for ${email}:`, err.message));
    sendGenericWhatsAppNotification({
      phoneNumber: user.phoneNumber,
      text: `Hello ${user.fullName || "there"}, reset your CosmicForge password here: ${link}. This link expires in ${RESET_EXPIRES_MINUTES} minutes.`,
      recipientName: user.fullName || "Customer",
      serviceType: "password reset",
      referenceId: "password-reset",
    }).catch(err => console.error(`❌ Background WhatsApp sending failed for ${email}:`, err.message));
  }

  async requestResetOtp(email) {
    const user = await userRepository.findByEmail(email);
    if (!user) return;

    const token = uuidv4();
    const otp = otpService.generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

    const record = passwordResetRepository.create({ user, token, otp, expiresAt });
    await passwordResetRepository.save(record);

    sendPasswordResetOtpEmail(user, otp, OTP_EXPIRES_MINUTES)
      .catch(err => console.error(`❌ Background email sending failed for ${email}:`, err.message));
    sendGenericWhatsAppNotification({
      phoneNumber: user.phoneNumber,
      text: `Hello ${user.fullName || "there"}, your CosmicForge password reset code is ${otp}. It expires in ${OTP_EXPIRES_MINUTES} minutes.`,
      recipientName: user.fullName || "Customer",
      serviceType: "password reset",
      referenceId: "password-reset",
    }).catch(err => console.error(`❌ Background WhatsApp sending failed for ${email}:`, err.message));
  }

  /**
   * Finalize reset: validate token, update password, mark token used.
   */
  async resetPassword(token, newPassword) {
    const record = await passwordResetRepository.findByToken(token);
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new Error('Invalid or expired reset token');
    }

    // Hash & save new password
    const hash = await bcrypt.hash(newPassword, 12);
    const user = record.user;
    user.passwordHash = hash;
    await userRepository.save(user);

    // Mark token used
    record.usedAt = new Date();
    await passwordResetRepository.save(record);
  }

  async resendResetEmail(email) {
    const user = await userRepository.findByEmail(email);
    if (!user) return;

    // Rate-limit: max 3 per hour
    const oneHourAgo = new Date(Date.now() - RESET_EXPIRES_MINUTES * 60 * 1000);
    const sentCount = await passwordResetRepository.countByUserSince(user.id, oneHourAgo);
    if (sentCount >= 3) {
      throw new Error('Too many reset emails sent; try again later.');
    }

    // Reuse latest or create new
    let record = await passwordResetRepository.findLatestByUser(user.id);
    const now = new Date();
    if (!record || record.usedAt || record.expiresAt < now) {
      const token = uuidv4();
      const expiresAt = new Date(now.getTime() + RESET_EXPIRES_MINUTES * 60 * 1000);
      record = passwordResetRepository.create({ user, token, expiresAt });
      await passwordResetRepository.save(record);
    }

    // Send email asynchronously
    const minutesLeft = Math.ceil((record.expiresAt - now) / 60000);
    if (record.otp) {
      sendPasswordResetOtpEmail(user, record.otp, minutesLeft)
        .catch(err => console.error(`❌ Background email resend failed for ${email}:`, err.message));
      sendGenericWhatsAppNotification({
        phoneNumber: user.phoneNumber,
        text: `Hello ${user.fullName || "there"}, your CosmicForge password reset code is ${record.otp}. It expires in ${minutesLeft} minutes.`,
        recipientName: user.fullName || "Customer",
        serviceType: "password reset",
        referenceId: "password-reset",
      }).catch(err => console.error(`❌ Background WhatsApp resend failed for ${email}:`, err.message));
    } else {
      sendPasswordResetEmail(user, record.token, minutesLeft)
        .catch(err => console.error(`❌ Background email resend failed for ${email}:`, err.message));
      sendGenericWhatsAppNotification({
        phoneNumber: user.phoneNumber,
        text: `Hello ${user.fullName || "there"}, reset your CosmicForge password here: ${process.env.APP_BASE_URL}/auth/reset-password?token=${record.token}. This link expires in ${minutesLeft} minutes.`,
        recipientName: user.fullName || "Customer",
        serviceType: "password reset",
        referenceId: "password-reset",
      }).catch(err => console.error(`❌ Background WhatsApp resend failed for ${email}:`, err.message));
    }
  }

}

module.exports = new PasswordResetService();
