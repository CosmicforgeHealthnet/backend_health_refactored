// ===================================
// src/services/timezoneService.js (Fixed Version)
// ===================================

const { fromZonedTime, toZonedTime, format } = require("date-fns-tz");
const { parseISO, isValid, parse } = require("date-fns");

class TimezoneService {
  /**
   * Get user's effective timezone
   * Priority: User saved timezone > req.location.timezone > UTC fallback
   */
  static getUserTimezone(user, req) {
    // 1. User's saved timezone preference (highest priority)
    if (user?.timezone) {
      return user.timezone;
    }

    // 2. Auto-detected timezone from location middleware
    if (req?.location?.timezone) {
      return req.location.timezone;
    }

    // 3. Fallback to UTC
    console.warn(`No timezone found for user ${user?.id}, using UTC fallback`);
    return "UTC";
  }

  /**
   * Convert appointment date + time to UTC timestamp
   * @param {string} appointmentDate - YYYY-MM-DD format
   * @param {string} appointmentTime - HH:MM format
   * @param {string} timezone - IANA timezone (e.g., 'America/New_York')
   * @returns {Date} UTC Date object
   */
  static convertToUTC(appointmentDate, appointmentTime, timezone) {
    try {
      // Normalize the date first
      const normalizedDate = this.normalizeDate(appointmentDate);

      // Create a proper date-time string for the specified timezone
      // const dateTimeString = `${normalizedDate}T${appointmentTime}:00`;
      const dateTimeString = `${normalizedDate}T${appointmentTime}`;

      // Parse as a local date first
      const localDate = parseISO(dateTimeString);

      if (!isValid(localDate)) {
        throw new Error(`Invalid date/time: ${dateTimeString}`);
      }

      // Convert to UTC using the specified timezone
      const utcDate = fromZonedTime(localDate, timezone);

      return utcDate;
    } catch (error) {

      throw new Error(`Failed to convert to UTC: ${error.message}`);
    }
  }

  /**
   * Convert UTC timestamp to local time in specified timezone
   * @param {Date|string} utcDateTime - UTC date/time
   * @param {string} timezone - Target timezone
   * @returns {object} { date: 'YYYY-MM-DD', time: 'HH:MM', dateTime: Date }
   */
  static convertFromUTC(utcDateTime, timezone) {
    try {
      const utcDate =
        typeof utcDateTime === "string" ? parseISO(utcDateTime) : utcDateTime;

      if (!isValid(utcDate)) {
        throw new Error(`Invalid UTC date: ${utcDateTime}`);
      }

      // Convert UTC to target timezone
      const zonedDate = toZonedTime(utcDate, timezone);

      return {
        date: format(zonedDate, "yyyy-MM-dd", { timeZone: timezone }),
        time: format(zonedDate, "HH:mm", { timeZone: timezone }),
        dateTime: zonedDate,
        timestamp: zonedDate.getTime(),
      };
    } catch (error) {
      throw new Error(`Failed to convert from UTC: ${error.message}`);
    }
  }

  /**
   * Format time for display with timezone context
   * @param {Date|string} utcDateTime - UTC date/time
   * @param {string} userTimezone - User's timezone
   * @param {string} otherTimezone - Other party's timezone (optional)
   * @returns {object} Formatted time info
   */
  static formatTimeForDisplay(utcDateTime, userTimezone, otherTimezone = null) {
    try {
      const userTime = this.convertFromUTC(utcDateTime, userTimezone);

      const result = {
        userTime: {
          date: userTime.date,
          time: userTime.time,
          formatted: format(userTime.dateTime, "MMM dd, yyyy 'at' h:mm a", {
            timeZone: userTimezone,
          }),
          timezone: userTimezone,
        },
      };

      // Add other party's time if provided
      if (otherTimezone && otherTimezone !== userTimezone) {
        const otherTime = this.convertFromUTC(utcDateTime, otherTimezone);
        result.otherTime = {
          date: otherTime.date,
          time: otherTime.time,
          formatted: format(otherTime.dateTime, "MMM dd, yyyy 'at' h:mm a", {
            timeZone: otherTimezone,
          }),
          timezone: otherTimezone
        };
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to format time for display: ${error.message}`);
    }
  }

  /**
   * Generate dual timezone display string
   * @param {Date|string} utcDateTime - UTC date/time
   * @param {string} primaryTimezone - Primary user's timezone
   * @param {string} secondaryTimezone - Secondary timezone
   * @param {string} primaryLabel - Label for primary timezone (e.g., "your time")
   * @param {string} secondaryLabel - Label for secondary timezone (e.g., "doctor's time")
   * @returns {string} Formatted dual timezone string
   */
  static formatDualTimezone(
    utcDateTime,
    primaryTimezone,
    secondaryTimezone,
    primaryLabel = "your time",
    secondaryLabel = "their time"
  ) {
    try {
      const primaryTime = this.convertFromUTC(utcDateTime, primaryTimezone);
      const secondaryTime = this.convertFromUTC(utcDateTime, secondaryTimezone);

      const primaryFormatted = format(primaryTime.dateTime, "h:mm a", {
        timeZone: primaryTimezone,
      });
      const secondaryFormatted = format(secondaryTime.dateTime, "h:mm a", {
        timeZone: secondaryTimezone,
      });

      if (primaryTimezone === secondaryTimezone) {
        return `${primaryFormatted}`;
      }

      return `${primaryFormatted} (${primaryLabel}) / ${secondaryFormatted} (${secondaryLabel})`;
    } catch (error) {
      console.error("Error formatting dual timezone:", error);
      return "Time unavailable";
    }
  }

  /**
   * Check if appointment time is in the past
   * @param {Date|string} utcDateTime - UTC appointment time
   * @param {string} timezone - Timezone to check against
   * @returns {boolean} True if appointment is in the past
   */
  static isAppointmentInPast(utcDateTime, timezone) {
    try {
      const utcDate =
        typeof utcDateTime === "string" ? parseISO(utcDateTime) : utcDateTime;
      const now = new Date();

      return utcDate < now;
    } catch (error) {
      console.error("Error checking if appointment is in past:", error);
      return false;
    }
  }

  /**
   * Calculate time until appointment
   * @param {Date|string} utcDateTime - UTC appointment time
   * @returns {object} Time until appointment
   */
  static getTimeUntilAppointment(utcDateTime) {
    try {
      const utcDate =
        typeof utcDateTime === "string" ? parseISO(utcDateTime) : utcDateTime;
      const now = new Date();
      const diffMs = utcDate.getTime() - now.getTime();

      if (diffMs <= 0) {
        return { isPast: true, message: "Appointment has passed" };
      }

      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        return {
          days: diffDays,
          hours: diffHours % 24,
          minutes: diffMinutes % 60,
          message: `In ${diffDays} day${diffDays > 1 ? "s" : ""}`,
        };
      } else if (diffHours > 0) {
        return {
          hours: diffHours,
          minutes: diffMinutes % 60,
          message: `In ${diffHours} hour${diffHours > 1 ? "s" : ""}`,
        };
      } else {
        return {
          minutes: diffMinutes,
          message: `In ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`,
        };
      }
    } catch (error) {
      console.error("Error calculating time until appointment:", error);
      return { error: "Unable to calculate time" };
    }
  }

  /**
   * Update user's timezone preference
   * @param {string} userId - User ID
   * @param {string} timezone - New timezone
   * @param {object} req - Request object (for detected timezone)
   */
  static async updateUserTimezone(userId, timezone, req) {
    try {
      const userRepository = require("../../auth/repositories/userRepository");

      const updateData = {
        timezone: timezone,
        lastDetectedTimezone: req?.location?.timezone,
        timezoneUpdatedAt: new Date(),
      };

      await userRepository.update(userId, updateData);

      console.log(`Updated timezone for user ${userId}: ${timezone}`);
      return { success: true, timezone };
    } catch (error) {
      console.error(`Failed to update timezone for user ${userId}:`, error);
      throw new Error(`Failed to update timezone: ${error.message}`);
    }
  }

  /**
   * Validate timezone string
   * @param {string} timezone - Timezone to validate
   * @returns {boolean} True if valid IANA timezone
   */
  static isValidTimezone(timezone) {
    try {
      if (!timezone || typeof timezone !== "string") return false;

      // Test if timezone is valid by trying to use it
      const testDate = new Date();
      format(testDate, "yyyy-MM-dd HH:mm", { timeZone: timezone });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get timezone offset in minutes
   * @param {string} timezone - IANA timezone
   * @returns {number} Offset in minutes from UTC
   */
  static getTimezoneOffset(timezone) {
    try {
      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const localTime = new Date(utcTime + this.getTimezoneOffsetMs(timezone));
      return (localTime.getTime() - utcTime) / 60000;
    } catch (error) {
      console.error("Error getting timezone offset:", error);
      return 0;
    }
  }

  /**
   * Common timezone mappings for display
   */
  static getCommonTimezones() {
    return [
      { value: "UTC", label: "UTC (Coordinated Universal Time)" },
      { value: "America/New_York", label: "Eastern Time (US)" },
      { value: "America/Chicago", label: "Central Time (US)" },
      { value: "America/Denver", label: "Mountain Time (US)" },
      { value: "America/Los_Angeles", label: "Pacific Time (US)" },
      { value: "Europe/London", label: "London (GMT/BST)" },
      { value: "Europe/Paris", label: "Paris (CET/CEST)" },
      { value: "Africa/Lagos", label: "Lagos (WAT)" },
      { value: "Africa/Cairo", label: "Cairo (EET)" },
      { value: "Asia/Tokyo", label: "Tokyo (JST)" },
      { value: "Asia/Shanghai", label: "Shanghai (CST)" },
      { value: "Asia/Kolkata", label: "India (IST)" },
      { value: "Australia/Sydney", label: "Sydney (AEDT/AEST)" },
    ];
  }

  static normalizeDate(dateStr) {
    const [year, month, day] = dateStr.split("-");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
}

module.exports = TimezoneService;
