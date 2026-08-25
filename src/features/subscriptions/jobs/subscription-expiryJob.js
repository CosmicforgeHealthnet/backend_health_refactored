// src/features/subscriptions/jobs/subscription-expiryJob.js
/**
 * Subscription Expiry Job
 *
 * Runs periodically to:
 * 1. Process expiring subscriptions (send warnings, downgrade expired)
 * 2. Reset monthly usage (1st of month)
 * 3. Process auto-renewals
 * 4. Send usage limit warnings
 * 5. Process payment token renewals (weekly)
 *
 * SCHEDULE: Run daily via cron
 *   cron.schedule('0 0 * * *', runSubscriptionExpiryJob);
 */

// config/database.js does `module.exports = AppDataSource` (a plain TypeORM
// DataSource instance, not `{ AppDataSource }`) — destructuring made this
// undefined, so AppDataSource.getRepository(...) below threw on every run.
const AppDataSource = require("../../../config/database");
const Subscription = require("../entities/Subscription");
const SubscriptionService = require("../services/subscriptionService");

async function runSubscriptionExpiryJob() {
  console.log("Running subscription expiry job...");

  try {
    const subRepo = AppDataSource.getRepository(Subscription);
    const now = new Date();

    // Find subscriptions expiring within 8 days
    const threshold = new Date();
    threshold.setDate(now.getDate() + 8);

    const expiringSubs = await subRepo
      .createQueryBuilder("sub")
      .leftJoinAndSelect("sub.user", "user")
      .where("sub.endDate <= :threshold", { threshold })
      .andWhere("sub.status = :status", { status: "active" })
      .getMany();

    console.log(`Found ${expiringSubs.length} subscriptions to process`);

    // Process each subscription (sends warnings, downgrades expired)
    for (const sub of expiringSubs) {
      try {
        await SubscriptionService.processSubscription(sub);
      } catch (error) {
        console.error(`Error processing subscription ${sub.id}:`, error.message);
      }
    }

    // Reset monthly usage on first day of month
    const isFirstDayOfMonth = now.getDate() === 1;
    if (isFirstDayOfMonth) {
      await resetMonthlyUsageForAll();
    }

    // Process auto-renewals for due subscriptions
    await processAutoRenewals();

    // Send warnings to users at 80%+ usage
    await sendUsageLimitWarnings();

    // Process payment token renewals on Mondays
    const isMonday = now.getDay() === 1;
    if (isMonday) {
      await processTokenRenewals();
    }

    console.log("Subscription expiry job complete.");

  } catch (error) {
    console.error("Error running subscription expiry job:", error.message);
  }
}

/**
 * Reset monthly usage counters for all active subscriptions
 * Called on 1st of each month
 */
async function resetMonthlyUsageForAll() {
  try {
    console.log("Resetting monthly usage for all subscriptions...");

    await SubscriptionService.resetMonthlyUsageForAll();

    console.log("Monthly usage reset complete");
  } catch (error) {
    console.error("Error resetting monthly usage:", error.message);
  }
}

/**
 * Process auto-renewals for subscriptions with auto-billing enabled
 */
async function processAutoRenewals() {
  try {
    console.log("Processing subscription auto-renewals...");

    const result = await SubscriptionService.processAutoRenewals();

    console.log(`Auto-renewals: ${result.processed} processed, ${result.failed} failed`);
  } catch (error) {
    console.error("Error processing auto-renewals:", error.message);
  }
}

/**
 * Send usage limit warnings to users at 80%+ usage
 */
async function sendUsageLimitWarnings() {
  try {
    console.log("Sending usage limit warnings...");

    const result = await SubscriptionService.sendUsageLimitWarnings();

    console.log(`Usage warnings sent: ${result.warnings} warnings`);
  } catch (error) {
    console.error("Error sending usage warnings:", error.message);
  }
}

/**
 * Process payment method token renewals
 * Notifies users whose payment tokens are expiring in 30 days
 */
async function processTokenRenewals() {
  try {
    console.log("Processing payment token renewals...");

    const userPaymentMethodRepository = require("../../payments/repositories/userPaymentMethodRepository");
    const emailService = require("../../../shared/services/email/emailService");

    // Find tokens expiring in 30 days
    let expiringTokens = [];
    try {
      expiringTokens = await userPaymentMethodRepository.findExpiringTokens(30);
    } catch (err) {
      // Repository method may not exist - skip silently
      console.log("Token renewal check skipped (method not available)");
      return;
    }

    let notified = 0;
    for (const paymentMethod of expiringTokens) {
      try {
        await emailService.send(
          "payment-token-expiring",
          paymentMethod.user.email,
          "Payment Method Expiring Soon",
          {
            name: paymentMethod.user.fullName || paymentMethod.user.email,
            cardLast4: paymentMethod.cardLast4,
            expiryDate: paymentMethod.tokenExpiryDate,
            actionUrl: "https://dashboard.cosmicforge-healthnet.com/billing"
          }
        );
        notified++;
      } catch (error) {
        console.error(`Error notifying token expiry for ${paymentMethod.id}:`, error.message);
      }
    }

    console.log(`Token renewals: ${notified}/${expiringTokens.length} notified`);
  } catch (error) {
    console.error("Error processing token renewals:", error.message);
  }
}

module.exports = runSubscriptionExpiryJob;