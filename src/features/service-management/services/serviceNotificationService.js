const AppDataSource = require("../../../config/database");
const User = require("../../auth/entities/User");
const NotificationService = require("../../notifications/services/notificationService");
const emailService = require("../../../shared/services/email/emailService");
const { getIO } = require("../../../config/websocket");

class ServiceNotificationService {
  constructor() {
    this.notificationService = new NotificationService();
    this.userRepository = AppDataSource.getRepository(User);
    this.BATCH_SIZE = 50; // Process users in batches
    this.EMAIL_DELAY_MS = 100; // Delay between emails to avoid rate limiting
  }

  /**
   * Get all active users for notifications
   */
  async getAllActiveUsers() {
    return await this.userRepository.find({
      where: {
        status: "active",
      },
      select: ["id", "email", "fullName"],
    });
  }

  /**
   * Get all users (including doctors, patients, etc.) for notifications
   */
  async getAllUsersForNotification() {
    // Get users who are not locked
    const users = await this.userRepository
      .createQueryBuilder("user")
      .select(["user.id", "user.email", "user.fullName", "user.status"])
      .where("user.status != :lockedStatus", { lockedStatus: "locked" })
      .getMany();

    return users;
  }

  /**
   * Send notification when a service goes down
   */
  async notifyServiceDown(service, countdownEnd = null, downtimeMessage = null) {
    const users = await this.getAllUsersForNotification();

    if (users.length === 0) {
      console.log("No users to notify about service downtime");
      return 0;
    }

    console.log(`Notifying ${users.length} users about ${service.name} downtime...`);

    let notificationCount = 0;
    const countdownEndFormatted = countdownEnd
      ? this._formatDateTime(new Date(countdownEnd))
      : null;

    // Broadcast via WebSocket to all connected users
    this._broadcastServiceStatus(service, "down", countdownEnd);

    // Process in batches
    for (let i = 0; i < users.length; i += this.BATCH_SIZE) {
      const batch = users.slice(i, i + this.BATCH_SIZE);

      await Promise.all(
        batch.map(async (user) => {
          try {
            // Create in-app notification
            const message = countdownEnd
              ? `${service.name} is currently unavailable. Expected to be back by ${countdownEndFormatted}.`
              : `${service.name} is currently unavailable.`;

            await this.notificationService.createNotification(
              user.id,
              "alert",
              message,
              {
                action: "service_down",
                serviceId: service.id,
                serviceKey: service.serviceKey,
                serviceName: service.name,
                countdownEnd,
                downtimeMessage,
              }
            );

            notificationCount++;
          } catch (error) {
            console.error(`Failed to notify user ${user.id}:`, error.message);
          }
        })
      );

      // Small delay between batches to prevent overwhelming the system
      if (i + this.BATCH_SIZE < users.length) {
        await this._delay(100);
      }
    }

    // Send emails in background (non-blocking)
    this._sendDowntimeEmailsAsync(users, service, countdownEnd, downtimeMessage);

    console.log(`Sent ${notificationCount} in-app notifications for service downtime`);
    return notificationCount;
  }

  /**
   * Send notification when a service comes back online
   */
  async notifyServiceBack(service) {
    const users = await this.getAllUsersForNotification();

    if (users.length === 0) {
      console.log("No users to notify about service restoration");
      return 0;
    }

    console.log(`Notifying ${users.length} users that ${service.name} is back online...`);

    let notificationCount = 0;

    // Broadcast via WebSocket to all connected users
    this._broadcastServiceStatus(service, "active", null);

    // Process in batches
    for (let i = 0; i < users.length; i += this.BATCH_SIZE) {
      const batch = users.slice(i, i + this.BATCH_SIZE);

      await Promise.all(
        batch.map(async (user) => {
          try {
            // Create in-app notification
            await this.notificationService.createNotification(
              user.id,
              "notification",
              `Great news! ${service.name} is now available.`,
              {
                action: "service_back",
                serviceId: service.id,
                serviceKey: service.serviceKey,
                serviceName: service.name,
              }
            );

            notificationCount++;
          } catch (error) {
            console.error(`Failed to notify user ${user.id}:`, error.message);
          }
        })
      );

      // Small delay between batches
      if (i + this.BATCH_SIZE < users.length) {
        await this._delay(100);
      }
    }

    // Send emails in background (non-blocking)
    this._sendServiceBackEmailsAsync(users, service);

    console.log(`Sent ${notificationCount} in-app notifications for service restoration`);
    return notificationCount;
  }

  /**
   * Send notification when countdown is extended
   */
  async notifyCountdownExtended(service, previousCountdownEnd, newCountdownEnd) {
    const users = await this.getAllUsersForNotification();

    if (users.length === 0) {
      return 0;
    }

    console.log(`Notifying ${users.length} users about extended downtime for ${service.name}...`);

    let notificationCount = 0;
    const previousFormatted = this._formatDateTime(new Date(previousCountdownEnd));
    const newFormatted = this._formatDateTime(new Date(newCountdownEnd));

    // Broadcast via WebSocket
    this._broadcastServiceStatus(service, "down", newCountdownEnd);

    // Process in batches
    for (let i = 0; i < users.length; i += this.BATCH_SIZE) {
      const batch = users.slice(i, i + this.BATCH_SIZE);

      await Promise.all(
        batch.map(async (user) => {
          try {
            await this.notificationService.createNotification(
              user.id,
              "alert",
              `${service.name} downtime has been extended. New expected availability: ${newFormatted}.`,
              {
                action: "countdown_extended",
                serviceId: service.id,
                serviceKey: service.serviceKey,
                serviceName: service.name,
                previousCountdownEnd,
                newCountdownEnd,
              }
            );

            notificationCount++;
          } catch (error) {
            console.error(`Failed to notify user ${user.id}:`, error.message);
          }
        })
      );

      if (i + this.BATCH_SIZE < users.length) {
        await this._delay(100);
      }
    }

    // Send emails in background
    this._sendCountdownExtendedEmailsAsync(users, service, previousCountdownEnd, newCountdownEnd);

    return notificationCount;
  }

  /**
   * Send notification when countdown is shortened (good news)
   */
  async notifyCountdownShortened(service, previousCountdownEnd, newCountdownEnd) {
    const users = await this.getAllUsersForNotification();

    if (users.length === 0) {
      return 0;
    }

    console.log(`Notifying ${users.length} users about shortened downtime for ${service.name}...`);

    let notificationCount = 0;
    const newFormatted = this._formatDateTime(new Date(newCountdownEnd));

    // Broadcast via WebSocket
    this._broadcastServiceStatus(service, "down", newCountdownEnd);

    // Process in batches
    for (let i = 0; i < users.length; i += this.BATCH_SIZE) {
      const batch = users.slice(i, i + this.BATCH_SIZE);

      await Promise.all(
        batch.map(async (user) => {
          try {
            await this.notificationService.createNotification(
              user.id,
              "notification",
              `Good news! ${service.name} will be available sooner than expected. New time: ${newFormatted}.`,
              {
                action: "countdown_shortened",
                serviceId: service.id,
                serviceKey: service.serviceKey,
                serviceName: service.name,
                previousCountdownEnd,
                newCountdownEnd,
              }
            );

            notificationCount++;
          } catch (error) {
            console.error(`Failed to notify user ${user.id}:`, error.message);
          }
        })
      );

      if (i + this.BATCH_SIZE < users.length) {
        await this._delay(100);
      }
    }

    return notificationCount;
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Broadcast service status change via WebSocket
   */
  _broadcastServiceStatus(service, status, countdownEnd) {
    try {
      const io = getIO();
      io.emit("service_status_change", {
        serviceId: service.id,
        serviceKey: service.serviceKey,
        serviceName: service.name,
        status,
        countdownEnd,
        timestamp: new Date().toISOString(),
      });
      console.log(`Broadcasted service status change: ${service.name} -> ${status}`);
    } catch (error) {
      console.error("Failed to broadcast service status:", error.message);
    }
  }

  /**
   * Send downtime emails asynchronously (non-blocking)
   */
  async _sendDowntimeEmailsAsync(users, service, countdownEnd, downtimeMessage) {
    // Run in background without blocking
    setImmediate(async () => {
      console.log(`Starting to send ${users.length} downtime emails for ${service.name}...`);

      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          await emailService.send(
            "service_down",
            user.email,
            `${service.name} - Service Temporarily Unavailable`,
            {
              userName: user.fullName || "Valued User",
              serviceName: service.name,
              serviceDescription: service.description,
              countdownEnd: countdownEnd
                ? this._formatDateTime(new Date(countdownEnd))
                : null,
              downtimeMessage: downtimeMessage || "We are working to restore the service as soon as possible.",
              hasCountdown: !!countdownEnd,
            }
          );
          successCount++;
        } catch (error) {
          failCount++;
          console.error(`Failed to send downtime email to ${user.email}:`, error.message);
        }

        // Rate limiting delay
        await this._delay(this.EMAIL_DELAY_MS);
      }

      console.log(`Downtime emails completed: ${successCount} sent, ${failCount} failed`);
    });
  }

  /**
   * Send service back emails asynchronously (non-blocking)
   */
  async _sendServiceBackEmailsAsync(users, service) {
    // Run in background without blocking
    setImmediate(async () => {
      console.log(`Starting to send ${users.length} service restoration emails for ${service.name}...`);

      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          await emailService.send(
            "service_back",
            user.email,
            `${service.name} - Service Restored`,
            {
              userName: user.fullName || "Valued User",
              serviceName: service.name,
              serviceDescription: service.description,
            }
          );
          successCount++;
        } catch (error) {
          failCount++;
          console.error(`Failed to send restoration email to ${user.email}:`, error.message);
        }

        // Rate limiting delay
        await this._delay(this.EMAIL_DELAY_MS);
      }

      console.log(`Restoration emails completed: ${successCount} sent, ${failCount} failed`);
    });
  }

  /**
   * Send countdown extended emails asynchronously
   */
  async _sendCountdownExtendedEmailsAsync(users, service, previousCountdownEnd, newCountdownEnd) {
    setImmediate(async () => {
      console.log(`Starting to send ${users.length} countdown extended emails for ${service.name}...`);

      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          await emailService.send(
            "service_countdown_extended",
            user.email,
            `${service.name} - Extended Maintenance Notice`,
            {
              userName: user.fullName || "Valued User",
              serviceName: service.name,
              previousCountdownEnd: this._formatDateTime(new Date(previousCountdownEnd)),
              newCountdownEnd: this._formatDateTime(new Date(newCountdownEnd)),
            }
          );
          successCount++;
        } catch (error) {
          failCount++;
          console.error(`Failed to send extended notice email to ${user.email}:`, error.message);
        }

        await this._delay(this.EMAIL_DELAY_MS);
      }

      console.log(`Extended notice emails completed: ${successCount} sent, ${failCount} failed`);
    });
  }

  /**
   * Format date time for display
   */
  _formatDateTime(date) {
    return date.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }

  /**
   * Delay utility
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new ServiceNotificationService();
