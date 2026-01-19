const NotificationService = require("../services/notificationService");

class NotificationController {
  constructor() {
    this.notificationService = new NotificationService();
  }

  async getNotifications(req, res) {
    try {
      const userId = req.user.id || req.user.sub;
      const { type, isRead, limit, skip } = req.query;

      const filters = {
        type: type || "all",
        isRead: isRead || "all",
        limit: parseInt(limit) || 20,
        skip: parseInt(skip) || 0,
      };

      const notifications = await this.notificationService.getUserNotifications(
        userId,
        filters
      );

      const counts = await this.notificationService.getNotificationCounts(userId);

      res.json({
        success: true,
        data: {
          notifications,
          counts,
          pagination: {
            limit: filters.limit,
            skip: filters.skip,
            total: notifications.length,
          },
        },
      });
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getNotificationCounts(req, res) {
    try {
      const userId = req.user.id || req.user.sub;
      const counts = await this.notificationService.getNotificationCounts(userId);

      res.json({
        success: true,
        data: counts,
      });
    } catch (error) {
      console.error("Get notification counts error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async markAsRead(req, res) {
    try {
      const userId = req.user.id || req.user.sub;
      const { id } = req.params;

      const notification = await this.notificationService.markAsRead(id, userId);

      res.json({
        success: true,
        message: "Notification marked as read",
        data: notification,
      });
    } catch (error) {
      console.error("Mark as read error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id || req.user.sub;

      await this.notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      console.error("Mark all as read error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteNotification(req, res) {
    try {
      const userId = req.user.id || req.user.sub;
      const { id } = req.params;

      await this.notificationService.deleteNotification(id, userId);

      res.json({
        success: true,
        message: "Notification deleted successfully",
      });
    } catch (error) {
      console.error("Delete notification error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async createNotification(req, res) {
    try {
      const { userId, type, message, metadata } = req.body;

      if (!userId || !type || !message) {
        return res.status(400).json({
          success: false,
          message: "userId, type, and message are required",
        });
      }

      const notification = await this.notificationService.createNotification(
        userId,
        type,
        message,
        metadata
      );

      res.status(201).json({
        success: true,
        message: "Notification created successfully",
        data: notification,
      });
    } catch (error) {
      console.error("Create notification error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = NotificationController;