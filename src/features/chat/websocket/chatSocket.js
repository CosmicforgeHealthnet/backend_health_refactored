// src/websocket/chatSocket.js
const jwt = require("jsonwebtoken");
const AppDataSource = require("../../../config/database");
const User = require("../../auth/entities/User");
const ChatMessage = require("../entities/ChatMessage");

const ChatRoomService = require("../services/chatRoomService");
const ChatMessageService = require("../services/chatMessageService");
const AppointmentChatService = require("../services/appointmentChatService");

class ChatSocketHandler {
  constructor(io) {
    this.io = io;
    this.chatService = new ChatRoomService();
    this.messageService = new ChatMessageService();
    this.appointmentChatService = new AppointmentChatService();
    this.userRepo = AppDataSource.getRepository(User);

    // Track online users and their socket connections
    this.onlineUsers = new Map(); // userId -> { socketId, user, status }
    this.socketUsers = new Map(); // socketId -> userId
    this.typingUsers = new Map(); // roomId -> Set of userIds
  }

  initialize() {
    // Socket authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace("Bearer ", "");

        if (!token) {
          console.log("Authentication token required");
          return next(new Error("Authentication token required"));
        }

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
          console.log("JWT verification failed:", err.message);
          return next(new Error("Invalid or expired token"));
        }

        const { sub: id } = decoded;
        const user = await this.userRepo.findOne({ where: { id } });

        if (!user) {
          return next(new Error("User not found"));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        console.log(error);
        next(new Error("Authentication failed"));
      }
    });

    // Handle connections
    this.io.on("connection", (socket) => {
      console.log(`User ${socket.user.email} connected: ${socket.id}`);
      this.handleConnection(socket);
    });

    console.log("Chat WebSocket handler initialized");
  }

  handleConnection(socket) {
    const userId = socket.userId;
    const user = socket.user;

    // Track user connection
    this.onlineUsers.set(userId, {
      socketId: socket.id,
      user,
      status: "online",
      connectedAt: new Date(),
    });
    this.socketUsers.set(socket.id, userId);

    // Update user online status
    this.updateUserOnlineStatus(userId, true);

    // Join user to their rooms
    this.joinUserRooms(socket);

    // Send initial data
    this.sendInitialData(socket);

    // Bind event handlers
    this.bindEventHandlers(socket);

    // Handle disconnection
    socket.on("disconnect", () => {
      this.handleDisconnection(socket);
    });
  }

  async joinUserRooms(socket) {
    try {
      const rooms = await this.chatService.getUserRooms(socket.userId);

      for (const room of rooms) {
        socket.join(room.id);

        // Notify other participants that user is online
        socket.to(room.id).emit("user_online", {
          userId: socket.userId,
          user: {
            id: socket.user.id,
            name: socket.user.fullName || socket.user.email,
            avatar: socket.user.profileImageId,
          },
        });
      }
    } catch (error) {
      console.error("Error joining user rooms:", error);
    }
  }

  async sendInitialData(socket) {
    try {
      // Send user's rooms with unread counts
      const rooms = await this.chatService.getUserRooms(socket.userId);
      const roomsWithData = await Promise.all(
        rooms.map(async (room) => {
          const unreadCount = await this.messageService.getUnreadCount(
            room.id,
            socket.userId
          );
          return { ...room, unreadCount };
        })
      );

      socket.emit("initial_data", {
        rooms: roomsWithData,
        user: socket.user,
      });
    } catch (error) {
      console.error("Error sending initial data:", error);
    }
  }

  bindEventHandlers(socket) {
    // Join room
    socket.on("join_room", async (data) => {
      await this.handleJoinRoom(socket, data);
    });

    // Leave room
    socket.on("leave_room", async (data) => {
      await this.handleLeaveRoom(socket, data);
    });

    // Send message
    socket.on("send_message", async (data) => {
      await this.handleSendMessage(socket, data);
    });

    // Edit message
    socket.on("edit_message", async (data) => {
      await this.handleEditMessage(socket, data);
    });

    // Delete message
    socket.on("delete_message", async (data) => {
      await this.handleDeleteMessage(socket, data);
    });

    // Typing indicators
    socket.on("typing_start", (data) => {
      this.handleTypingStart(socket, data);
    });

    socket.on("typing_stop", (data) => {
      this.handleTypingStop(socket, data);
    });

    // Mark messages as read
    socket.on("mark_read", async (data) => {
      await this.handleMarkRead(socket, data);
    });

    // Appointment chat events
    socket.on("join_appointment_chat", async (data) => {
      await this.handleJoinAppointmentChat(socket, data);
    });

    socket.on("check_appointment_status", async (data) => {
      await this.handleCheckAppointmentStatus(socket, data);
    });

    // User status updates
    socket.on("update_status", (data) => {
      this.handleUpdateStatus(socket, data);
    });

    // Error handling
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
      socket.emit("error", {
        message: "An error occurred",
        error: error.message,
      });
    });
  }

  async handleJoinRoom(socket, data) {
    try {
      const { roomId } = data;

      if (!roomId) {
        return socket.emit("error", { message: "Room ID is required" });
      }

      // Verify user has access to room
      const room = await this.chatService.getRoomWithDetails(roomId);

      if (!room) {
        return socket.emit("error", { message: "Room not found" });
      }

      const hasAccess = room.participants.some(
        (p) => p.user.id === socket.userId && p.isActive
      );

      if (!hasAccess) {
        return socket.emit("error", { message: "Access denied to room" });
      }

      // Join socket room
      socket.join(roomId);

      // Get recent messages
      const messages = await this.messageService.getMessages(
        roomId,
        socket.userId,
        { limit: 50 }
      );

      // Notify other participants
      socket.to(roomId).emit("user_joined_room", {
        userId: socket.userId,
        user: {
          id: socket.user.id,
          name: socket.user.fullName || socket.user.email,
          avatar: socket.user.profileImageId,
        },
        roomId,
      });

      // Send room data to user
      socket.emit("room_joined", {
        room,
        messages,
      });
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("error", { message: error.message });
    }
  }

  async handleLeaveRoom(socket, data) {
    try {
      const { roomId } = data;

      socket.leave(roomId);

      socket.to(roomId).emit("user_left_room", {
        userId: socket.userId,
        roomId,
      });

      socket.emit("room_left", { roomId });
    } catch (error) {
      console.error("Error leaving room:", error);
      socket.emit("error", { message: error.message });
    }
  }

  async handleSendMessage(socket, data) {
    try {
      const { roomId, content, type = "text", metadata, replyToId } = data;

      if (!roomId || !content) {
        return socket.emit("error", {
          message: "Room ID and content are required",
        });
      }

      const message = await this.messageService.sendMessage(
        socket.userId,
        roomId,
        content,
        {
          type,
          metadata,
          replyToId,
        }
      );

      // Emit to all users in room
      this.io.to(roomId).emit("new_message", message);

      // Update room timestamp for all participants
      const room = await this.chatService.getRoomWithDetails(roomId);
      if (room) {
        room.participants.forEach((participant) => {
          if (participant.user.id !== socket.userId) {
            const userSocket = this.getUserSocket(participant.user.id);
            if (userSocket) {
              userSocket.emit("room_updated", {
                roomId,
                lastMessage: message,
                updatedAt: new Date(),
              });
            }
          }
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", { message: error.message });
    }
  }

  async handleEditMessage(socket, data) {
    try {
      const { messageId, content } = data;

      const message = await this.messageService.editMessage(
        messageId,
        socket.userId,
        content
      );

      // Emit to all users in room
      this.io.to(message.room.id).emit("message_edited", message);
    } catch (error) {
      console.error("Error editing message:", error);
      socket.emit("error", { message: error.message });
    }
  }

  async handleDeleteMessage(socket, data) {
    try {
      const { messageId, soft = true } = data;

      // First get the message to find the room
      const messageRepo = AppDataSource.getRepository(ChatMessage);
      const message = await messageRepo.findOne({
        where: { id: messageId },
        relations: ["room"],
      });

      if (!message) {
        return socket.emit("error", { message: "Message not found" });
      }

      await this.messageService.deleteMessage(messageId, socket.userId, soft);

      // Emit to all users in room
      this.io.to(message.room.id).emit("message_deleted", {
        messageId,
        roomId: message.room.id,
        soft,
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      socket.emit("error", { message: error.message });
    }
  }

  handleTypingStart(socket, data) {
    try {
      const { roomId } = data;

      if (!roomId) return;

      if (!this.typingUsers.has(roomId)) {
        this.typingUsers.set(roomId, new Set());
      }

      this.typingUsers.get(roomId).add(socket.userId);

      // Notify other users in room
      socket.to(roomId).emit("user_typing", {
        userId: socket.userId,
        user: {
          id: socket.user.id,
          name: socket.user.fullName || socket.user.email,
        },
        roomId,
        isTyping: true,
      });
    } catch (error) {
      console.error("Error handling typing start:", error);
    }
  }

  handleTypingStop(socket, data) {
    try {
      const { roomId } = data;

      if (!roomId) return;

      if (this.typingUsers.has(roomId)) {
        this.typingUsers.get(roomId).delete(socket.userId);

        if (this.typingUsers.get(roomId).size === 0) {
          this.typingUsers.delete(roomId);
        }
      }

      // Notify other users in room
      socket.to(roomId).emit("user_typing", {
        userId: socket.userId,
        roomId,
        isTyping: false,
      });
    } catch (error) {
      console.error("Error handling typing stop:", error);
    }
  }

  async handleMarkRead(socket, data) {
    try {
      const { roomId, messageId } = data;

      await this.messageService.markAsRead(roomId, socket.userId, messageId);

      // Notify message sender that their message was read
      if (messageId) {
        const messageRepo = AppDataSource.getRepository(ChatMessage);
        const message = await messageRepo.findOne({
          where: { id: messageId },
          relations: ["sender"],
        });

        if (message && message.sender.id !== socket.userId) {
          const senderSocket = this.getUserSocket(message.sender.id);
          if (senderSocket) {
            senderSocket.emit("message_read", {
              messageId,
              readBy: socket.userId,
              roomId,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error marking as read:", error);
      socket.emit("error", { message: error.message });
    }
  }

  async handleJoinAppointmentChat(socket, data) {
    try {
      const { appointmentChatId } = data;

      const { canJoin, reason, availableAt } =
        await this.appointmentChatService.canJoinAppointmentChat(
          appointmentChatId,
          socket.userId
        );

      if (!canJoin) {
        return socket.emit("appointment_join_denied", {
          reason,
          availableAt,
          appointmentChatId,
        });
      }

      const appointmentChat =
        await this.appointmentChatService.startAppointmentChat(
          appointmentChatId,
          socket.userId
        );

      // Join the chat room
      socket.join(appointmentChat.room.id);

      // Notify other participant
      socket
        .to(appointmentChat.room.id)
        .emit("appointment_participant_joined", {
          userId: socket.userId,
          user: {
            id: socket.user.id,
            name: socket.user.fullName || socket.user.email,
            role: socket.user.role,
          },
          appointmentChat,
        });

      // Send confirmation to user
      socket.emit("appointment_joined", {
        appointmentChat,
        room: appointmentChat.room,
      });
    } catch (error) {
      console.error("Error joining appointment chat:", error);
      socket.emit("error", { message: error.message });
    }
  }

  async handleCheckAppointmentStatus(socket, data) {
    try {
      const { appointmentChatId } = data;

      const status = await this.appointmentChatService.getAppointmentChatStatus(
        appointmentChatId
      );

      if (!status) {
        return socket.emit("error", { message: "Appointment chat not found" });
      }

      // Check access
      const hasAccess =
        status.doctor.id === socket.userId ||
        status.patient.id === socket.userId;

      if (!hasAccess) {
        return socket.emit("error", { message: "Access denied" });
      }

      socket.emit("appointment_status", status);
    } catch (error) {
      console.error("Error checking appointment status:", error);
      socket.emit("error", { message: error.message });
    }
  }

  handleUpdateStatus(socket, data) {
    try {
      const { status } = data;
      const validStatuses = ["online", "busy", "away", "invisible"];

      if (!validStatuses.includes(status)) {
        return socket.emit("error", { message: "Invalid status" });
      }

      const userConnection = this.onlineUsers.get(socket.userId);
      if (userConnection) {
        userConnection.status = status;
      }

      // Update in database
      this.userRepo.update(socket.userId, { chatStatus: status });

      // Notify contacts/room members of status change
      this.broadcastStatusUpdate(socket.userId, status);
    } catch (error) {
      console.error("Error updating status:", error);
      socket.emit("error", { message: error.message });
    }
  }

  handleDisconnection(socket) {
    const userId = socket.userId;

    console.log(`User ${socket.user.email} disconnected: ${socket.id}`);

    // Clean up typing indicators
    for (const [roomId, typingSet] of this.typingUsers.entries()) {
      if (typingSet.has(userId)) {
        typingSet.delete(userId);
        socket.to(roomId).emit("user_typing", {
          userId,
          roomId,
          isTyping: false,
        });
      }
    }

    // Remove from online users
    this.onlineUsers.delete(userId);
    this.socketUsers.delete(socket.id);

    // Update user offline status
    this.updateUserOnlineStatus(userId, false);

    // Notify rooms that user went offline
    this.broadcastUserOffline(userId);
  }

  // Helper methods
  getUserSocket(userId) {
    const userConnection = this.onlineUsers.get(userId);
    return userConnection
      ? this.io.sockets.sockets.get(userConnection.socketId)
      : null;
  }

  async updateUserOnlineStatus(userId, isOnline) {
    try {
      await this.userRepo.update(userId, {
        isOnline,
        // lastSeenAt: new Date(),
      });
    } catch (error) {
      console.error("Error updating user online status:", error);
    }
  }

  async broadcastStatusUpdate(userId, status) {
    try {
      // Get user's rooms to notify participants
      const rooms = await this.chatService.getUserRooms(userId);

      rooms.forEach((room) => {
        this.io.to(room.id).emit("user_status_changed", {
          userId,
          status,
          timestamp: new Date(),
        });
      });
    } catch (error) {
      console.error("Error broadcasting status update:", error);
    }
  }

  async broadcastUserOffline(userId) {
    try {
      const rooms = await this.chatService.getUserRooms(userId);

      rooms.forEach((room) => {
        this.io.to(room.id).emit("user_offline", {
          userId,
          timestamp: new Date(),
        });
      });
    } catch (error) {
      console.error("Error broadcasting user offline:", error);
    }
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.onlineUsers.size;
  }

  // Get online users in a room
  async getOnlineUsersInRoom(roomId) {
    try {
      const room = await this.chatService.getRoomWithDetails(roomId);
      if (!room) return [];

      return room.participants
        .filter((p) => p.isActive && this.onlineUsers.has(p.user.id))
        .map((p) => ({
          ...p.user,
          status: this.onlineUsers.get(p.user.id)?.status || "online",
        }));
    } catch (error) {
      console.error("Error getting online users in room:", error);
      return [];
    }
  }
}

module.exports = ChatSocketHandler;
