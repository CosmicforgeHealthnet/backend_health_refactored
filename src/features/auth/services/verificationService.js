const { sendVerificationEmail } = require('../../../shared/services/email/helper/index');
const { v4: uuidv4 } = require('uuid');

class VerificationService {
  get userRepo() { return require('../repositories/userRepository'); }
  get emailVerRepo() { return require('../repositories/emailVerificationRepository'); }

  async sendEmailVerification(user) {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const record = this.emailVerRepo.create({ user, token, expiresAt });
    await this.emailVerRepo.save(record);
    await sendVerificationEmail(user, token, 60);
  }

  async resendVerificationEmail(email) {
    const user = await this.userRepo.findByEmail(email);
    // nothing to do if user doesn’t exist or is already active
    if (!user || user.status === 'active') return;

    // rate-limit: max 3 emails per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sentCount = await this.emailVerRepo.countByUserSince(user.id, oneHourAgo);
    if (sentCount >= 3) {
      throw new Error('Too many verification emails sent; please try again later.');
    }

    // find existing token or create a new one
    let record = await this.emailVerRepo.findLatestByUser(user.id);
    const now = new Date();
    if (!record || record.usedAt || record.expiresAt < now) {
      const token = uuidv4();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
      record = this.emailVerRepo.create({ user, token, expiresAt });
      await this.emailVerRepo.save(record);
    }

    // send with remaining TTL
    const expiresInMinutes = Math.ceil((record.expiresAt - now) / 60000);
    await sendVerificationEmail(user, record.token, expiresInMinutes);
  }

  async checkVerificationStatus(email) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      return null;
    }

    const isVerified = user.status === 'active' || user.status === 'doctor_active';
    return {
      email: user.email,
      isVerified
    };
  }
}

module.exports = new VerificationService();