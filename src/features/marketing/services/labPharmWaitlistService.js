// src/services/labWaitlistService.js
const labWaitlistRepository = require("../repositories/labPharmWaitlistRepository");
const { WAITLIST_STATUS } = require("../../pharmacy/entities/LabPharmWaitlist");
const {
  sendLabWaitlistConfirmationEmail,
  sendLabWaitlistLaunchNotificationEmail,
  sendAdminWaitlistNotificationEmail,
  sendPharmWaitlistConfirmationEmail
} = require("../../../shared/services/email/helper/lab");

class LabWaitlistService {
  /**
   * Join the lab registration waitlist
   */
  async joinWaitlist(waitlistData) {
    // Validate required fields
    this.validateWaitlistData(waitlistData);

    // Check if email already exists in waitlist
    const existingEntry = await labWaitlistRepository.findByEmail(waitlistData.email);
    if (existingEntry) {
      throw new Error("Email already registered in waitlist");
    }

    // Create waitlist entry
    const waitlistEntry = labWaitlistRepository.create({
      ...waitlistData,
      status: WAITLIST_STATUS.PENDING,
      emailSent: false,
      launchNotificationSent: false,
    });

    const savedEntry = await labWaitlistRepository.save(waitlistEntry);

    // Send confirmation email
    try {

      if (waitlistData.role == "lab") {
        await sendLabWaitlistConfirmationEmail(savedEntry);
      } else {
        await sendPharmWaitlistConfirmationEmail(savedEntry);
      }
      await labWaitlistRepository.markEmailSent(savedEntry.id);
    } catch (emailError) {
      console.error("Failed to send waitlist confirmation email:", emailError);
      // Don't throw error - waitlist entry was still created successfully
    }

    // Notify admin about new waitlist entry
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await sendAdminWaitlistNotificationEmail(adminEmail, savedEntry);
      }
    } catch (emailError) {
      console.error("Failed to send admin waitlist notification:", emailError);
    }

    return savedEntry;
  }

  /**
   * Get waitlist entry by ID
   */
  async getWaitlistEntryById(id) {
    const entry = await labWaitlistRepository.findById(id);
    if (!entry) {
      throw new Error("Waitlist entry not found");
    }
    return entry;
  }

  /**
   * Get all waitlist entries (admin only)
   */
  async getAllWaitlistEntries(options = {}) {
    return labWaitlistRepository.findAll(options);
  }

  /**
   * Search waitlist entries (admin only)
   */
  async searchWaitlist(query) {
    if (!query || query.length < 2) {
      throw new Error("Search query must be at least 2 characters");
    }
    return labWaitlistRepository.searchWaitlist(query);
  }

  /**
   * Update waitlist entry status (admin only)
   */
  async updateWaitlistStatus(entryId, status, adminNotes = null) {
    const entry = await labWaitlistRepository.findById(entryId);
    if (!entry) {
      throw new Error("Waitlist entry not found");
    }

    // Validate status
    if (!Object.values(WAITLIST_STATUS).includes(status)) {
      throw new Error("Invalid status");
    }

    await labWaitlistRepository.updateStatus(entryId, status, adminNotes);
    return this.getWaitlistEntryById(entryId);
  }

  /**
   * Send launch notification to all pending waitlist entries
   */
  async sendLaunchNotifications() {
    const pendingEntries = await labWaitlistRepository.findPendingLaunchNotifications();

    const results = {
      total: pendingEntries.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const entry of pendingEntries) {
      try {
        await sendLabWaitlistLaunchNotificationEmail(entry);
        await labWaitlistRepository.markLaunchNotificationSent(entry.id);
        results.successful++;
      } catch (error) {
        console.error(`Failed to send launch notification to ${entry.email}:`, error);
        results.failed++;
        results.errors.push({
          email: entry.email,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Send launch notification to specific waitlist entry
   */
  async sendLaunchNotificationToEntry(entryId) {
    const entry = await labWaitlistRepository.findById(entryId);
    if (!entry) {
      throw new Error("Waitlist entry not found");
    }

    if (entry.launchNotificationSent) {
      throw new Error("Launch notification already sent to this entry");
    }

    await sendLabWaitlistLaunchNotificationEmail(entry);
    await labWaitlistRepository.markLaunchNotificationSent(entryId);

    return this.getWaitlistEntryById(entryId);
  }

  /**
   * Get waitlist statistics
   */
  async getWaitlistStats() {
    const [statusCounts, totalCount, recentEntries] = await Promise.all([
      labWaitlistRepository.getWaitlistStats(),
      labWaitlistRepository.getTotalCount(),
      labWaitlistRepository.findRecentRegistrations(5)
    ]);

    return {
      statusCounts,
      totalCount,
      recentEntries,
      pendingNotifications: await labWaitlistRepository.getCountByStatus(WAITLIST_STATUS.PENDING)
    };
  }

  /**
   * Get waitlist entries by location
   */
  async getWaitlistByLocation(city, state) {
    return labWaitlistRepository.findByLocation(city, state);
  }

  /**
   * Get recent waitlist registrations
   */
  async getRecentRegistrations(limit = 10) {
    return labWaitlistRepository.findRecentRegistrations(limit);
  }

  /**
   * Check if email exists in waitlist
   */
  async checkEmailExists(email) {
    const entry = await labWaitlistRepository.findByEmail(email);
    return !!entry;
  }

  /**
   * Validate waitlist data
   */
  validateWaitlistData(data) {
    const required = ["fullName", "email", "facilityName"];

    for (const field of required) {
      if (!data[field] || data[field].toString().trim() === "") {
        throw new Error(`${field} is required`);
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error("Invalid email format");
    }

    // Validate name length
    if (data.fullName.length < 2) {
      throw new Error("Full name must be at least 2 characters");
    }

    // Validate facility name length
    if (data.facilityName.length < 2) {
      throw new Error("Facility name must be at least 2 characters");
    }

    // Validate phone if provided
    if (data.phone && data.phone.length < 7) {
      throw new Error("Phone number must be at least 7 characters");
    }
  }

  /**
   * Cleanup old declined entries
   */
  async cleanupOldEntries(olderThanDays = 365) {
    return labWaitlistRepository.deleteOldEntries(olderThanDays);
  }
}

module.exports = new LabWaitlistService();