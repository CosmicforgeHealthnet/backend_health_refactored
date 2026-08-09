const cron = require('node-cron');
const runSubscriptionExpiryJob = require("./features/subscriptions/jobs/subscription-expiryJob");
const doctorVerificationService = require('./features/doctor/services/doctorVerificationService');
const verificationRequestRepo = require('./features/doctor/repositories/verificationRequestRepository');
const userRepository = require('./features/auth/repositories/userRepository');
const { sendVerificationNotSubmittedReminderEmail } = require('./shared/services/email/emailHelpers');
const PaymentJobScheduler = require('./features/payments/jobs/paymentJobScheduler');
const { trackJob } = require('./features/admin-ops/services/jobTracker');
const { recordHealthCheck } = require('./features/admin-ops/services/adminOpsService');
const AppDataSource = require('./config/database');
const { getSetting } = require('./shared/services/adminSettingsService');
const { runConsultationMaintenance } = require('./features/appointments/jobs/consultationMaintenanceJob');
const { runPrescriptionMaintenance } = require('./features/pharmacy/jobs/prescriptionMaintenanceJob');
const { runEventReminderJob } = require('./features/community/jobs/eventReminderJob');

class VerificationReminderJob {

  static start() {
    // Daily subscription processing at midnight
    cron.schedule("0 0 * * *", trackJob('subscription-expiry', 'cron', async () => {
      console.log("⏰ Running enhanced subscription expiry job...");
      await runSubscriptionExpiryJob();
    }));

    // Usage limit warnings daily at 6 PM
    cron.schedule("0 18 * * *", trackJob('usage-limit-warnings', 'cron', async () => {
      console.log("⚠️ Running usage limit warnings...");
      const SubscriptionService = require('./features/subscriptions/services/subscriptionService');
      await SubscriptionService.sendUsageLimitWarnings();
    }));

    // Auto-renewal processing every 4 hours
    cron.schedule("0 */4 * * *", trackJob('subscription-auto-renewals', 'cron', async () => {
      console.log("🔄 Processing subscription auto-renewals...");
      const SubscriptionService = require('./features/subscriptions/services/subscriptionService');
      await SubscriptionService.processAutoRenewals();
    }));

    // Verification reminders daily at 9 AM
    cron.schedule('0 9 * * *', trackJob('verification-reminders', 'cron', async () => {
      console.log('📧 Running verification reminder job...');
      await VerificationReminderJob.sendPendingReminders();
      await VerificationReminderJob.sendExpiryWarnings();
      console.log('✅ Verification reminder jobs completed');
    }));

    // Auto-billing processing every 6 hours
    cron.schedule("0 */6 * * *", trackJob('auto-billing', 'cron', async () => {
      console.log("💳 Running auto-billing job...");
      const AutoBillingJob = require('./features/payments/jobs/autoBillingJob');
      await AutoBillingJob.processScheduledBilling();
    }));

    // Retry failed auto-billing once daily at 2 PM
    cron.schedule("0 14 * * *", trackJob('auto-billing-retry', 'cron', async () => {
      console.log("🔄 Retrying failed auto-billing...");
      const AutoBillingJob = require('./features/payments/jobs/autoBillingJob');
      await AutoBillingJob.retryFailedBilling();
    }));

    // Monitor auto-billing health daily at 8 AM
    cron.schedule("0 8 * * *", trackJob('auto-billing-health-monitor', 'cron', async () => {
      console.log("📊 Monitoring auto-billing health...");
      const AutoBillingJob = require('./features/payments/jobs/autoBillingJob');
      await AutoBillingJob.monitorAutoBillingHealth();
    }));

    // Cleanup expired tokens weekly on Saturdays at 3 AM
    cron.schedule("0 3 * * 6", trackJob('cleanup-expired-tokens', 'cron', async () => {
      console.log("🧹 Cleaning up expired payment tokens...");
      const AutoBillingJob = require('./features/payments/jobs/autoBillingJob');
      await AutoBillingJob.cleanupExpiredTokens();
    }));

    // Payment method expiry notifications weekly on Fridays at 10 AM
    cron.schedule("0 10 * * 5", trackJob('payment-method-expiry-notifications', 'cron', async () => {
      console.log("📧 Sending payment method expiry notifications...");
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
    }));

    // Remind doctors who registered but never submitted verification details —
    // weekly on Mondays at 9 AM. These have zero verification_requests rows and
    // are invisible to the admin queue, so nothing else nudges them.
    cron.schedule('0 9 * * 1', trackJob('verification-never-submitted-reminders', 'cron', async () => {
      console.log('📧 Running never-submitted verification reminder job...');
      await VerificationReminderJob.sendNeverSubmittedReminders();
    }));

    // Fix incomplete doctor setups weekly on Sundays at 2 AM
    cron.schedule('0 2 * * 0', trackJob('doctor-setup-check', 'cron', async () => {
      console.log('🔧 Running weekly doctor setup check...');
      const result = await doctorVerificationService.fixIncompleteSetups();
      console.log(`✅ Setup check completed: ${result.successful} fixed, ${result.failed} failed`);
    }));

    // Payment jobs
    PaymentJobScheduler.start();

    // Pharmacy escrow clearance daily at 1 AM
    cron.schedule("0 1 * * *", trackJob('pharmacy-escrow-clearance', 'cron', async () => {
      console.log("🏦 Running pharmacy escrow clearance job...");
      const { runClearanceJob } = require("./features/pharmacy/jobs/pharmacyClearanceJob");
      await runClearanceJob();
    }));

    // Pharmacy overdue invoices daily at 2 AM
    cron.schedule("0 2 * * *", trackJob('pharmacy-overdue-invoices', 'cron', async () => {
      console.log("📋 Running pharmacy invoice overdue check...");
      const { runOverdueJob } = require("./features/pharmacy/jobs/pharmacyOverdueJob");
      await runOverdueJob();
    }));

    // Consultation & RTC session maintenance — every 5 minutes
    // Enforces: telemedicine auto_end_inactive/unfinished, rtc session_timeout/max_session_duration, followup_rules
    cron.schedule("*/5 * * * *", trackJob('consultation-maintenance', 'cron', async () => {
      await runConsultationMaintenance();
    }));

    // Prescription & delivery maintenance — every 15 minutes
    // Enforces: prescription_expiry, auto_driver_assignment_delay, reassignment_trigger_time, delivery_timeout_rules
    cron.schedule("*/15 * * * *", trackJob('prescription-maintenance', 'cron', async () => {
      await runPrescriptionMaintenance();
    }));

    // Audit log retention purge — daily at 3:30 AM
    // Reads limits.log_retention_days from admin_settings; defaults to 90 days.
    cron.schedule("30 3 * * *", trackJob('audit-log-retention-purge', 'cron', async () => {
      const retentionSetting = await getSetting('limits', 'log_retention_days', { enabled: true, value: 90 });
      if (retentionSetting?.enabled === false) return;
      const retentionDays = retentionSetting?.value ?? 90;
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      const qr = AppDataSource.createQueryRunner();
      try {
        await qr.connect();
        const [auditResult, comprehensiveResult] = await Promise.all([
          qr.query(`DELETE FROM "audit_logs" WHERE "createdAt" < $1`, [cutoff]),
          qr.query(`DELETE FROM "comprehensive_audit_logs" WHERE "createdAt" < $1`, [cutoff]),
        ]);
        const deletedAudit        = auditResult[1]        ?? auditResult?.rowCount        ?? '?';
        const deletedComprehensive = comprehensiveResult[1] ?? comprehensiveResult?.rowCount ?? '?';
        console.log(`🗑️ Audit log purge complete — older than ${retentionDays} days: ${deletedAudit} audit_logs, ${deletedComprehensive} comprehensive_audit_logs deleted`);
      } finally {
        await qr.release();
      }
    }));

    // Community event reminders — every 5 minutes, notifies RSVPs whose event starts within the hour
    cron.schedule("*/5 * * * *", trackJob('community-event-reminders', 'cron', async () => {
      await runEventReminderJob();
    }));

    // Health check snapshot every 15 minutes
    cron.schedule("*/15 * * * *", async () => {
      try {
        const start = Date.now();
        await recordHealthCheck({
          status: 'healthy',
          version: '2.0.0',
          environment: process.env.NODE_ENV || 'development',
          uptime: process.uptime(),
          responseTimeMs: Date.now() - start,
          checkedAt: new Date(),
        });
      } catch (_) {}
    });

    console.log("📅 All enhanced scheduled cron jobs initialized.");
  }

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

  static async sendNeverSubmittedReminders() {
    const stuckDoctors = await userRepository.findDoctorsWithNoVerificationRequest();
    let sent = 0;
    for (const doctor of stuckDoctors) {
      try {
        await sendVerificationNotSubmittedReminderEmail(doctor);
        sent++;
      } catch (error) {
        console.error(`Failed to send never-submitted reminder to ${doctor.email}:`, error.message);
      }
    }
    console.log(`📤 Sent ${sent}/${stuckDoctors.length} "verification not submitted" reminders`);
  }
}

module.exports = VerificationReminderJob;
