// src/job/autoBillingJob.js
const SubscriptionService = require("../../subscriptions/services/subscriptionService");
const userPaymentMethodRepository = require("../repositories/userPaymentMethodRepository");
const emailService = require("../../../services/email/emailService");

class AutoBillingJob {

  /**
   * Process scheduled auto-billing attempts
   */
  static async processScheduledBilling() {
    try {
      console.log('💳 Processing scheduled auto-billing...');

      const result = await SubscriptionService.processAutoRenewals();

      console.log(`✅ Auto-billing completed: ${result.processedCount} successful, ${result.errorCount} failed`);

      return result;
    } catch (error) {
      console.error('❌ Error in scheduled auto-billing:', error);
      throw error;
    }
  }

  /**
   * Handle failed auto-billing retry attempts
   */
  static async retryFailedBilling() {
    try {
      console.log('🔄 Retrying failed auto-billing attempts...');

      const subscriptionRepository = require("../../subscriptions/repositories/subscriptionRepository");

      // Find subscriptions with recent failures (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const failedSubscriptions = await subscriptionRepository.repo.find({
        where: {
          status: 'active',
          autoBillingEnabled: true,
          autoBillingFailureCount: 1, // Only retry once
          lastAutoBillingAttempt: subscriptionRepository.repo.createQueryBuilder()
            .select('lastAutoBillingAttempt')
            .where('lastAutoBillingAttempt >= :yesterday', { yesterday })
        },
        relations: ['user']
      });

      let retryCount = 0;

      for (const subscription of failedSubscriptions) {
        try {
          await SubscriptionService.attemptAutoBilling(subscription);
          retryCount++;
          console.log(`✅ Retry successful for subscription ${subscription.id}`);
        } catch (error) {
          console.error(`❌ Retry failed for subscription ${subscription.id}:`, error);
          await SubscriptionService.handleAutoBillingFailure(subscription, error);
        }
      }

      console.log(`✅ Retry attempts completed: ${retryCount} successful`);

    } catch (error) {
      console.error('❌ Error retrying failed billing:', error);
    }
  }

  /**
   * Monitor and alert on auto-billing health
   */
  static async monitorAutoBillingHealth() {
    try {
      console.log('📊 Monitoring auto-billing health...');

      const paymentService = require("../services/paymentService");
      const analytics = await paymentService.getAutoBillingAnalytics();

      // Alert if success rate drops below 85%
      if (analytics.autoBillingSuccessRate < 85) {
        console.log(`⚠️ Auto-billing success rate is low: ${analytics.autoBillingSuccessRate}%`);

        // Send alert to admin
        await this.sendAdminAlert('Low Auto-Billing Success Rate', {
          successRate: analytics.autoBillingSuccessRate,
          totalTransactions: analytics.totalAutoBillingTransactions,
          failedTransactions: analytics.failedAutoBilling
        });
      }

      // Log health metrics
      console.log(`📈 Auto-billing health: ${analytics.autoBillingSuccessRate}% success rate`);

    } catch (error) {
      console.error('❌ Error monitoring auto-billing health:', error);
    }
  }

  /**
   * Cleanup expired payment tokens
   */
  static async cleanupExpiredTokens() {
    try {
      console.log('🧹 Cleaning up expired payment tokens...');

      const expiredTokens = await userPaymentMethodRepository.repo.find({
        where: {
          tokenExpiryDate: userPaymentMethodRepository.repo.createQueryBuilder()
            .select('tokenExpiryDate')
            .where('tokenExpiryDate < :now', { now: new Date() }),
          canAutoCharge: true
        }
      });

      let cleanedCount = 0;

      for (const paymentMethod of expiredTokens) {
        try {
          // Disable auto-charging for expired tokens
          await userPaymentMethodRepository.disableAutoCharging(paymentMethod.id);
          cleanedCount++;

          console.log(`🧹 Disabled auto-charging for expired payment method ${paymentMethod.id}`);
        } catch (error) {
          console.error(`❌ Error cleaning up payment method ${paymentMethod.id}:`, error);
        }
      }

      console.log(`✅ Cleaned up ${cleanedCount} expired payment tokens`);

    } catch (error) {
      console.error('❌ Error cleaning up expired tokens:', error);
    }
  }

  /**
   * Send admin alert
   */
  static async sendAdminAlert(subject, data) {
    try {
      // Log alert for now - you can implement email/Slack later
      console.log(`🚨 ADMIN ALERT: ${subject}`, data);

      // Future: Send email to admin
      // await emailService.send('admin-alert', 'admin@yourdomain.com', subject, data);

    } catch (error) {
      console.error('❌ Error sending admin alert:', error);
    }
  }
}

module.exports = AutoBillingJob;