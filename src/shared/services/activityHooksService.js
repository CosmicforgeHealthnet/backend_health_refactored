// src/services/activityHooksService.js
/**
 * =============================================================================
 * ACTIVITY HOOKS SERVICE
 * =============================================================================
 *
 * PURPOSE:
 * Provides hooks to manually track usage in controllers and services.
 * For routes, prefer using requireUsage middleware instead.
 *
 * WHEN TO USE:
 * - In controllers where you need manual tracking
 * - In services that process background jobs
 * - When you can't use middleware (e.g., WebSocket handlers)
 *
 * USAGE TYPES:
 * - Patient: aiChatbotResponses, aiDiagnosticRequests
 * - Doctor: maxPatients, aiResponses
 *
 * EXAMPLE:
 *   // Track after successful AI response
 *   await ActivityHooksService.onAIChatResponse(userId);
 *
 *   // Check before action
 *   const canUse = await ActivityHooksService.checkBeforeActivity(userId, 'aiChatbotResponses');
 *   if (!canUse.allowed) return res.status(429).json({ error: 'Limit exceeded' });
 *
 * =============================================================================
 */

const usageService = require("../../features/subscriptions/services/usageService");

class ActivityHooksService {
  /**
   * Hook for AI Chatbot interactions
   * Call this after successful AI chat response
   *
   * @param {string} userId - User ID
   * @param {number} messageCount - Number of messages (default: 1)
   * @returns {Promise<Object>} Tracking result with usage info
   */
  static async onAIChatResponse(userId, messageCount = 1) {
    try {
      console.log(`AI Chat: user ${userId}, messages: ${messageCount}`);
      return await usageService.consume(userId, "aiChatbotResponses", messageCount);
    } catch (error) {
      console.error("Error tracking AI chat activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Hook for AI Diagnostic requests
   * Call this after successful diagnostic analysis
   *
   * @param {string} userId - User ID
   * @param {number} requestCount - Number of requests (default: 1)
   */
  static async onAIDiagnosticRequest(userId, requestCount = 1) {
    try {
      console.log(`AI Diagnostic: user ${userId}, requests: ${requestCount}`);
      return await usageService.consume(userId, "aiDiagnosticRequests", requestCount);
    } catch (error) {
      console.error("Error tracking AI diagnostic activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Hook for Video/Voice consultations
   * Call this after consultation is completed
   *
   * @param {string} userId - User ID
   * @param {string} consultationType - Type of consultation (video/voice)
   */
  static async onConsultationCompleted(userId, consultationType = "video") {
    try {
      console.log(`Consultation: user ${userId}, type: ${consultationType}`);
      return await usageService.consume(userId, "consultations", 1);
    } catch (error) {
      console.error("Error tracking consultation activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Hook for Doctor AI responses (for doctors helping patients)
   * Call this when doctor uses AI assistance
   *
   * @param {string} doctorId - Doctor's user ID
   * @param {number} responseCount - Number of AI responses (default: 1)
   */
  static async onDoctorAIResponse(doctorId, responseCount = 1) {
    try {
      console.log(`Doctor AI: doctor ${doctorId}, responses: ${responseCount}`);
      return await usageService.consume(doctorId, "aiResponses", responseCount);
    } catch (error) {
      console.error("Error tracking doctor AI activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Hook for when doctor adds a new patient
   * Call this when doctor accepts/adds a new patient
   *
   * @param {string} doctorId - Doctor's user ID
   */
  static async onDoctorAddPatient(doctorId) {
    try {
      console.log(`Doctor patient: doctor ${doctorId} added patient`);
      return await usageService.consume(doctorId, "maxPatients", 1);
    } catch (error) {
      console.error("Error tracking doctor patient activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Universal activity hook - handles any activity type
   * Use this for custom activities not covered above
   *
   * @param {string} userId - User ID
   * @param {string} activityType - The usage type to track
   * @param {number} count - Amount to consume (default: 1)
   * @param {Object} metadata - Optional metadata for analytics
   */
  static async onUserActivity(userId, activityType, count = 1, metadata = {}) {
    try {
      console.log(`User activity: ${userId} performed ${activityType} x${count}`);

      const result = await usageService.consume(userId, activityType, count);

      // Log for analytics if metadata provided
      if (Object.keys(metadata).length > 0) {
        this.logActivityForAnalytics(userId, activityType, count, metadata);
      }

      return result;
    } catch (error) {
      console.error("Error tracking user activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch activity hook - track multiple activities at once
   * Useful when one user action triggers multiple usage types
   *
   * @param {string} userId - User ID
   * @param {Object} activities - Map of activityType -> count
   */
  static async onBatchActivity(userId, activities) {
    try {
      console.log(`Batch activity for user ${userId}:`, activities);
      return await usageService.consumeMultiple(userId, activities);
    } catch (error) {
      console.error("Error tracking batch activity:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pre-activity check - verify user can perform action before doing it
   * Call this BEFORE performing the actual action
   *
   * @param {string} userId - User ID
   * @param {string} activityType - The usage type to check
   * @param {number} requestedCount - Amount to check (default: 1)
   * @returns {Promise<Object>} Object with allowed:boolean and usage details
   */
  static async checkBeforeActivity(userId, activityType, requestedCount = 1) {
    try {
      console.log(`Pre-check: user ${userId} for ${activityType} x${requestedCount}`);
      return await usageService.canConsumeDetailed(userId, activityType, requestedCount);
    } catch (error) {
      console.error("Error checking before activity:", error);
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
