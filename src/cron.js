// Update your existing cron job file (wherever you have VerificationReminderJob)
const cron = require('node-cron');
const runSubscriptionExpiryJob = require("./features/subscriptions/jobs/subscription-expiryJob");
const doctorVerificationService = require('./features/doctor/services/doctorVerificationService');
const verificationRequestRepo = require('./features/doctor/repositories/verificationRequestRepository');
const PaymentJobScheduler = require('./features/payments/jobs/paymentJobScheduler');


class VerificationReminderJob {

  /**
   * Start all scheduled jobs
   */
  static start() {
    // ENHANCED: Daily subscription processing at midnight
    cron.schedule("0 0 * * *", async () => {
      console.log("⏰ Running enhanced subscription expiry job...");
      try {
        await runSubscriptionExpiryJob();
      } catch (error) {
        console.error("❌ Subscription expiry job failed:", error);
      }
    });

    // ENHANCED: Usage limit warnings daily at 6 PM
    cron.schedule("0 18 * * *", async () => {
      console.log("⚠️ Running usage limit warnings...");
      try {
        const SubscriptionService = require('./features/subscriptions/services/subscriptionService');
        await SubscriptionService.sendUsageLimitWarnings();
      } catch (error) {
        console.error("❌ Usage warning job failed:", error);
      }
    });

    // ENHANCED: Auto-renewal processing every 4 hours 0 */4 * * *
    cron.schedule("0 */4 * * *", async () => {
      console.log("🔄 Processing subscription auto-renewals...");
      try {
        const SubscriptionService = require('./features/subscriptions/services/subscriptionService');
        await SubscriptionService.processAutoRenewals();
      } catch (error) {
        console.error("❌ Auto-renewal job failed:", error);
      }
    });

    // Start the currency refresh job
    // CurrencyRefreshJob.start();

    // Existing: Verification reminders daily at 9 AM
    cron.schedule('0 9 * * *', async () => {
      console.log('📧 Running verification reminder job...');

      try {
        // Send reminders for verifications pending > 3 days
        await this.sendPendingReminders();

        // Send expiry warnings for verifications expiring in 7 days
        await this.sendExpiryWarnings();

        console.log('✅ Verification reminder jobs completed');
      } catch (error) {
        console.error('❌ Error in verification reminder job:', error);
      }
    });

    // ENHANCED: Auto-billing processing every 6 hours
    cron.schedule("0 */6 * * *", async () => {
      console.log("💳 Running auto-billing job...");
      try {
        const AutoBillingJob = require('./features/payments/jobs/autoBillingJob');
        await AutoBillingJob.processScheduledBilling();
      } catch (error) {
        console.error("❌ Auto-billing job failed:", error);
      }
    });

    // ENHANCED: Retry failed auto-billing once daily at 2 PM
    cron.schedule("0 14 * * *", async () => {
      console.log("🔄 Retrying failed auto-billing...");
      try {
        const AutoBillingJob = require('./features/payments/jobs/autoBillingJob');
        await AutoBillingJob.retryFailedBilling();
      } catch (error) {
        console.error("❌ Auto-billing retry job failed:", error);
      }
    });

    // ENHANCED: Monitor auto-billing health daily at 8 AM
    cron.schedule("0 8 * * *", async () => {
      console.log("📊 Monitoring auto-billing health...");
      try {
        const AutoBillingJob = require('./features/payments/jobs/autoBillingJob');
        await AutoBillingJob.monitorAutoBillingHealth();
      } catch (error) {
        console.error("❌ Auto-billing health monitoring failed:", error);
      }
    });

    // ENHANCED: Cleanup expired tokens weekly on Saturdays at 3 AM
    cron.schedule("0 3 * * 6", async () => {
      console.log("🧹 Cleaning up expired payment tokens...");
      try {
        const AutoBillingJob = require('./features/payments/jobs/autoBillingJob');
        await AutoBillingJob.cleanupExpiredTokens();
      } catch (error) {
        console.error("❌ Token cleanup job failed:", error);
      }
    });

    // ENHANCED: Payment method expiry notifications weekly on Fridays at 10 AM
    cron.schedule("0 10 * * 5", async () => {
      console.log("📧 Sending payment method expiry notifications...");
      try {
        const userPaymentMethodRepository = require('./features/payments/repositories/userPaymentMethodRepository');
        const emailService = require('./shared/services/email/emailService');

        const expiringTokens = await userPaymentMethodRepository.findExpiringTokens(30);

        for (const paymentMethod of expiringTokens) {
          await emailService.send(
            "payment-method-expiring",
            paymentMethod.user.email,
            "Payment Method Expiring Soon",
            {
              name: paymentMethod.user.fullName || paymentMethod.user.email,
              cardLast4: paymentMethod.cardLast4,
              expiryDate: paymentMethod.tokenExpiryDate
            }
          );
        }

        console.log(`✅ Sent ${expiringTokens.length} payment method expiry notifications`);
      } catch (error) {
        console.error("❌ Payment method expiry notification job failed:", error);
      }
    });

    // ENHANCED: Fix incomplete doctor setups weekly on Sundays at 2 AM
    cron.schedule('0 2 * * 0', async () => {
      console.log('🔧 Running weekly doctor setup check...');
      try {
        const result = await doctorVerificationService.fixIncompleteSetups();
        console.log(`✅ Setup check completed: ${result.successful} fixed, ${result.failed} failed`);
      } catch (error) {
        console.error('❌ Doctor setup check failed:', error);
      }
    });

    // ENHANCED: Payment jobs (from your existing payment system)
    PaymentJobScheduler.start();

    console.log("📅 All enhanced scheduled cron jobs initialized.");
  }

  // Your existing methods remain the same
  static async sendPendingReminders() {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const pendingRequests = await verificationRequestRepo.findPendingSince(threeDaysAgo);

    for (const request of pendingRequests) {
      await doctorVerificationService.sendPendingVerificationReminder(request.id);
    }

    console.log(`📤 Sent ${pendingRequests.length} verification reminders`);
  }

  static async sendExpiryWarnings() {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const expiringRequests = await verificationRequestRepo.findExpiringBefore(sevenDaysFromNow);

    for (const request of expiringRequests) {
      await doctorVerificationService.sendVerificationExpiryWarning(request.id, 7);
    }

    console.log(`⚠️ Sent ${expiringRequests.length} expiry warnings`);
  }
}

module.exports = VerificationReminderJob;