// src/features/subscriptions/services/subscriptionNotificationService.js
/**
 * SubscriptionNotificationService - All subscription-related notifications
 *
 * Handles:
 * - Expiration warnings
 * - Upgrade/downgrade notifications
 * - Billing notifications
 * - Usage warnings
 */

const emailService = require("../../../shared/services/email/emailService");
const { getNotificationSocket } = require("../../../shared/utils/notificationUtils");

class SubscriptionNotificationService {
  // =============================================================================
  // EXPIRATION NOTIFICATIONS
  // =============================================================================

  async sendExpirationWarning(user, subscription, daysRemaining) {
    const planName = subscription.planName || subscription.tier;
    const isDoctor = subscription.planType === "doctor";

    const message = daysRemaining > 0
      ? `Your ${planName} subscription expires in ${daysRemaining} day(s).`
      : `Your ${planName} subscription has expired.`;

    await this._notify(user, {
      type: "subscription_expiry",
      message,
      email: {
        template: this._getExpiryTemplate(daysRemaining, isDoctor),
        subject: daysRemaining > 0
          ? `Subscription Expires in ${daysRemaining} Day(s)`
          : "Subscription Expired",
        data: { daysRemaining, planName, isDoctor }
      }
    });
  }

  // =============================================================================
  // UPGRADE/DOWNGRADE NOTIFICATIONS
  // =============================================================================

  async sendUpgradeSuccess(user, planName, tier, autoBillingEnabled = false) {
    await this._notify(user, {
      type: "subscription_upgrade",
      message: `Welcome to ${planName}! Your subscription is now active.`,
      email: {
        template: "subscription-upgrade-success",
        subject: `Welcome to ${planName}!`,
        data: { planName, tier, autoBillingEnabled }
      }
    });
  }

  async sendDowngradeNotice(user, previousPlan, isDoctor = false) {
    await this._notify(user, {
      type: "subscription_downgrade",
      message: `Your ${previousPlan} subscription has been downgraded to Free.`,
      email: {
        template: isDoctor ? "doctor-subscription-downgraded" : "patient-subscription-downgraded",
        subject: "Subscription Downgraded",
        data: { previousPlan, isDoctor }
      }
    });
  }

  async sendCancellationConfirmation(user, reason = null) {
    await this._notify(user, {
      type: "subscription_canceled",
      message: "Your subscription has been canceled.",
      email: {
        template: "subscription-canceled",
        subject: "Subscription Canceled",
        data: { canceledAt: new Date(), reason }
      }
    });
  }

  // =============================================================================
  // BILLING NOTIFICATIONS
  // =============================================================================

  async sendBillingSuccess(user, subscription) {
    await this._notify(user, {
      type: "billing_success",
      message: `Your ${subscription.tier} subscription has been renewed.`,
      email: {
        template: "auto-billing-success",
        subject: "Subscription Renewed",
        data: {
          planName: subscription.tier,
          amount: subscription.price,
          currency: subscription.currency,
          nextBillingDate: subscription.nextBillingDate
        }
      }
    });
  }

  async sendBillingFailure(user, subscription, failureCount, errorMessage) {
    const isLastAttempt = failureCount >= 3;

    await this._notify(user, {
      type: "billing_failure",
      message: isLastAttempt
        ? "Auto-billing failed. Please update your payment method."
        : `Billing failed (attempt ${failureCount}/3). We'll retry soon.`,
      email: {
        template: "auto-billing-failure",
        subject: "Billing Failed",
        data: { failureCount, isLastAttempt, errorMessage }
      }
    });
  }

  async sendAutoBillingEnabled(user, cardLast4, nextBillingDate) {
    await this._notify(user, {
      type: "autobill_enabled",
      message: "Auto-billing has been enabled.",
      email: {
        template: "auto-billing-enabled",
        subject: "Auto-Billing Enabled",
        data: { cardLast4, nextBillingDate }
      }
    });
  }

  async sendAutoBillingDisabled(user) {
    await this._notify(user, {
      type: "autobill_disabled",
      message: "Auto-billing has been disabled.",
      email: {
        template: "auto-billing-disabled",
        subject: "Auto-Billing Disabled",
        data: {}
      }
    });
  }

  // =============================================================================
  // USAGE NOTIFICATIONS
  // =============================================================================

  async sendUsageWarning(user, feature, percentageUsed) {
    await this._notify(user, {
      type: "usage_warning",
      message: `You've used ${percentageUsed}% of your ${feature} limit.`,
      emailSkip: true // Usage warnings are real-time only
    });
  }

  async sendUsageLimitReached(user, feature) {
    await this._notify(user, {
      type: "usage_limit",
      message: `You've reached your ${feature} limit. Consider upgrading.`,
      email: {
        template: "usage-limit-reached",
        subject: "Usage Limit Reached",
        data: { feature }
      }
    });
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  async _notify(user, { type, message, email, emailSkip = false }) {
    const baseUrl = "https://dashboard.cosmicforge-healthnet.com";

    // WebSocket notification
    try {
      await getNotificationSocket().sendNotificationToUser(user.id, {
        type,
        message,
        metadata: { link: "/dashboard/settings/billing/subscription-plans" }
      });
    } catch (err) {
      console.warn("WebSocket notification failed:", err.message);
    }

    // Email notification
    if (!emailSkip && email) {
      try {
        await emailService.send(
          email.template,
          user.email,
          email.subject,
          {
            name: user.fullName || user.email,
            actionUrl: `${baseUrl}/doctors/dashboard/settings/billing/subscription-plans`,
            ...email.data
          }
        );
      } catch (err) {
        console.warn("Email notification failed:", err.message);
      }
    }
  }

  _getExpiryTemplate(daysRemaining, isDoctor) {
    if (daysRemaining <= 0) return "subscription-expired";

    const prefix = isDoctor ? "doctor" : "patient";
    if (daysRemaining >= 7) return `${prefix}-subscription-expiry-early`;
    if (daysRemaining >= 3) return `${prefix}-subscription-expiry-warning`;
    return `${prefix}-subscription-expiry-urgent`;
  }
}

module.exports = new SubscriptionNotificationService();
