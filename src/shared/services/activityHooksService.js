// src/services/activityHooksService.js

const UsageTrackingMiddleware = require("../../features/subscriptions/middlewares/usageTrackingMiddleware");

const UsageSummaryService = require("../../features/subscriptions/services/usageSummaryService");

class ActivityHooksService {
  /**
   * Hook for AI Chatbot interactions
   * Call this after successful AI chat response
   */
  static async onAIChatResponse(userId, messageCount = 1) {
    try {
      console.log(
        `🤖 AI Chat activity: user ${userId}, messages: ${messageCount}`
      );

      const result = await UsageTrackingMiddleware.trackUsage(
        userId,
        "aiChatbotResponses",
        messageCount
      );

      // Clear usage summary cache so next request gets fresh data
      await UsageSummaryService.clearUsageSummaryCache(userId);

      return result;
    } catch (error) {
      console.error("❌ Error tracking AI chat activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Hook for AI Diagnostic requests
   * Call this after successful diagnostic analysis
   */
  static async onAIDiagnosticRequest(userId, requestCount = 1) {
    try {
      console.log(
        `🔬 AI Diagnostic activity: user ${userId}, requests: ${requestCount}`
      );

      const result = await UsageTrackingMiddleware.trackUsage(
        userId,
        "aiDiagnosticRequests",
        requestCount
      );

      await UsageSummaryService.clearUsageSummaryCache(userId);

      return result;
    } catch (error) {
      console.error("❌ Error tracking AI diagnostic activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Hook for Video/Voice consultations
   * Call this after consultation is completed
   */
  static async onConsultationCompleted(userId, consultationType = "video") {
    try {
      console.log(
        `📹 Consultation activity: user ${userId}, type: ${consultationType}`
      );

      const result = await UsageTrackingMiddleware.trackUsage(
        userId,
        "consultations",
        1
      );

      await UsageSummaryService.clearUsageSummaryCache(userId);

      return result;
    } catch (error) {
      console.error("❌ Error tracking consultation activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Hook for Doctor AI responses (for doctors helping patients)
   * Call this when doctor uses AI assistance
   */
  static async onDoctorAIResponse(doctorId, responseCount = 1) {
    try {
      console.log(
        `👨‍⚕️ Doctor AI activity: doctor ${doctorId}, responses: ${responseCount}`
      );

      const result = await UsageTrackingMiddleware.trackUsage(
        doctorId,
        "aiResponses",
        responseCount
      );

      await UsageSummaryService.clearUsageSummaryCache(doctorId);

      return result;
    } catch (error) {
      console.error("❌ Error tracking doctor AI activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Hook for when doctor adds a new patient
   * Call this when doctor accepts/adds a new patient
   */
  static async onDoctorAddPatient(doctorId) {
    try {
      console.log(
        `👥 Doctor patient activity: doctor ${doctorId} added patient`
      );

      const result = await UsageTrackingMiddleware.trackUsage(
        doctorId,
        "maxPatients",
        1
      );

      await UsageSummaryService.clearUsageSummaryCache(doctorId);

      return result;
    } catch (error) {
      console.error("❌ Error tracking doctor patient activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Universal activity hook - handles any activity type
   * Use this for custom activities not covered above
   */
  static async onUserActivity(userId, activityType, count = 1, metadata = {}) {
    try {
      console.log(
        `📊 User activity: ${userId} performed ${activityType} x${count}`
      );

      const result = await UsageTrackingMiddleware.trackUsage(
        userId,
        activityType,
        count
      );

      await UsageSummaryService.clearUsageSummaryCache(userId);

      // Log activity for analytics (optional)
      this.logActivityForAnalytics(userId, activityType, count, metadata);

      return result;
    } catch (error) {
      console.error("❌ Error tracking user activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch activity hook - track multiple activities at once
   * Useful when one user action triggers multiple usage types
   */
  static async onBatchActivity(userId, activities) {
    try {
      console.log(`📊 Batch activity for user ${userId}:`, activities);

      const results = {};

      for (const [activityType, count] of Object.entries(activities)) {
        results[activityType] = await UsageTrackingMiddleware.trackUsage(
          userId,
          activityType,
          count
        );
      }

      await UsageSummaryService.clearUsageSummaryCache(userId);

      return { success: true, results };
    } catch (error) {
      console.error("❌ Error tracking batch activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pre-activity check - verify user can perform action before doing it
   * Call this BEFORE performing the actual action
   */
  static async checkBeforeActivity(userId, activityType, requestedCount = 1) {
    try {
      console.log(
        `🔍 Pre-check: user ${userId} wants to perform ${activityType} x${requestedCount}`
      );

      const canPerform = await UsageTrackingMiddleware.canPerformAction(
        userId,
        activityType,
        requestedCount
      );

      return canPerform;
    } catch (error) {
      console.error("❌ Error checking before activity:", error);
      return { allowed: false, error: error.message };
    }
  }

  // ========================================
  // INTEGRATION HELPERS
  // ========================================

  /**
   * Express middleware wrapper for activity hooks
   * Use this to automatically track activity in your routes
   */
  static activityHookMiddleware(activityType, count = 1) {
    return async (req, res, next) => {
      try {
        const userId = req.user?.sub || req.user?.id;

        if (!userId) {
          return next(); // Skip tracking if no user
        }

        // Store activity info in request for post-success tracking
        req.activityHook = {
          userId,
          activityType,
          count,
          service: this,
        };

        next();
      } catch (error) {
        console.error("❌ Activity hook middleware error:", error);
        next(); // Don't fail request for tracking issues
      }
    };
  }

  /**
   * Post-success middleware to track activity after API success
   * Add this as the last middleware in your route chain
   */
  static trackActivityAfterSuccess(req, res, next) {
    try {
      if (req.activityHook && res.statusCode < 400) {
        const { userId, activityType, count, service } = req.activityHook;

        // Track activity (don't await to avoid slowing response)
        service.onUserActivity(userId, activityType, count).catch((error) => {
          console.error("❌ Post-success activity tracking failed:", error);
        });
      }

      next();
    } catch (error) {
      console.error("❌ Post-success activity middleware error:", error);
      next();
    }
  }

  // ========================================
  // CONTROLLER HELPERS
  // ========================================

  /**
   * Helper for controllers to easily track activity
   * Use this in your existing controllers
   */
  static async trackInController(req, activityType, count = 1) {
    try {
      const userId = req.user?.sub || req.user?.id;

      if (!userId) {
        console.warn("⚠️ No user ID found for activity tracking");
        return { success: false, reason: "No user ID" };
      }

      return await this.onUserActivity(userId, activityType, count);
    } catch (error) {
      console.error("❌ Error tracking in controller:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper to check and track in one call
   * Perfect for controller use
   */
  static async checkAndTrack(req, activityType, count = 1) {
    try {
      const userId = req.user?.sub || req.user?.id;

      if (!userId) {
        return { allowed: false, reason: "No user ID" };
      }

      // Check first
      const canPerform = await this.checkBeforeActivity(
        userId,
        activityType,
        count
      );

      if (!canPerform.allowed) {
        return canPerform; // Return the denial reason
      }

      // If allowed, track the activity
      const trackResult = await this.onUserActivity(
        userId,
        activityType,
        count
      );

      return {
        allowed: true,
        tracked: trackResult.success,
        usage: trackResult,
      };
    } catch (error) {
      console.error("❌ Error in check and track:", error);
      return { allowed: false, error: error.message };
    }
  }

  // ========================================
  // ANALYTICS & LOGGING
  // ========================================

  /**
   * Log activity for analytics (optional)
   */
  static logActivityForAnalytics(userId, activityType, count, metadata) {
    // This is where you could send data to analytics services
    // For now, just log to console
    console.log(
      `📈 Analytics: User ${userId} - ${activityType} x${count}`,
      metadata
    );

    // TODO: Integrate with your analytics service
    // analytics.track(userId, activityType, { count, ...metadata });
  }

  /**
   * Get activity summary for admin/analytics
   */
  static async getActivitySummary(timeframe = "24h") {
    // This would require storing activity logs
    // For now, return placeholder
    return {
      timeframe,
      totalActivities: 0,
      byType: {},
      message: "Activity analytics not implemented yet",
    };
  }
}

module.exports = ActivityHooksService;
