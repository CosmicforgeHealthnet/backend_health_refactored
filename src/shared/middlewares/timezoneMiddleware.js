// ===================================
// src/middlewares/timezoneMiddleware.js
// ===================================

const userRepository = require('../../features/auth/repositories/userRepository');
const TimezoneService = require('../../features/compliance/services/timezoneService');

class TimezoneMiddleware {
  /**
   * Middleware to ensure timezone context is available for appointment operations
   */
  static async ensureTimezoneContext(req, res, next) {
    try {
      // If user is authenticated, try to get their timezone preference
      if (req.user?.sub) {
        const user = await userRepository.findById(req.user.sub);

        // Update user's detected timezone if it changed
        if (req.location?.timezone && req.location.timezone !== user.lastDetectedTimezone) {
          await TimezoneService.updateUserTimezone(req.user.sub, user.timezone, req);
        }

        // Add effective timezone to request
        req.userTimezone = TimezoneService.getUserTimezone(user, req);
        req.userTimezoneData = {
          preferred: user.timezone,
          detected: req.location?.timezone,
          effective: req.userTimezone
        };
      } else {
        // For unauthenticated requests, use detected timezone
        req.userTimezone = req.location?.timezone || 'UTC';
        req.userTimezoneData = {
          preferred: null,
          detected: req.location?.timezone,
          effective: req.userTimezone
        };
      }

      console.log(`Timezone context for user ${req.user?.sub}:`, req.userTimezoneData);
      next();
    } catch (error) {
      console.error('Error in timezone middleware:', error);
      // Don't fail the request, just set fallback
      req.userTimezone = 'UTC';
      req.userTimezoneData = {
        preferred: null,
        detected: null,
        effective: 'UTC',
        error: error.message
      };
      next();
    }
  }

  /**
   * Middleware to validate timezone data in appointment requests
   */
  static validateAppointmentTimezone(req, res, next) {
    try {
      const { appointmentDate, appointmentTime, timezone } = req.body;

      // Validate date and time format
      if (!appointmentDate || !appointmentTime) {
        return res.status(400).json({
          success: false,
          error: 'Appointment date and time are required'
        });
      }

      // Validate timezone if provided
      if (timezone && !TimezoneService.isValidTimezone(timezone)) {
        return res.status(400).json({
          success: false,
          error: `Invalid timezone: ${timezone}`
        });
      }

      // Use provided timezone or fall back to user's timezone
      req.appointmentTimezone = timezone || req.userTimezone;

      next();
    } catch (error) {
      console.error('Error validating appointment timezone:', error);
      res.status(400).json({
        success: false,
        error: 'Timezone validation failed'
      });
    }
  }

  /**
   * Middleware to add timezone info to appointment responses
   */
  static addTimezoneToResponse(req, res, next) {
    const originalJson = res.json;

    res.json = function (data) {
      // Add timezone context to successful responses
      if (data && typeof data === 'object' && data.success !== false) {
        data.timezoneContext = {
          userTimezone: req.userTimezone,
          detectedTimezone: req.location?.timezone,
          serverTime: new Date().toISOString()
        };
      }

      return originalJson.call(this, data);
    };

    next();
  }
}

module.exports = TimezoneMiddleware;