// src/job/subscription-expiryJob.js
const { AppDataSource } = require("../../../config/database");
const Subscription = require("../entities/Subscription");
const SubscriptionService = require("../services/subscriptionService");

async function runSubscriptionExpiryJob() {
  console.log("📦 Running enhanced subscription expiration check...");

  try {
    const subRepo = AppDataSource.getRepository(Subscription);
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(now.getDate() + 8);

    // Get subscriptions that are expiring or need processing
    const expiringSubs = await subRepo
      .createQueryBuilder("sub")
      .leftJoinAndSelect("sub.user", "user")
      .where("sub.endDate <= :threshold", { threshold })
      .andWhere("sub.status = :status", { status: "active" })
      .getMany();

    console.log(`Found ${expiringSubs.length} subscriptions to process`);

    // Process each subscription with enhanced logic
    for (const sub of expiringSubs) {
      try {
        await SubscriptionService.processSubscription(sub);
      } catch (error) {
        console.error(`Error processing subscription ${sub.id}:`, error);
      }
    }

    // ENHANCED: Reset monthly usage on first day of month
    const isFirstDayOfMonth = now.getDate() === 1;
    if (isFirstDayOfMonth) {
      await resetMonthlyUsageForAll();
    }

    // ENHANCED: Process auto-renewals
    await processAutoRenewals();

    // ENHANCED: Send usage warnings
    await sendUsageLimitWarnings();

    // ENHANCED: Process token renewals (weekly)
    const isDayOfWeek = now.getDay() === 1; // Monday
    if (isDayOfWeek) {
      await processTokenRenewals();
    }

    console.log("✅ Enhanced subscription check complete.");

  } catch (error) {
    console.error("❌ Error running enhanced subscription check job:", error);
  }
}

/**
 * ENHANCED: Reset monthly usage for all active subscriptions
 */
async function resetMonthlyUsageForAll() {
  try {
    console.log('🔄 Resetting monthly usage for all subscriptions...');

    const result = await SubscriptionService.resetMonthlyUsageForAll();

    console.log(`✅ Reset monthly usage for ${result.count} subscriptions`);
  } catch (error) {
    console.error('❌ Error resetting monthly usage:', error);
  }
}

/**
 * ENHANCED: Process auto-renewals
 */
async function processAutoRenewals() {
  try {
    console.log('🔄 Processing subscription auto-renewals...');

    const result = await SubscriptionService.processAutoRenewals();

    console.log(`✅ Auto-renewals processed: ${result.processedCount} successful, ${result.errorCount} failed`);
  } catch (error) {
    console.error('❌ Error processing auto-renewals:', error);
  }
}

/**
 * ENHANCED: Send usage limit warnings
 */
async function sendUsageLimitWarnings() {
  try {
    console.log('⚠️ Sending usage limit warnings...');

    await SubscriptionService.sendUsageLimitWarnings();

    console.log('✅ Usage limit warnings sent');
  } catch (error) {
    console.error('❌ Error sending usage warnings:', error);
  }
}

/**
 * ENHANCED: Process payment method token renewals
 */
async function processTokenRenewals() {
  try {
    console.log('🔄 Processing payment token renewals...');

    const userPaymentMethodRepository = require("../../payments/repositories/userPaymentMethodRepository");
    const emailService = require("../../../shared/services/email/emailService");

    // Find tokens expiring in 30 days
    const expiringTokens = await userPaymentMethodRepository.findExpiringTokens(30);

    for (const paymentMethod of expiringTokens) {
      try {
        // Send renewal notification to user
        await emailService.send(
          "payment-token-expiring",
          paymentMethod.user.email,
          "Payment Method Expiring Soon",
          {
            name: paymentMethod.user.fullName || paymentMethod.user.email,
            cardLast4: paymentMethod.cardLast4,
            expiryDate: paymentMethod.tokenExpiryDate,
            actionUrl: "https://yourdomain.com/billing"
          }
        );

        console.log(`📧 Sent token expiry notification for payment method ${paymentMethod.id}`);
      } catch (error) {
        console.error(`❌ Error notifying token expiry for ${paymentMethod.id}:`, error);
      }
    }

    console.log(`✅ Processed ${expiringTokens.length} expiring tokens`);
  } catch (error) {
    console.error('❌ Error processing token renewals:', error);
  }
}

module.exports = runSubscriptionExpiryJob;