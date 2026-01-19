// services/NotificationService.js
const { getIO } = require("../../../config/websocket");
const NotificationRepository = require("../repositories/notificationRepository");

class NotificationService {
  constructor() {
    this.notificationRepository = new NotificationRepository();
  }

  async getUserNotifications(userId, filters = {}) {
    const {
      type = "all", // 'all', 'notification', 'alert'
      isRead = "all", // 'all', 'read', 'unread'
      limit = 20,
      skip = 0,
    } = filters;

    let notifications = await this.notificationRepository.getUserNotifications(
      userId,
      limit,
      skip
    );

    // Filter by type
    if (type !== "all") {
      notifications = notifications.filter((n) => n.type === type);
    }

    // Filter by read status
    if (isRead === "read") {
      notifications = notifications.filter((n) => n.isRead === true);
    } else if (isRead === "unread") {
      notifications = notifications.filter((n) => n.isRead === false);
    }

    return notifications;
  }

  async getNotificationCounts(userId) {
    const allNotifications = await this.notificationRepository.getUserNotifications(userId, 1000);

    return {
      total: allNotifications.length,
      unread: allNotifications.filter(n => !n.isRead).length,
      notifications: allNotifications.filter(n => n.type === 'notification').length,
      alerts: allNotifications.filter(n => n.type === 'alert').length,
      unreadNotifications: allNotifications.filter(n => n.type === 'notification' && !n.isRead).length,
      unreadAlerts: allNotifications.filter(n => n.type === 'alert' && !n.isRead).length,
    };
  }

  async createNotification(userId, type, message, metadata = null) {
    // Save to database
    const notification = await this.notificationRepository.createNotification(
      userId,
      type,
      message,
      metadata
    );

    // Send via WebSocket
    try {
      const io = getIO();
      io.to(`user_${userId}`).emit("notification", notification);
    } catch (socketError) {
      console.error("WebSocket notification failed:", socketError.message);
    }

    return notification;
  }

  async markAsRead(notificationId, userId) {
    const notification = await this.notificationRepository.markAsRead(notificationId);

    // Emit update via WebSocket
    try {
      const io = getIO();
      io.to(`user_${userId}`).emit("notification_read", {
        id: notificationId,
        readAt: notification.readAt,
      });
    } catch (socketError) {
      console.error("WebSocket read notification failed:", socketError.message);
    }

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
  }

  async deleteNotification(notificationId, userId) {
    await this.notificationRepository.deleteNotification(notificationId);

    try {
      const io = getIO();
      io.to(`user_${userId}`).emit("notification_deleted", { id: notificationId });
    } catch (socketError) {
      console.error("WebSocket delete notification failed:", socketError.message);
    }
  }
}

module.exports = NotificationService;