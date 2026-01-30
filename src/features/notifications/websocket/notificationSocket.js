const NotificationService = require("../services/notificationService");

class NotificationSocketHandler {
  constructor(io) {
    this.io = io;
    this.notificationService = new NotificationService();
  }

  initialize() {
    this.io.on("connection", (socket) => {
      // Only handle if user is authenticated (auth middleware already ran from chat handler)
      if (!socket.userId) return;

      // Auto-join the user's notification room
      const userRoom = `user_${socket.userId}`;
      socket.join(userRoom);
      console.log(`🔔 User ${socket.user?.email || socket.userId} joined notification room: ${userRoom}`);

      // Send connection confirmation
      socket.emit("connection-confirmed", {
        message: "Connected to notification service",
        userId: socket.userId,
        userName: socket.user?.fullName || socket.user?.email || "User",
        room: userRoom,
      });

      // Join user notification room (manual)
      socket.on("join-user-room", (userId) => {
        const room = `user_${userId}`;
        socket.join(room);
        console.log(`🔔 User ${userId} manually joined notification room: ${room}`);
        socket.emit("room-joined", {
          room,
          message: `Joined notification room: ${room}`,
        });
      });

      // Join notifications (alternative event name)
      socket.on("join_notifications", (userId) => {
        const room = `user_${userId}`;
        socket.join(room);
        socket.emit("room-joined", {
          room,
          message: `Joined notification room: ${room}`,
        });
      });

      // Leave notification room
      socket.on("leave_notifications", (userId) => {
        const room = `user_${userId}`;
        socket.leave(room);
        console.log(`🔔 User ${userId} left notification room: ${room}`);
      });

      // Mark notification as read via socket
      socket.on("mark_notification_read", async (data) => {
        try {
          const { notificationId } = data;
          await this.notificationService.markAsRead(notificationId, socket.userId);
        } catch (error) {
          console.error("Socket mark notification read error:", error);
          socket.emit("error", {
            message: "Failed to mark notification as read",
          });
        }
      });

      // Get notification counts via socket
      socket.on("get_notification_counts", async () => {
        try {
          const counts = await this.notificationService.getNotificationCounts(socket.userId);
          socket.emit("notification_counts", counts);
        } catch (error) {
          console.error("Socket get notification counts error:", error);
          socket.emit("error", {
            message: "Failed to get notification counts",
          });
        }
      });

      // Create notification via socket
      socket.on("create_notification", async (data) => {
        try {
          const { userId, type, message, metadata } = data;
          const notification = await this.notificationService.createNotification(
            userId || socket.userId,
            type || "notification",
            message,
            metadata
          );
          socket.emit("notification_created", notification);
        } catch (error) {
          console.error("Socket create notification error:", error);
          socket.emit("error", {
            message: "Failed to create notification",
          });
        }
      });

      // Ping/pong for connection health check
      socket.on("ping", () => {
        socket.emit("pong", {
          message: "pong",
          timestamp: new Date().toISOString(),
        });
      });
    });

    console.log("🔔 Notification WebSocket handler initialized");
  }
}

module.exports = NotificationSocketHandler;
