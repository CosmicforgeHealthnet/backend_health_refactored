const NotificationService = require("../services/notificationService");
const AppDataSource       = require("../../../config/database");

const PHARMACY_ROLES = new Set(["pharmacy", "pharmacist", "assistant", "dispatcher"]);

class NotificationSocketHandler {
  constructor(io) {
    this.io = io;
    this.notificationService = new NotificationService();
  }

  initialize() {
    this.io.on("connection", async (socket) => {
      // Only handle if user is authenticated (auth middleware already ran from chat handler)
      if (!socket.userId) return;

      // Auto-join the user's notification room
      const userRoom = `user_${socket.userId}`;
      socket.join(userRoom);
      console.log(`🔔 User ${socket.user?.email || socket.userId} joined notification room: ${userRoom}`);

      // Pharmacy staff join a shared pharmacy room so all staff get real-time pharmacy events
      if (PHARMACY_ROLES.has(socket.user?.role)) {
        try {
          let pharmacyProfileId = socket.user.pharmacyId; // already set for staff roles

          if (socket.user.role === "pharmacy") {
            // Owner: look up profile by userId
            const profile = await AppDataSource.getRepository("PharmacyProfile").findOne({
              where: { userId: socket.userId },
              select: ["id"],
            });
            pharmacyProfileId = profile?.id;
          }

          if (pharmacyProfileId) {
            const pharmacyRoom = `pharmacy_${pharmacyProfileId}`;
            socket.join(pharmacyRoom);
            console.log(`💊 ${socket.user?.email || socket.userId} joined pharmacy room: ${pharmacyRoom}`);
          }
        } catch (err) {
          console.error("Failed to join pharmacy room:", err.message);
        }
      }

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
