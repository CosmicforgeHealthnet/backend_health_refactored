// repositories/notificationRepository.js
const AppDataSource = require("../../../config/database");
const Notification = require("../entities/Notification");

module.exports = class NotificationRepository {
  constructor() {
    this.notificationRepository = AppDataSource.getRepository(Notification);
  }

  async createNotification(userId, type, message, metadata = null) {
    const notification = this.notificationRepository.create({
      userId,
      type,
      message,
      metadata,
    });

    return await this.notificationRepository.save(notification);
  }

  async getUserNotifications(userId, limit = 20, skip = 0) {
    return await this.notificationRepository.find({
      where: { userId, isDeleted: false },
      order: { createdAt: "DESC" },
      take: limit,
      skip,
    });
  }

  async markAsRead(notificationId) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    notification.isRead = true;
    notification.readAt = new Date();
    return await this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId) {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
  }

  async deleteNotification(notificationId) {
    await this.notificationRepository.update(
      { id: notificationId },
      { isDeleted: true }
    );
  }
};
