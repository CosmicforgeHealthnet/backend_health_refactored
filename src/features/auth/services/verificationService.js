const { sendVerificationEmail, sendVerificationOtpEmail } = require('../../../shared/services/email/helper/index');
const otpService = require('./otpService');
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

  async sendEmailVerificationOtp(user) {
    const token = uuidv4();
    const otp = otpService.generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // OTP expires in 15 mins

    const record = this.emailVerRepo.create({ user, token, otp, expiresAt });
    await this.emailVerRepo.save(record);
    await sendVerificationOtpEmail(user, otp, 15);
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
      // For resend, we generate a new 6-digit OTP if the first one was OTP-based or if we want to switch
      // But let's check if the user is on mobile/otp flow. 
      // Actually, let's just generate a new 6-digit OTP for simplicity if it was already an OTP
      const isOtpFlow = record && record.token.length === 6; 
      const newToken = isOtpFlow ? otpService.generateOTP() : uuidv4();
      const expiresAt = new Date(now.getTime() + (isOtpFlow ? 15 : 60) * 60 * 1000);
      record = this.emailVerRepo.create({ user, token: newToken, expiresAt });
      await this.emailVerRepo.save(record);
    }

    // send with remaining TTL
    const expiresInMinutes = Math.ceil((record.expiresAt - now) / 60000);
    
    if (record.otp) {
      await sendVerificationOtpEmail(user, record.otp, expiresInMinutes);
    } else {
      await sendVerificationEmail(user, record.token, expiresInMinutes);
    }
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