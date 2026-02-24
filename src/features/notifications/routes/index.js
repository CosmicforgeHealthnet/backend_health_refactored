// const express = require("express");
// const NotificationController = require("../controllers/notificationController");
// const { authenticateJWT } = require("../../../shared/middlewares/authMiddleware");

// const router = express.Router();
// const notificationController = new NotificationController();

// router.get("/", authenticateJWT, (req, res) =>
//   notificationController.getNotifications(req, res)
// );
// router.put("/:id/read", authenticateJWT, (req, res) =>
//   notificationController.markAsRead(req, res)
// );
// router.put("/read-all", authenticateJWT, (req, res) =>
//   notificationController.markAllAsRead(req, res)
// );
// router.delete("/:id/delete", authenticateJWT, (req, res) =>
//   notificationController.deleteNotification(req, res)
// );

// // // WebSocket testing endpoint
// // router.post("/websocket/test-connection", authenticateJWT, (req, res) =>
// //   notificationController.testWebSocketConnection(req, res)
// // );

// module.exports = router;


// routes/notificationRoutes.js
const express = require("express");
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");
const NotificationController = require("../controllers/notificationController");

const router = express.Router();
const notificationController = new NotificationController();

// Get notifications with filtering
// Query params: type (all|notification|alert), isRead (all|read|unread), limit, skip
router.get("/", authenticateJWT, (req, res) =>
  notificationController.getNotifications(req, res)
);

// Get notification counts
router.get("/counts", authenticateJWT, (req, res) =>
  notificationController.getNotificationCounts(req, res)
);

// Mark single notification as read
router.put("/:id/read", authenticateJWT, (req, res) =>
  notificationController.markAsRead(req, res)
);

// Mark all notifications as read
router.put("/read-all", authenticateJWT, (req, res) =>
  notificationController.markAllAsRead(req, res)
);

// Delete notification
router.delete("/:id", authenticateJWT, (req, res) =>
  notificationController.deleteNotification(req, res)
);

// Create notification
router.post("/", authenticateJWT, (req, res) =>
  notificationController.createNotification(req, res)
);

module.exports = router;