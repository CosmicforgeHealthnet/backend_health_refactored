// src/services/passwordResetService.js
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const userRepository = require('../repositories/userRepository');
const passwordResetRepository = require('../repositories/passwordResetRepository');
const { sendPasswordResetEmail } = require('../../../shared/services/email/helper/index');

const RESET_EXPIRES_MINUTES = 60;   // or however long you like

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

    const record = passwordResetRepository.create({ user, token, expiresAt });
    await passwordResetRepository.save(record);

    await sendPasswordResetEmail(user, token, RESET_EXPIRES_MINUTES);
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

    // Send email with remaining TTL
    const minutesLeft = Math.ceil((record.expiresAt - now) / 60000);
    await sendPasswordResetEmail(user, record.token, minutesLeft);
  }

}

module.exports = new PasswordResetService();
