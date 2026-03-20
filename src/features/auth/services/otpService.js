// src/features/auth/services/otpService.js
const crypto = require('node:crypto');

class OTPService {
  /**
   * Generate a 6-digit numeric OTP
   * @returns {string}
   */
  generateOTP() {
    // Generate a random 6-digit number
    // Using crypto.randomInt for better randomness if available (Node.js 14.10+)
    if (crypto.randomInt) {
      return crypto.randomInt(100000, 999999).toString();
    }
    
    // Fallback for older Node versions
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Simple check if string is a valid 6-digit code
   * @param {string} code 
   * @returns {boolean}
   */
  isValidFormat(code) {
    return /^\d{6}$/.test(code);
  }
}

module.exports = new OTPService();
