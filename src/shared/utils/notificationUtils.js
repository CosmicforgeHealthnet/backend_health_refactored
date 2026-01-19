const { getIO } = require('../../config/websocket');

function getNotificationSocket() {
    return {
        /**
         * Send a notification to a specific user via WebSocket
         * @param {string} userId - The ID of the user to send to
         * @param {object} payload - The notification payload (e.g. { type, message, metadata })
         */
        sendNotificationToUser: async (userId, payload) => {
            try {
                const io = getIO();
                if (!io) {
                    console.warn('Socket.IO not initialized, skipping notification');
                    return;
                }
                // Emitting to room "user_{userId}" as per NotificationService pattern
                io.to(`user_${userId}`).emit("notification", payload);
            } catch (err) {
                console.error("Notification Socket Error:", err.message);
            }
        },

        /**
         * Send to multiple users
         */
        sendNotificationToUsers: async (userIds, payload) => {
            try {
                const io = getIO();
                if (!io) return;

                userIds.forEach(userId => {
                    io.to(`user_${userId}`).emit("notification", payload);
                });
            } catch (err) {
                console.error("Notification Socket Error:", err.message);
            }
        }
    };
}

module.exports = { getNotificationSocket };
