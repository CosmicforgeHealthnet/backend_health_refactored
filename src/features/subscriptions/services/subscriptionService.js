// src/services/subscriptionService.js
const { AppDataSource } = require("../../../config/database");
const Subscription = require("../entities/Subscription");
const User = require("../../auth/entities/User");
const userRepository = require("../../auth/repositories/userRepository");
const emailService = require("../../../shared/services/email/emailService");
const cache = require("../../../shared/utils/cache");
const subscriptionRepository = require("../repositories/subscriptionRepository");
const subscriptionCompatibilityService = require("./subscriptionCompatibilityService.js");
const doctorWalletRepository = require("../../payments/repositories/doctorWalletRepository");
const { PLAN_DEFINITIONS } = require("../utils/subscriptionConstants");
const paymentService = require("../../payments/services/paymentService");
const transactionRepository = require("../../payments/repositories/transactionRepository");
const { getNotificationSocket } = require("../../../shared/utils/notificationUtils");

class SubscriptionService {
  /**
   * Enhanced subscription processing with new features
   */
  static async processSubscription(subscription) {
    const now = new Date();
    const endDate = new Date(subscription.endDate);
    const daysRemaining = Math.floor((endDate - now) / (1000 * 60 * 60 * 24));

    // Enhanced notification schedule
    if ([30, 14, 7, 3, 1, 0].includes(daysRemaining)) {
      await this.sendExpirationNotification(
        subscription.user,
        daysRemaining,
        subscription
      );
    }

    if (daysRemaining < 0) {
      await this.downgradeExpiredSubscription(subscription);
    }

    // Check and reset monthly usage if needed
    await this.checkAndResetMonthlyUsage(subscription);
  }

  /**
   * Enhanced expiration notification with subscription context
   */
  static async sendExpirationNotification(user, daysRemaining, subscription) {
    try {
      // Get enhanced subscription data
      const enhancedSubscription =
        await subscriptionCompatibilityService.getUserSubscriptionBasic(
          user.id
        );

      const planName =
        enhancedSubscription.planDefinition?.name || subscription.tier;
      const isDoctor = enhancedSubscription.planType === "doctor";

      let message, emailTemplate;

      if (daysRemaining > 0) {
        message = `Your ${planName} subscription expires in ${daysRemaining} day(s). Renew now to keep access.`;
        emailTemplate = this.getExpirationEmailTemplate(
          daysRemaining,
          isDoctor
        );
      } else {
        message = `Your ${planName} subscription has expired. Upgrade to regain access.`;
        emailTemplate = "subscription-expired";
      }

      const metadata = {
        action: "subscription_expiry",
        daysRemaining,
        link: "/dashboard/settings/billing/subscription-plans",
        planType: enhancedSubscription.planType,
        tier: enhancedSubscription.tier,
        features: enhancedSubscription.featureList,
      };

      // Send WebSocket notification
      try {
        await getNotificationSocket().sendNotificationToUser(user.id, {
          type: "alert",
          message,
          metadata,
        });
      } catch (err) {
        console.error("⚠️ WebSocket notification failed:", err.message);
      }

      // Send email notification
      try {
        const subject =
          daysRemaining > 0
            ? `Your ${planName} Subscription Expires in ${daysRemaining} Day(s)`
            : `Your ${planName} Subscription Has Expired`;

        const emailData = {
          name: user.fullName || user.email,
          daysRemaining,
          planName,
          planType: enhancedSubscription.planType,
          features: enhancedSubscription.featureList,
          actionUrl:
            "https://dashboard.cosmicforge-healthnet.com/doctors/dashboard/settings/billing/subscription-plans",
          isDoctor,
          commissionRate: enhancedSubscription.commissionRate,
        };

        await emailService.send(emailTemplate, user.email, subject, emailData);
      } catch (err) {
        console.error("💥 Email send failed:", err.message);
      }
    } catch (error) {
      console.error("❌ Error sending expiration notification:", error);

      // Fallback to original notification system
      await this.sendBasicExpirationNotification(user, daysRemaining);
    }
  }

  /**
   * SIMPLIFIED: Create subscription payment with frontend service data
   */
  // In your SubscriptionService.createSubscriptionPayment method:
  // Update these specific methods in subscriptionService.js

  static async createSubscriptionPayment(
    userId,
    planType,
    newTier,
    countryCode = "US",
    paymentProvider = "auto",
    enableAutoBilling = false,
    serviceType
  ) {
    try {
      const CurrencyService = require("../services/currencyService");

      // Get current subscription
      const currentSubscription =
        await subscriptionCompatibilityService.getUserSubscription(userId);

      // Get plan details
      const planDefinition = PLAN_DEFINITIONS[planType][newTier];
      if (!planDefinition) {
        throw new Error(`Invalid plan: ${planType}:${newTier}`);
      }

      // Get user details
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Get real-time pricing for country
      const pricing = await CurrencyService.getPlanPricingForCountry(
        planDefinition,
        countryCode
      );
      const currency = pricing.currency;
      const amount = pricing.amount;
      const originalAmount = pricing.originalAmount;

      // ✅ Auto-select provider based on currency (no validation that breaks it)
      if (paymentProvider === "auto") {
        paymentProvider = currency === "NGN" ? "paystack" : "flutterwave";
        console.log(
          `🎯 Auto-selected ${paymentProvider} for currency ${currency}`
        );
      }

      // ✅ Use currency directly - no validation that forces USD
      const finalCurrency = currency;

      const discountAmount = originalAmount - amount;
      const discountPercentage =
        planDefinition.discountPercentage ||
        Math.round((discountAmount / originalAmount) * 100);

      // Check if trying to create payment for free tier
      if (newTier === "free") {
        throw new Error("Cannot create payment for free plan");
      }

      // NEW: Auto-upgrade if premium tier has price of 0
      if (amount <= 0) {
        console.log(`🎉 Auto-upgrading user ${userId} to ${planDefinition.name} (price: 0)`);

        // Directly upgrade user without payment
        await this.upgradeSubscription(userId, newTier, planType);

        // Clear cache to ensure fresh data
        try {
          await cache.del(`user:${userId}:subscription`);
          await cache.del(`user:${userId}:subscription:basic`);
          console.log(`✅ Cleared subscription cache after auto-upgrade for user ${userId}`);
        } catch (cacheError) {
          console.warn("Cache delete failed during auto-upgrade:", cacheError.message);
        }

        // Send upgrade success notification
        const user = await userRepository.findById(userId);
        if (user) {
          await this.sendUpgradeSuccessNotification(
            user,
            planDefinition,
            newTier,
            enableAutoBilling
          );
        }

        return {
          success: true,
          autoUpgraded: true,
          transactionId: null,
          redirectUrl: null, // Redirect to dashboard with success indicator
          planType,
          tier: newTier,
          planName: planDefinition.name,
          amount: 0,
          originalAmount: 0,
          discountAmount: 0,
          discountPercentage: 100,
          currency: finalCurrency,
          countryCode,
          paymentProvider: null,
          enableAutoBilling: false,
          message: `Successfully upgraded to ${planDefinition.name} at no cost!`,
        };
      }

      // Create payment transaction
      const paymentData = {
        patientId: userId,
        serviceType: "subscription",
        originalAmount: amount,
        originalCurrency: finalCurrency,
        paymentProvider,
        description: `Upgrade to ${planDefinition.name}`,
      };

      // Create transaction
      const transaction = await paymentService.initiatePayment(paymentData);

      // Store enhanced metadata including currency info
      await transactionRepository.repo.update(transaction.id, {
        metadata: {
          planType,
          newTier,
          currentTier: currentSubscription.tier,
          enableAutoBilling,
          originalPrice: originalAmount,
          discountAmount,
          discountPercentage,
          countryCode,
          requestedCurrency: pricing.currency,
          finalCurrency: finalCurrency,
          conversionRate: pricing.rate,
          convertedAt: pricing.convertedAt,
          currencyFallback: false, // ✅ No fallback since we use currency directly
          providerAutoSelected: paymentProvider === "auto",
        },
      });

      // Get payment redirect URL
      const userPaymentData = {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        phone: user.phone,
        title: "Subscription Upgrade",
        description: `Upgrade to ${planDefinition.name}`,
        enableAutoBilling: enableAutoBilling,
      };

      let paymentResult;
      if (paymentProvider === "flutterwave") {
        paymentResult = await paymentService.processFlutterwavePayment(
          transaction,
          userPaymentData
        );
      } else {
        paymentResult = await paymentService.processPaystackPayment(
          transaction,
          userPaymentData
        );
      }

      // ✅ Check if payment initialization failed
      if (!paymentResult.success || !paymentResult.authUrl) {
        throw new Error(
          "Payment provider failed: " +
          (paymentResult.error || "No redirect URL generated")
        );
      }

      return {
        success: true,
        transactionId: transaction.id,
        redirectUrl: paymentResult.authUrl,
        planType,
        tier: newTier,
        planName: planDefinition.name,
        amount,
        originalAmount,
        discountAmount,
        discountPercentage,
        currency: finalCurrency,
        countryCode,
        paymentProvider,
        enableAutoBilling,
        currencyInfo: {
          requested: pricing.currency,
          final: finalCurrency,
          rate: pricing.rate,
          fallback: false,
        },
      };
    } catch (error) {
      console.error("❌ Error creating subscription payment:", error);
      throw error;
    }
  }

  // Replace the testSubscriptionUpgrade method in SubscriptionService
  static async testSubscriptionUpgrade(
    transactionId,
    planType = "patient",
    newTier = "premium"
  ) {
    try {
      console.log("🧪 Manual upgrade test for transaction:", transactionId);

      // Get transaction to verify it exists
      const paymentService = require("./transactions/paymentService");
      const transaction = await paymentService.getTransactionById(
        transactionId
      );

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      console.log("🔍 Found transaction:", transaction.id);
      console.log("🔍 Current status:", transaction.status);
      console.log("🔍 Transaction metadata:", transaction.metadata);

      // Get current user subscription to determine current tier
      const currentSubscription =
        await subscriptionCompatibilityService.getUserSubscription(
          transaction.patientId
        );
      const currentTier = currentSubscription.tier;

      console.log("🔍 Current tier:", currentTier);
      console.log("🔍 Upgrading to:", newTier);

      // Add metadata if missing
      const metadata = transaction.metadata || {};
      const completeMetadata = {
        ...metadata,
        planType: planType,
        newTier: newTier,
        currentTier: currentTier,
        enableAutoBilling: true,
        manualUpgrade: true,
      };

      // Update transaction with metadata and completed status
      await transactionRepository.repo.update(transactionId, {
        status: "completed",
        completedAt: new Date(),
        metadata: completeMetadata,
      });

      console.log("✅ Transaction updated with metadata:", completeMetadata);

      // Trigger the subscription upgrade
      const result = await this.processSubscriptionUpgradeAfterPayment(
        transactionId
      );

      console.log("✅ Upgrade completed successfully");

      return {
        success: true,
        message: "Subscription upgraded successfully",
        transactionId,
        fromTier: currentTier,
        toTier: newTier,
        result,
      };
    } catch (error) {
      console.error("❌ Manual upgrade error:", error);
      throw new Error(`Manual upgrade failed: ${error.message}`);
    }
  }

  /**
   * ENHANCED: Process subscription upgrade AFTER successful payment with auto-billing setup
   */
  static async processSubscriptionUpgradeAfterPayment(transactionId) {
    try {
      console.log(
        `🔄 Processing subscription upgrade for transaction: ${transactionId}`
      );

      const paymentService = require("./transactions/paymentService");

      // Get transaction details
      const transaction = await paymentService.getTransactionById(
        transactionId
      );

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      if (transaction.status !== "completed") {
        throw new Error("Transaction not completed");
      }

      // Extract upgrade details from metadata with fallbacks
      const metadata = transaction.metadata || {};
      const { planType, newTier, currentTier, enableAutoBilling, countryCode } = metadata;

      console.log("🔍 TRANSACTION METADATA:", transaction.metadata);
      console.log("🔍 EXTRACTED VALUES:", {
        planType,
        newTier,
        currentTier,
        enableAutoBilling,
      });
      console.log("🔍 USER PAID FOR TIER:", newTier);

      // Use fallbacks if metadata is missing
      const finalPlanType = planType || "patient";
      const finalNewTier = newTier || "premium";
      const finalCurrentTier = currentTier || "free";
      const finalEnableAutoBilling = enableAutoBilling || false;

      if (!finalPlanType || !finalNewTier) {
        throw new Error("Missing plan details in transaction metadata");
      }

      // Get plan definition
      const planDefinition = PLAN_DEFINITIONS[finalPlanType][finalNewTier];
      if (!planDefinition) {
        throw new Error(`Invalid plan: ${finalPlanType}:${finalNewTier}`);
      }

      console.log(
        `📋 Upgrading user ${transaction.patientId} from ${finalCurrentTier} to ${finalNewTier}`
      );

      // 1. Update user tier in users table (backward compatibility)
      await userRepository.repo.update(transaction.patientId, {
        tier: finalNewTier,
      });
      console.log(`✅ Updated user tier to ${finalNewTier}`);

      // 2. Create or update subscription record
      let subscription = await subscriptionRepository.repo.findOne({
        where: {
          userId: transaction.patientId,
          status: "active",
        },
        order: { createdAt: "DESC" },
      });

      // Determine currency and price based on country code
      let currency = "USD";
      let price = planDefinition.price.USD;

      if (countryCode === "NG" && planDefinition.price.NGN) {
        currency = "NGN";
        price = planDefinition.price.NGN;
      }

      const now = new Date();
      const subscriptionData = {
        userId: transaction.patientId,
        tier: finalNewTier,
        planType: finalPlanType,
        status: "active",
        startDate: now,
        endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        price: price,
        currency: currency,
        autoRenew: finalEnableAutoBilling,
        commissionRate: planDefinition.commissionRate,
        features: planDefinition.features,
        monthlyLimits: planDefinition.monthlyLimits,
        currentUsage: {},
        familyMembers: planDefinition.familyMembers || 1,
        billingCycle: "monthly",
        nextBillingDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        autoBillingEnabled: finalEnableAutoBilling,
        metadata: {
          upgradedFromPayment: true,
          transactionId: transactionId,
          upgradedAt: now.toISOString(),
          previousTier: finalCurrentTier,
          countryCode: countryCode,
        },
        updatedAt: now,
      };

      if (subscription) {
        // Update existing subscription
        await subscriptionRepository.repo.update(
          subscription.id,
          subscriptionData
        );
        console.log(`✅ Updated existing subscription ${subscription.id}`);
      } else {
        // Create new subscription
        subscription = subscriptionRepository.create(subscriptionData);
        subscription = await subscriptionRepository.save(subscription);
        console.log(`✅ Created new subscription ${subscription.id}`);
      }

      // 3. Handle doctor-specific upgrades
      if (finalPlanType === "doctor") {
        await this.handleDoctorUpgrade(
          transaction.patientId,
          planDefinition.commissionRate
        );
        console.log(
          `✅ Updated doctor commission rate to ${planDefinition.commissionRate}%`
        );
      }

      // 4. Save payment method token for future auto-billing
      if (transaction.providerTransactionId) {
        try {
          // This will extract and save payment tokens from the provider response
          await paymentService.savePaymentTokenFromTransaction(transaction);
          console.log(`✅ Saved payment method token for future use`);
        } catch (tokenError) {
          console.error(`⚠️ Failed to save payment token:`, tokenError);
          // Don't fail the upgrade for token saving issues
        }
      }

      // 5. Setup auto-billing if requested
      if (finalEnableAutoBilling && subscription) {
        try {
          // Enable auto-billing on the subscription
          await subscriptionRepository.repo.update(subscription.id, {
            autoBillingEnabled: true,
            autoRenew: true,
            autoBillingFailureCount: 0,
          });

          console.log(
            `✅ Auto-billing enabled for subscription ${subscription.id}`
          );
        } catch (autoBillingError) {
          console.error(`⚠️ Failed to enable auto-billing:`, autoBillingError);
          // Don't fail the upgrade, just log the error
        }
      }

      // 6. Clear user subscription cache
      try {
        await cache.del(`user:${transaction.patientId}:subscription`);
        console.log(
          `✅ Cleared subscription cache for user ${transaction.patientId}`
        );
      } catch (cacheError) {
        console.warn("Cache clear failed:", cacheError.message);
      }

      // 7. Send upgrade success notification
      try {
        const user = await userRepository.findById(transaction.patientId);
        if (user) {
          await this.sendUpgradeSuccessNotification(
            user,
            planDefinition,
            finalNewTier,
            finalEnableAutoBilling
          );
        }
      } catch (notificationError) {
        console.error(
          `⚠️ Failed to send upgrade notification:`,
          notificationError
        );
      }

      console.log(
        `✅ Subscription upgrade completed: ${finalCurrentTier} → ${finalNewTier} for user ${transaction.patientId}`
      );

      // 8. Get the enhanced subscription data to return
      const enhancedSubscription =
        await subscriptionCompatibilityService.getUserSubscriptionBasic(
          transaction.patientId
        );

      return {
        success: true,
        subscription: enhancedSubscription,
        transaction,
        autoBillingEnabled: finalEnableAutoBilling,
        previousTier: finalCurrentTier,
        newTier: finalNewTier,
        planType: finalPlanType,
      };
    } catch (error) {
      console.error(
        "❌ Error processing subscription upgrade after payment:",
        error
      );

      // Try to revert user tier on failure
      try {
        // Get transaction again for rollback
        const paymentService = require("./transactions/paymentService");
        const transactionForRollback = await paymentService.getTransactionById(
          transactionId
        );

        const { currentTier } = transactionForRollback?.metadata || {};
        if (currentTier && transactionForRollback?.patientId) {
          await userRepository.repo.update(transactionForRollback.patientId, {
            tier: currentTier,
          });
          console.log(
            `🔄 Reverted user tier to ${currentTier} due to upgrade failure`
          );
        }
      } catch (revertError) {
        console.error("❌ Failed to revert user tier:", revertError);
      }

      throw error;
    }
  }

  /**
   * Send upgrade success notification
   */
  static async sendUpgradeSuccessNotification(
    user,
    planDefinition,
    newTier,
    autoBillingEnabled
  ) {
    try {
      // WebSocket notification
      await getNotificationSocket().sendNotificationToUser(user.id, {
        type: "subscription_upgrade_success",
        message: `Welcome to ${planDefinition.name}! Your subscription has been activated.`,
        metadata: {
          action: "subscription_upgraded",
          newTier: newTier,
          planName: planDefinition.name,
          autoBillingEnabled,
          link: "/dashboard/settings/billing/subscription-plans",
        },
      });

      // Email notification
      await emailService.send(
        "subscription-upgrade-success",
        user.email,
        `Welcome to ${planDefinition.name}!`,
        {
          name: user.fullName || user.email,
          planName: planDefinition.name,
          tier: newTier,
          features: Object.keys(planDefinition.features),
          autoBillingEnabled,
          dashboardUrl:
            "https://dashboard.cosmicforge-healthnet.com/doctors/dashboard/settings/billing/subscription-plans",
        }
      );

      console.log(`✅ Sent upgrade success notification to ${user.email}`);
    } catch (error) {
      console.error("❌ Error sending upgrade success notification:", error);
    }
  }

  /**
   * NEW: Process subscription payment using saved payment method
   */
  static async processSubscriptionPaymentWithSavedMethod(
    userId,
    planType,
    newTier,
    paymentMethodId,
    currency = "USD",
    serviceType = "subscription_upgrade"
  ) {
    try {
      const paymentService = require("./transactions/paymentService");
      const userPaymentMethodRepository = require("../repositories/transactions/userPaymentMethodRepository");

      // Verify payment method belongs to user
      const paymentMethod = await userPaymentMethodRepository.findById(
        paymentMethodId
      );
      if (!paymentMethod || paymentMethod.userId !== userId) {
        throw new Error("Invalid payment method");
      }

      if (!paymentMethod.canAutoCharge) {
        throw new Error("Payment method not enabled for auto-charging");
      }

      // Create subscription payment
      const paymentResult = await this.createSubscriptionPayment(
        userId,
        planType,
        newTier,
        currency,
        this.getBestProviderForPaymentMethod(paymentMethod),
        false, // enableAutoBilling - can be set separately
        serviceType
      );

      if (!paymentResult.success) {
        throw new Error("Failed to create subscription payment");
      }

      // Process payment with saved method
      const processResult = await paymentService.processPayment({
        transactionId: paymentResult.transactionId,
        paymentProvider: this.getBestProviderForPaymentMethod(paymentMethod),
        useStoredMethod: true,
        paymentMethodId,
      });

      if (processResult.success) {
        // Upgrade subscription after successful payment
        await this.processSubscriptionUpgradeAfterPayment(
          paymentResult.transactionId
        );
      }

      return {
        success: processResult.success,
        transaction: processResult.transaction,
        paymentResult: processResult,
      };
    } catch (error) {
      console.error(
        "❌ Error processing subscription payment with saved method:",
        error
      );
      throw error;
    }
  }

  // ================================
  // 5. HELPER METHOD - Get best provider for payment method
  // ================================

  /**
   * Get best provider for payment method
   */
  static getBestProviderForPaymentMethod(paymentMethod) {
    // Check success rates
    const flutterwaveRate =
      paymentMethod.flutterwaveAttemptCount > 0
        ? paymentMethod.flutterwaveSuccessCount /
        paymentMethod.flutterwaveAttemptCount
        : 0.85;

    const paystackRate =
      paymentMethod.paystackAttemptCount > 0
        ? paymentMethod.paystackSuccessCount /
        paymentMethod.paystackAttemptCount
        : 0.8;

    // Check for available tokens
    const hasFlutterwaveToken = !!paymentMethod.flutterwaveToken;
    const hasPaystackToken = !!paymentMethod.paystackToken;

    if (
      hasFlutterwaveToken &&
      (!hasPaystackToken || flutterwaveRate >= paystackRate)
    ) {
      return "flutterwave";
    } else if (hasPaystackToken) {
      return "paystack";
    } else {
      return "flutterwave"; // Default
    }
  }

  static async cancelSubscription(userId, reason = null) {
    // 1. Fetch the user's current subscription
    const currentSub =
      await subscriptionCompatibilityService.getUserSubscription(userId);
    if (!currentSub?.id) {
      throw new Error("No active subscription found to cancel");
    }

    // 2. Mark it as canceled (use the enum value "canceled", not "cancelled")
    await subscriptionRepository.repo.update(currentSub.id, {
      status: "canceled", // ← corrected spelling
      canceledAt: new Date(),
      autoRenew: false,
      metadata: {
        ...currentSub.metadata,
        cancelReason: reason,
        canceledAt: new Date().toISOString(),
      },
    });

    // 3. Clear the cached subscription
    await cache.del(`user:${userId}:subscription`);

    // 4. Notify via WebSocket (optional)
    try {
      await getNotificationSocket().sendNotificationToUser(userId, {
        type: "subscription_cancel",
        message: "Your subscription has been canceled.",
        metadata: { reason },
      });
    } catch (err) {
      console.error("⚠️ WebSocket notify failed on cancel:", err.message);
    }

    // 5. Send confirmation email
    const user = await userRepository.findById(userId);
    if (user && user.email) {
      try {
        await emailService.send(
          "subscription-canceled",
          user.email,
          "Your Subscription Has Been Canceled",
          {
            name: user.fullName || user.email,
            canceledAt: new Date(),
            reason,
          }
        );
      } catch (err) {
        console.error("💥 Email send failed on cancel:", err.message);
      }
    }
  }

  /**
   * Get appropriate email template based on expiry timeline and user type
   */
  static getExpirationEmailTemplate(daysRemaining, isDoctor) {
    if (isDoctor) {
      if (daysRemaining >= 7) return "doctor-subscription-expiry-early";
      if (daysRemaining >= 3) return "doctor-subscription-expiry-warning";
      return "doctor-subscription-expiry-urgent";
    } else {
      if (daysRemaining >= 7) return "patient-subscription-expiry-early";
      if (daysRemaining >= 3) return "patient-subscription-expiry-warning";
      return "patient-subscription-expiry-urgent";
    }
  }

  /**
   * ENHANCED: Process auto-renewals with payment integration
   */
  static async processAutoRenewals() {
    try {
      console.log("🔄 Processing auto-renewals...");

      // Find subscriptions ready for auto-billing
      const subscriptionsToRenew =
        await subscriptionRepository.findSubscriptionsForAutoBilling();
      console.log(
        `Found ${subscriptionsToRenew.length} subscriptions for auto-billing`
      );

      let processedCount = 0;
      let errorCount = 0;

      for (const subscription of subscriptionsToRenew) {
        try {
          await this.attemptAutoBilling(subscription);
          processedCount++;
        } catch (error) {
          console.error(
            `❌ Auto-billing failed for subscription ${subscription.id}:`,
            error
          );
          await this.handleAutoBillingFailure(subscription, error);
          errorCount++;
        }
      }

      console.log(
        `✅ Auto-renewal processing complete: ${processedCount} successful, ${errorCount} failed`
      );
      return { processedCount, errorCount };
    } catch (error) {
      console.error("❌ Error processing auto-renewals:", error);
      throw error;
    }
  }

  /**
   * Attempt auto-billing for subscription
   */
  static async attemptAutoBilling(subscription) {
    const userPaymentMethodRepository = require("../repositories/transactions/userPaymentMethodRepository");
    const paymentService = require("./transactions/paymentService");

    // Get best payment method for user
    const paymentMethod =
      await userPaymentMethodRepository.getBestForAutoBilling(
        subscription.userId
      );

    if (!paymentMethod || !paymentMethod.canAutoCharge) {
      throw new Error("No valid payment method available for auto-billing");
    }

    // Check if tokens are expired
    if (
      paymentMethod.tokenExpiryDate &&
      new Date(paymentMethod.tokenExpiryDate) <= new Date()
    ) {
      throw new Error("Payment method token has expired");
    }

    // Determine next billing date
    const nextBillingDate = this.calculateNextBillingDate(subscription);

    // Create auto-billing transaction
    const paymentData = {
      patientId: subscription.userId,
      serviceType: "subscription_renewal",
      serviceId: subscription.id,
      planType: subscription.planType,
      billingCycle: subscription.billingCycle,
      originalAmount: subscription.price,
      originalCurrency: subscription.currency,
      paymentProvider: this.getBestProviderForAutoBilling(paymentMethod),
      paymentMethodId: paymentMethod.id,
      description: `Auto-renewal: ${subscription.tier} ${subscription.planType} plan`,
      isAutoBilling: true,
    };

    // Process payment using stored token
    const result = await this.processAutoBillingPayment(
      paymentData,
      paymentMethod
    );

    if (result.success) {
      // Extend subscription
      await this.extendSubscription(subscription, nextBillingDate);

      // Reset failure count
      await subscriptionRepository.resetAutoBillingFailures(subscription.id);

      // Update payment method success
      await userPaymentMethodRepository.updateAutoBillingResult(
        paymentMethod.id,
        true
      );

      // Send success notification
      await this.sendAutoBillingSuccessNotification(subscription);

      console.log(
        `✅ Auto-billing successful for subscription ${subscription.id}`
      );
    } else {
      throw new Error(result.error || "Auto-billing payment failed");
    }
  }

  /**
   * Process auto-billing payment using stored token
   */
  static async processAutoBillingPayment(paymentData, paymentMethod) {
    const paymentService = require("./transactions/paymentService");

    try {
      // Create transaction
      const transaction = await paymentService.initiatePayment(paymentData);

      // Use stored token for payment
      const tokenPaymentData = {
        isTokenPayment: true,
        flutterwaveToken: paymentMethod.flutterwaveToken,
        paystackToken: paymentMethod.paystackToken,
        email: paymentData.patientEmail || "user@example.com",
        paymentMethodId: paymentMethod.id,
      };

      const result = await paymentService.processPayment({
        transactionId: transaction.id,
        paymentProvider: paymentData.paymentProvider,
        paymentData: tokenPaymentData,
      });

      return result;
    } catch (error) {
      console.error("Error processing auto-billing payment:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle auto-billing failure
   */
  static async handleAutoBillingFailure(subscription, error) {
    // Update failure count
    await subscriptionRepository.updateAutoBillingFailure(subscription.id);

    const failureCount = (subscription.autoBillingFailureCount || 0) + 1;

    // Update payment method failure
    if (subscription.preferredPaymentMethodId) {
      const userPaymentMethodRepository = require("../repositories/transactions/userPaymentMethodRepository");
      await userPaymentMethodRepository.updateAutoBillingResult(
        subscription.preferredPaymentMethodId,
        false
      );
    }

    // Send failure notification
    await this.sendAutoBillingFailureNotification(
      subscription,
      failureCount,
      error.message
    );

    // Disable auto-billing after 3 failures
    if (failureCount >= 3) {
      await subscriptionRepository.disableAutoBilling(subscription.id);
      await this.sendAutoBillingDisabledNotification(subscription);
      console.log(
        `🚫 Auto-billing disabled for subscription ${subscription.id} after 3 failures`
      );
    }
  }

  /**
   * Enable auto-billing for user
   */
  static async enableAutoBilling(userId, paymentMethodId) {
    const subscriptionCompatibilityService = require("./subscriptionCompatibilityService");
    const userPaymentMethodRepository = require("../repositories/transactions/userPaymentMethodRepository");

    // Get user's subscription
    const subscription =
      await subscriptionCompatibilityService.getUserSubscription(userId);

    if (!subscription.id) {
      throw new Error("No active subscription found");
    }

    if (!subscription.isPremium) {
      throw new Error("Auto-billing only available for premium subscriptions");
    }

    // Verify payment method
    const paymentMethod = await userPaymentMethodRepository.findById(
      paymentMethodId
    );
    if (!paymentMethod || paymentMethod.userId !== userId) {
      throw new Error("Invalid payment method");
    }

    if (!paymentMethod.canAutoCharge) {
      throw new Error("Payment method not eligible for auto-billing");
    }

    // Enable auto-billing
    await subscriptionRepository.enableAutoBilling(
      subscription.id,
      paymentMethodId
    );

    // Clear cache
    await cache.del(`user:${userId}:subscription`);

    // Send confirmation
    await this.sendAutoBillingEnabledNotification(subscription, paymentMethod);

    console.log(`✅ Auto-billing enabled for user ${userId}`);
  }

  /**
   * Disable auto-billing for user
   */
  static async disableAutoBilling(userId) {
    const subscriptionCompatibilityService = require("./subscriptionCompatibilityService");

    const subscription =
      await subscriptionCompatibilityService.getUserSubscription(userId);

    if (!subscription.id) {
      throw new Error("No active subscription found");
    }

    await subscriptionRepository.disableAutoBilling(subscription.id);

    // Clear cache
    await cache.del(`user:${userId}:subscription`);

    console.log(`✅ Auto-billing disabled for user ${userId}`);
  }

  /**
   * Calculate next billing date
   */
  static calculateNextBillingDate(subscription) {
    const currentDate = new Date();
    let nextDate = new Date(currentDate);

    switch (subscription.billingCycle) {
      case "monthly":
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case "quarterly":
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case "yearly":
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        nextDate.setMonth(nextDate.getMonth() + 1);
    }

    return nextDate;
  }

  /**
   * Extend subscription after successful auto-billing
   */
  static async extendSubscription(subscription, nextBillingDate) {
    const newEndDate = this.calculateNextBillingDate(subscription);

    await subscriptionRepository.repo.update(subscription.id, {
      endDate: newEndDate,
      nextBillingDate: nextBillingDate,
      updatedAt: new Date(),
      metadata: {
        ...subscription.metadata,
        lastAutoRenewal: new Date().toISOString(),
      },
    });
  }

  /**
   * Reset monthly usage for all subscriptions
   */
  static async resetMonthlyUsageForAll() {
    try {
      const result = await subscriptionRepository.repo.update(
        { status: "active" },
        {
          currentUsage: {},
          metadata: subscriptionRepository.repo.raw(`
            jsonb_set(
              COALESCE(metadata, '{}'), 
              '{lastUsageReset}', 
              to_jsonb(NOW()::text)
            )
          `),
          updatedAt: new Date(),
        }
      );

      console.log(
        `✅ Reset monthly usage for ${result.affected} subscriptions`
      );

      return { count: result.affected };
    } catch (error) {
      console.error("❌ Error resetting monthly usage:", error);
      throw error;
    }
  }

  /**
   * Get best provider for auto-billing
   */
  static getBestProviderForAutoBilling(paymentMethod) {
    // Check success rates and choose best provider
    const flutterwaveRate =
      paymentMethod.autoBillingSuccessCount > 0
        ? paymentMethod.autoBillingSuccessCount /
        (paymentMethod.autoBillingSuccessCount +
          paymentMethod.autoBillingFailureCount)
        : 0.85;

    const paystackRate =
      paymentMethod.autoBillingSuccessCount > 0
        ? paymentMethod.autoBillingSuccessCount /
        (paymentMethod.autoBillingSuccessCount +
          paymentMethod.autoBillingFailureCount)
        : 0.8;

    // Also consider if tokens exist
    const hasFlutterwaveToken = !!paymentMethod.flutterwaveToken;
    const hasPaystackToken = !!paymentMethod.paystackToken;

    if (
      hasFlutterwaveToken &&
      (!hasPaystackToken || flutterwaveRate >= paystackRate)
    ) {
      return "flutterwave";
    } else if (hasPaystackToken) {
      return "paystack";
    } else {
      return paymentMethod.lastSuccessfulProvider || "flutterwave";
    }
  }

  /**
   * Send auto-billing success notification
   */
  static async sendAutoBillingSuccessNotification(subscription) {
    try {
      const user = await userRepository.findById(subscription.userId);
      if (!user) return;

      // WebSocket notification
      await getNotificationSocket().sendNotificationToUser(
        subscription.userId,
        {
          type: "auto_billing_success",
          message: `Your ${subscription.tier} subscription has been automatically renewed.`,
          metadata: {
            action: "auto_billing_success",
            subscriptionId: subscription.id,
            amount: subscription.price,
            currency: subscription.currency,
            nextBillingDate: subscription.nextBillingDate,
          },
        }
      );

      // Email notification
      await emailService.send(
        "auto-billing-success",
        user.email,
        "Subscription Automatically Renewed",
        {
          name: user.fullName || user.email,
          planName: subscription.tier,
          amount: subscription.price,
          currency: subscription.currency,
          nextBillingDate: subscription.nextBillingDate,
        }
      );
    } catch (error) {
      console.error(
        "❌ Error sending auto-billing success notification:",
        error
      );
    }
  }

  /**
   * Send auto-billing failure notification
   */
  static async sendAutoBillingFailureNotification(
    subscription,
    failureCount,
    errorMessage
  ) {
    try {
      const user = await userRepository.findById(subscription.userId);
      if (!user) return;

      const isLastAttempt = failureCount >= 3;
      const message = isLastAttempt
        ? `Auto-billing failed 3 times. Please update your payment method to avoid service interruption.`
        : `Auto-billing failed (attempt ${failureCount}/3). We'll retry soon.`;

      // WebSocket notification
      await getNotificationSocket().sendNotificationToUser(
        subscription.userId,
        {
          type: "auto_billing_failure",
          message,
          metadata: {
            action: "auto_billing_failure",
            failureCount,
            isLastAttempt,
            link: "/billing",
          },
        }
      );

      // Email notification
      await emailService.send(
        "auto-billing-failure",
        user.email,
        "Subscription Auto-Billing Failed",
        {
          name: user.fullName || user.email,
          planName: subscription.tier,
          failureCount,
          isLastAttempt,
          errorMessage,
          actionUrl:
            "https://dashboard.cosmicforge-healthnet.com/doctors/dashboard/settings/billing/subscription-plans",
        }
      );
    } catch (error) {
      console.error(
        "❌ Error sending auto-billing failure notification:",
        error
      );
    }
  }

  /**
   * Send auto-billing enabled notification
   */
  static async sendAutoBillingEnabledNotification(subscription, paymentMethod) {
    try {
      const user = await userRepository.findById(subscription.userId);
      if (!user) return;

      await emailService.send(
        "auto-billing-enabled",
        user.email,
        "Auto-Billing Enabled",
        {
          name: user.fullName || user.email,
          planName: subscription.tier,
          cardLast4: paymentMethod.cardLast4,
          nextBillingDate: subscription.nextBillingDate,
        }
      );
    } catch (error) {
      console.error(
        "❌ Error sending auto-billing enabled notification:",
        error
      );
    }
  }

  /**
   * Send auto-billing disabled notification
   */
  static async sendAutoBillingDisabledNotification(subscription) {
    try {
      const user = await userRepository.findById(subscription.userId);
      if (!user) return;

      await emailService.send(
        "auto-billing-disabled",
        user.email,
        "Auto-Billing Disabled",
        {
          name: user.fullName || user.email,
          planName: subscription.tier,
          actionUrl:
            "https://dashboard.cosmicforge-healthnet.com/doctors/dashboard/settings/billing/subscription-plans",
        }
      );
    } catch (error) {
      console.error(
        "❌ Error sending auto-billing disabled notification:",
        error
      );
    }
  }

  /**
   * Send usage limit warnings
   */
  static async sendUsageLimitWarnings() {
    try {
      console.log("⚠️ Checking for usage limit warnings...");

      const subscriptions = await subscriptionRepository.repo.find({
        where: { status: "active" },
        relations: ["user"],
      });

      let warningCount = 0;

      for (const subscription of subscriptions) {
        try {
          const enhanced =
            await subscriptionCompatibilityService.enhanceSubscriptionData(
              subscription
            );

          // Check for limits approaching 80%
          for (const [feature, usage] of Object.entries(
            enhanced.usagePercentage
          )) {
            if (usage.percentage >= 80 && usage.percentage < 100) {
              await this.sendUsageWarningNotification(
                subscription,
                feature,
                usage
              );
              warningCount++;
            }
          }
        } catch (error) {
          console.error(
            `Error checking usage for subscription ${subscription.id}:`,
            error
          );
        }
      }

      console.log(`✅ Sent ${warningCount} usage limit warnings`);
    } catch (error) {
      console.error("❌ Error sending usage limit warnings:", error);
    }
  }

  /**
   * Send usage warning notification
   */
  static async sendUsageWarningNotification(subscription, feature, usage) {
    try {
      const user = subscription.user;
      if (!user) return;

      const message = `You've used ${usage.percentage}% of your ${feature} limit. Consider upgrading to avoid interruption.`;

      await getNotificationSocket().sendNotificationToUser(
        subscription.userId,
        {
          type: "usage_warning",
          message,
          metadata: {
            action: "usage_warning",
            feature,
            usage,
            link: "/dashboard/settings/billing/subscription",
          },
        }
      );
    } catch (error) {
      console.error("❌ Error sending usage warning notification:", error);
    }
  }

  /**
   * Enhanced subscription downgrade with wallet considerations
   */
  static async downgradeExpiredSubscription(subscription) {
    try {
      // Get enhanced subscription data
      const enhancedSubscription =
        await subscriptionCompatibilityService.getUserSubscription(
          subscription.user.id
        );
      const isDoctor = enhancedSubscription.planType === "doctor";

      // Update subscription status
      await subscriptionRepository.repo.update(subscription.id, {
        status: "expired",
        canceledAt: new Date(),
        metadata: {
          ...subscription.metadata,
          downgradedAt: new Date().toISOString(),
          previousTier: subscription.tier,
        },
      });

      // Update user tier (backward compatibility)
      await userRepository.repo.update(subscription.user.id, { tier: "free" });

      // Get country code from subscription metadata or user profile
      const countryCode = subscription.metadata?.countryCode || subscription.user?.countryCode || "US";

      // Create new free subscription
      await this.createFreeSubscription(
        subscription.user.id,
        isDoctor ? "doctor" : "patient",
        countryCode
      );

      // Handle doctor-specific downgrade
      if (isDoctor) {
        await this.handleDoctorDowngrade(
          subscription.user.id,
          enhancedSubscription
        );
      }

      // Clear cache
      await cache.del(`user:${subscription.user.id}:premium`);
      await cache.del(`user:${subscription.user.id}:subscription`);

      console.log(
        `✅ Downgraded user ${subscription.user.id} to free tier (${isDoctor ? "doctor" : "patient"
        })`
      );

      // Send downgrade notification
      await this.sendDowngradeNotification(
        subscription.user,
        enhancedSubscription
      );
    } catch (error) {
      console.error("❌ Failed to downgrade subscription:", error);
      throw error;
    }
  }

  /**
   * Handle doctor-specific downgrade logic
   */
  static async handleDoctorDowngrade(doctorId, previousSubscription) {
    try {
      // Update commission rate to free plan rate (30%)
      const wallet = await doctorWalletRepository.findByDoctorId(doctorId);

      if (wallet) {
        const walletMetadata = {
          ...wallet.metadata,
          commissionRate: 30.0, // Free plan rate
          subscriptionTier: "free",
          downgradedAt: new Date().toISOString(),
          previousCommissionRate: previousSubscription.commissionRate,
        };

        await doctorWalletRepository.repo.update(wallet.id, {
          metadata: walletMetadata,
          updatedAt: new Date(),
        });

        console.log(
          `✅ Updated doctor wallet commission rate to 30% for ${doctorId}`
        );
      }
    } catch (error) {
      console.error("❌ Error handling doctor downgrade:", error);
    }
  }

  /**
   * Create new free subscription after downgrade
   */
  static async createFreeSubscription(userId, planType, countryCode = "US") {
    try {
      // Determine currency based on country code (free plans are always 0 price but currency matters for consistency)
      let currency = "USD";
      if (countryCode === "NG") {
        currency = "NGN";
      }

      const freeSubscriptionData = {
        userId,
        tier: "free",
        planType,
        status: "active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        price: 0.0,
        currency: currency,
        autoRenew: false,
        commissionRate: planType === "doctor" ? 30.0 : null,
        features: this.getFreeFeatures(planType),
        monthlyLimits: this.getFreeLimits(planType),
        currentUsage: {},
        familyMembers: 1,
        billingCycle: "monthly",
        metadata: {
          createdOnDowngrade: true,
          createdAt: new Date().toISOString(),
          countryCode: countryCode,
        },
      };

      const subscription = subscriptionRepository.create(freeSubscriptionData);
      await subscriptionRepository.save(subscription);

      console.log(
        `✅ Created free ${planType} subscription for user ${userId}`
      );
    } catch (error) {
      console.error("❌ Error creating free subscription:", error);
    }
  }

  /**
   * Send downgrade notification
   */
  static async sendDowngradeNotification(user, previousSubscription) {
    try {
      const isDoctor = previousSubscription.planType === "doctor";
      const planName =
        previousSubscription.planDefinition?.name || previousSubscription.tier;

      const message = `Your ${planName} subscription has expired and been downgraded to Free plan. Upgrade anytime to restore full features.`;

      // WebSocket notification
      await getNotificationSocket().sendNotificationToUser(user.id, {
        type: "subscription_downgrade",
        message,
        metadata: {
          action: "subscription_downgraded",
          previousTier: previousSubscription.tier,
          newTier: "free",
          link: "/billing",
        },
      });

      // Email notification
      const emailTemplate = isDoctor
        ? "doctor-subscription-downgraded"
        : "patient-subscription-downgraded";

      await emailService.send(
        emailTemplate,
        user.email,
        `${planName} Subscription Downgraded`,
        {
          name: user.fullName || user.email,
          previousPlanName: planName,
          newPlanName: "Free Plan",
          actionUrl:
            "https://dashboard.cosmicforge-healthnet.com/doctors/dashboard/settings/billing/subscription-plans",
          isDoctor,
          newCommissionRate: isDoctor ? 30 : null,
        }
      );
    } catch (error) {
      console.error("❌ Error sending downgrade notification:", error);
    }
  }

  /**
   * Check and reset monthly usage if needed
   */
  static async checkAndResetMonthlyUsage(subscription) {
    try {
      const now = new Date();
      const lastReset = subscription.metadata?.lastUsageReset
        ? new Date(subscription.metadata.lastUsageReset)
        : new Date(subscription.startDate);

      // Check if it's been a month since last reset
      const monthsSinceReset =
        (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24 * 30);

      if (monthsSinceReset >= 1) {
        await subscriptionRepository.repo.update(subscription.id, {
          currentUsage: {},
          metadata: {
            ...subscription.metadata,
            lastUsageReset: now.toISOString(),
          },
          updatedAt: now,
        });

        console.log(
          `✅ Reset monthly usage for subscription ${subscription.id}`
        );
      }
    } catch (error) {
      console.error("❌ Error checking/resetting monthly usage:", error);
    }
  }

  /**
   * Upgrade user subscription
   */
  /**
   * Upgrade user subscription
   */
  static async upgradeSubscription(userId, newTier, planType = null, countryCode = "US") {
    try {
      const currentSubscription =
        await subscriptionCompatibilityService.getUserSubscription(userId);

      if (!planType) {
        planType = currentSubscription.planType || "patient";
      }

      const planDefinition = PLAN_DEFINITIONS[planType][newTier];
      if (!planDefinition) {
        throw new Error(`Invalid plan: ${planType}:${newTier}`);
      }

      // Determine currency and price based on country code
      let currency = "USD";
      let price = planDefinition.price.USD;

      if (countryCode === "NG" && planDefinition.price.NGN) {
        currency = "NGN";
        price = planDefinition.price.NGN;
      }

      // NEW: Calculate next billing date
      const now = new Date();
      const nextBillingDate = new Date(now);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1); // Default to monthly

      // Update current subscription
      const updateData = {
        tier: newTier,
        planType,
        commissionRate: planDefinition.commissionRate,
        features: planDefinition.features,
        monthlyLimits: planDefinition.monthlyLimits,
        familyMembers: planDefinition.familyMembers || 1,
        price: price,
        currency: currency,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Set end date to 30 days from now
        nextBillingDate, // ADD THIS
        billingCycle: "monthly", // ADD THIS
        updatedAt: new Date(),
        metadata: {
          ...currentSubscription.metadata,
          upgradedAt: new Date().toISOString(),
          previousTier: currentSubscription.tier,
          countryCode: countryCode,
        },
      };

      // Rest of the method stays the same...

      if (currentSubscription.id) {
        // Update existing subscription
        await subscriptionRepository.repo.update(
          currentSubscription.id,
          updateData
        );
      } else {
        // Create new subscription if none exists
        const newSubscription = subscriptionRepository.create({
          userId,
          ...updateData,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days instead of 365
        });
        await subscriptionRepository.save(newSubscription);
      }

      // Update user tier (backward compatibility)
      // const userRepository = AppDataSource.getRepository(User);
      await userRepository.repo.update(userId, { tier: newTier });

      // Handle doctor-specific upgrade
      if (planType === "doctor") {
        await this.handleDoctorUpgrade(userId, planDefinition.commissionRate);
      }

      // Clear cache - clear both full and basic subscription caches
      try {
        await cache.del(`user:${userId}:subscription`);
        await cache.del(`user:${userId}:subscription:basic`);
        console.log(`✅ Cleared subscription cache for user ${userId}`);
      } catch (cacheError) {
        console.warn("Cache delete failed:", cacheError.message);
      }

      console.log(`✅ Upgraded user ${userId} to ${planType}:${newTier}`);

      return await subscriptionCompatibilityService.getUserSubscription(userId);
    } catch (error) {
      console.error("❌ Error upgrading subscription:", error);
      throw error;
    }
  }

  /**
   * Handle doctor-specific upgrade logic
   */
  static async handleDoctorUpgrade(doctorId, newCommissionRate) {
    try {
      const wallet = await doctorWalletRepository.findByDoctorId(doctorId);

      if (wallet) {
        const walletMetadata = {
          ...wallet.metadata,
          commissionRate: newCommissionRate,
          upgradedAt: new Date().toISOString(),
        };

        await doctorWalletRepository.repo.update(wallet.id, {
          metadata: walletMetadata,
          updatedAt: new Date(),
        });

        console.log(
          `✅ Updated doctor wallet commission rate to ${newCommissionRate}% for ${doctorId}`
        );
      }
    } catch (error) {
      console.error("❌ Error handling doctor upgrade:", error);
    }
  }

  /**
   * Get free plan features
   */
  static getFreeFeatures(planType) {
    return PLAN_DEFINITIONS[planType].free.features;
  }

  /**
   * Get free plan limits
   */
  static getFreeLimits(planType) {
    return PLAN_DEFINITIONS[planType].free.monthlyLimits;
  }

  /**
   * Fallback notification method (backward compatibility)
   */
  static async sendBasicExpirationNotification(user, daysRemaining) {
    const message =
      daysRemaining > 0
        ? `Your premium subscription expires in ${daysRemaining} day(s). Renew now to keep access.`
        : `Your premium subscription has expired. Upgrade to regain access.`;

    const metadata = {
      action: "subscription_expiry",
      daysRemaining,
      link: "/dashboard/settings/billing/subscription",
    };

    try {
      await getNotificationSocket().sendNotificationToUser(user.id, {
        type: "subscription",
        message,
        metadata,
      });
    } catch (err) {
      console.error("⚠️ WebSocket notification failed:", err.message);
    }

    try {
      const templateName = "subscription-expiry";
      const subject =
        daysRemaining > 0
          ? "Your Subscription is Expiring Soon"
          : "Your Subscription Has Expired";

      await emailService.send(templateName, user.email, subject, {
        name: user.fullName || user.email,
        daysRemaining,
        actionUrl:
          "https://dashboard.cosmicforge-healthnet.com/doctors/dashboard/settings/billing/subscription-plans",
      });
    } catch (err) {
      console.error("💥 Email send failed:", err.message);
    }
  }

  /**
   * Batch process subscriptions (for background job)
   */
  static async batchProcessSubscriptions() {
    try {
      console.log("🔄 Starting batch subscription processing...");

      const subscriptions = await subscriptionRepository.repo.find({
        where: { status: "active" },
        relations: ["user"],
      });

      let processedCount = 0;
      let errorCount = 0;

      for (const subscription of subscriptions) {
        try {
          await this.processSubscription(subscription);
          processedCount++;
        } catch (error) {
          console.error(
            `❌ Error processing subscription ${subscription.id}:`,
            error
          );
          errorCount++;
        }
      }

      console.log(
        `✅ Batch processing completed: ${processedCount} processed, ${errorCount} errors`
      );

      return { processedCount, errorCount };
    } catch (error) {
      console.error("❌ Error in batch subscription processing:", error);
      throw error;
    }
  }

  /**
   * Get subscription analytics
   */
  static async getSubscriptionAnalytics() {
    try {
      const analytics = await subscriptionRepository.repo
        .createQueryBuilder("subscription")
        .select([
          "COUNT(*) as totalSubscriptions",
          "COUNT(CASE WHEN status = 'active' THEN 1 END) as activeSubscriptions",
          "COUNT(CASE WHEN status = 'expired' THEN 1 END) as expiredSubscriptions",
          "COUNT(CASE WHEN \"planType\" = 'doctor' THEN 1 END) as doctorSubscriptions",
          "COUNT(CASE WHEN \"planType\" = 'patient' THEN 1 END) as patientSubscriptions",
          "SUM(CASE WHEN status = 'active' THEN price ELSE 0 END) as monthlyRevenue",
        ])
        .getRawOne();

      return {
        totalSubscriptions: parseInt(analytics.totalSubscriptions),
        activeSubscriptions: parseInt(analytics.activeSubscriptions),
        expiredSubscriptions: parseInt(analytics.expiredSubscriptions),
        doctorSubscriptions: parseInt(analytics.doctorSubscriptions),
        patientSubscriptions: parseInt(analytics.patientSubscriptions),
        monthlyRevenue: parseFloat(analytics.monthlyRevenue || 0),
      };
    } catch (error) {
      console.error("❌ Error getting subscription analytics:", error);
      throw error;
    }
  }
}

module.exports = SubscriptionService;
