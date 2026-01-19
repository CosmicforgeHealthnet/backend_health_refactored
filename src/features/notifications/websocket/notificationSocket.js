// socket/notificationHandlers.js (optional)
// Add these to your existing socket connection handler

const NotificationService = require("../services/notificationSocketService");


function setupNotificationHandlers(socket) {
  const notificationService = new NotificationService();

  // Join user notification room
  socket.on("join_notifications", (userId) => {
    console.log(`User ${userId} joined notification room`);
    socket.join(`user_${userId}`);
  });

  // Leave user notification room
  socket.on("leave_notifications", (userId) => {
    console.log(`User ${userId} left notification room`);
    socket.leave(`user_${userId}`);
  });

  // Mark notification as read via socket
  socket.on("mark_notification_read", async (data) => {
    try {
      const { notificationId, userId } = data;
      await notificationService.markAsRead(notificationId, userId);
    } catch (error) {
      console.error("Socket mark notification read error:", error);
      socket.emit("notification_error", {
        message: "Failed to mark notification as read",
      });
    }
  });

  // Get notification counts via socket
  socket.on("get_notification_counts", async (userId) => {
    try {
      const counts = await notificationService.getNotificationCounts(userId);
      socket.emit("notification_counts", counts);
    } catch (error) {
      console.error("Socket get notification counts error:", error);
      socket.emit("notification_error", {
        message: "Failed to get notification counts",
      });
    }
  });
}

module.exports = {
  setupNotificationHandlers,
};

// To integrate with your existing socket setup:
// In your main socket file:
//
// const { setupNotificationHandlers } = require("./socket/notificationHandlers");
//
// io.on("connection", (socket) => {
//   setupNotificationHandlers(socket);
//   // ... your other socket handlers
// });
