// src/services/verificationService.js
const { sendVerificationEmail } = require('../../../shared/services/email/helper/index');
const emailVerRepo = require('../repositories/emailVerificationRepository');
const { v4: uuidv4 } = require('uuid');
const userRepository = require('../repositories/userRepository');
const emailVerificationRepository = require('../repositories/emailVerificationRepository');

class VerificationService {
  async sendEmailVerification(user) {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const record = emailVerRepo.create({ user, token, expiresAt });
    await emailVerRepo.save(record);
    await sendVerificationEmail(user, token, 60);
  }

  async resendVerificationEmail(email) {
    const user = await userRepository.findByEmail(email);
    // nothing to do if user doesn’t exist or is already active
    if (!user || user.status === 'active') return;

    // rate-limit: max 3 emails per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sentCount = await emailVerificationRepository.countByUserSince(user.id, oneHourAgo);
    if (sentCount >= 3) {
      throw new Error('Too many verification emails sent; please try again later.');
    }

    // find existing token or create a new one
    let record = await emailVerificationRepository.findLatestByUser(user.id);
    const now = new Date();
    if (!record || record.usedAt || record.expiresAt < now) {
      const token = uuidv4();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
      record = emailVerificationRepository.create({ user, token, expiresAt });
      await emailVerificationRepository.save(record);
    }

    // send with remaining TTL
    const expiresInMinutes = Math.ceil((record.expiresAt - now) / 60000);
    await sendVerificationEmail(user, record.token, expiresInMinutes);
  }
}

module.exports = new VerificationService();