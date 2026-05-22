// services/NotificationService.js
const { getIO } = require("../../../config/websocket");
const NotificationRepository = require("../repositories/notificationRepository");
const cache = require("../../../shared/utils/cache");
const { isNotificationChannelEnabled } = require("../../../shared/services/adminSettingsService");

class NotificationService {
  constructor() {
    this.notificationRepository = new NotificationRepository();
  }

  async getUserNotifications(userId, filters = {}) {
    const {
      type = "all",
      isRead = "all",
      limit = 20,
      skip = 0,
    } = filters;

    let notifications = await this.notificationRepository.getUserNotifications(userId, limit, skip);

    if (type !== "all") {
      notifications = notifications.filter((n) => n.type === type);
    }

    if (isRead === "read") {
      notifications = notifications.filter((n) => n.isRead === true);
    } else if (isRead === "unread") {
      notifications = notifications.filter((n) => n.isRead === false);
    }

    return notifications;
  }

  async getNotificationCounts(userId) {
    return cache.getOrSet(
      `notifications:counts:${userId}`,
      async () => {
        const allNotifications = await this.notificationRepository.getUserNotifications(userId, 1000);
        return {
          total:                allNotifications.length,
          unread:               allNotifications.filter(n => !n.isRead).length,
          notifications:        allNotifications.filter(n => n.type === 'notification').length,
          alerts:               allNotifications.filter(n => n.type === 'alert').length,
          unreadNotifications:  allNotifications.filter(n => n.type === 'notification' && !n.isRead).length,
          unreadAlerts:         allNotifications.filter(n => n.type === 'alert' && !n.isRead).length,
        };
      },
      60
    );
  }

  /**
   * Create an in-app notification.
   *
   * @param {string}      userId
   * @param {string}      type        'notification' | 'alert'
   * @param {string}      message
   * @param {object|null} metadata
   * @param {string|null} section     admin_settings notification key (e.g. 'telemedicine').
   *                                  When provided the inApp channel toggle is checked; if
   *                                  disabled the call is a no-op and returns null.
   */
  async createNotification(userId, type, message, metadata = null, section = null) {
    // Check inApp channel toggle when a section is specified
    if (section) {
      const inAppEnabled = await isNotificationChannelEnabled(section, 'inApp');
      if (!inAppEnabled) return null;
    }

    const notification = await this.notificationRepository.createNotification(userId, type, message, metadata);

    try {
      const io = getIO();
      io.to(`user_${userId}`).emit("notification", notification);
    } catch (socketError) {
      console.error("WebSocket notification failed:", socketError.message);
    }

    await cache.del(`notifications:counts:${userId}`);
    return notification;
  }

  /**
   * Full-channel notification dispatch.
   * Checks all three channel toggles (email / sms / inApp) before dispatching.
   * Email and SMS are delegated to the callers' transports — this method only
   * gates each channel and creates the in-app notification when enabled.
   *
   * @param {object} opts
   * @param {string}      opts.userId
   * @param {string}      opts.section   admin_settings key e.g. 'telemedicine'
   * @param {string}      opts.type      'notification' | 'alert'
   * @param {string}      opts.message
   * @param {object|null} opts.metadata
   * @param {Function}    [opts.onEmail]  async fn() — called when email channel is enabled
   * @param {Function}    [opts.onSms]    async fn() — called when sms channel is enabled
   * @returns {{ inApp: boolean, email: boolean, sms: boolean }}  channels that were dispatched
   */
  async sendNotification({ userId, section, type, message, metadata = null, onEmail, onSms }) {
    const [inAppEnabled, emailEnabled, smsEnabled] = await Promise.all([
      isNotificationChannelEnabled(section, 'inApp'),
      isNotificationChannelEnabled(section, 'email'),
      isNotificationChannelEnabled(section, 'sms'),
    ]);

    const result = { inApp: false, email: false, sms: false };

    if (inAppEnabled) {
      await this.createNotification(userId, type, message, metadata);
      result.inApp = true;
    }

    if (emailEnabled && typeof onEmail === 'function') {
      try { await onEmail(); result.email = true; } catch (e) {
        console.error(`[NotificationService] email channel error (${section}):`, e.message);
      }
    }

    if (smsEnabled && typeof onSms === 'function') {
      try { await onSms(); result.sms = true; } catch (e) {
        console.error(`[NotificationService] sms channel error (${section}):`, e.message);
      }
    }

    return result;
  }

  async markAsRead(notificationId, userId) {
    const notification = await this.notificationRepository.markAsRead(notificationId);

    try {
      const io = getIO();
      io.to(`user_${userId}`).emit("notification_read", { id: notificationId, readAt: notification.readAt });
    } catch (socketError) {
      console.error("WebSocket read notification failed:", socketError.message);
    }

    await cache.del(`notifications:counts:${userId}`);
    return notification;
  }

  async markAllAsRead(userId) {
    await this.notificationRepository.markAllAsRead(userId);

    try {
      const io = getIO();
      io.to(`user_${userId}`).emit("all_notifications_read", { userId });
    } catch (socketError) {
      console.error("WebSocket mark all read failed:", socketError.message);
    }

    await cache.del(`notifications:counts:${userId}`);
  }

  async deleteNotification(notificationId, userId) {
    await this.notificationRepository.deleteNotification(notificationId);

    try {
      const io = getIO();
      io.to(`user_${userId}`).emit("notification_deleted", { id: notificationId });
    } catch (socketError) {
      console.error("WebSocket delete notification failed:", socketError.message);
    }

    await cache.del(`notifications:counts:${userId}`);
  }
}

module.exports = NotificationService;
