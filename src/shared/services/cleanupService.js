// src/services/cleanupService.js
const cron = require('node-cron');
const emailVerificationRepository = require('../../features/auth/repositories/emailVerificationRepository');
const passwordResetRepository = require('../../features/auth/repositories/passwordResetRepository');

function startCleanupTasks() {
  // runs every day at midnight
  cron.schedule('0 0 * * *', async () => {
    const now = new Date();
    await emailVerificationRepository.deleteOlderThan(now);
    await passwordResetRepository.deleteExpired(now);
    console.log('🧹 Cleaned up expired/used tokens');
  });
}

module.exports = { startCleanupTasks };
