// src/controllers/chat/chatController.js
const ChatRoomService = require('../services/chatRoomService');
const ChatMessageService = require('../services/chatMessageService');
const AppointmentChatService = require("../services/appointmentChatService");
const { USER_ROLES } = require('../../../shared/utils/constants');

class ChatController {
  constructor() {
    this.chatService = new ChatRoomService();
    this.messageService = new ChatMessageService();
    this.appointmentChatService = new AppointmentChatService();
  }

  // Room Management
  async createRoom(req, res) {
    try {
      const userId = req.user.sub;
      const roomData = req.body;

      const room = await this.chatService.createRoom(userId, roomData);

      res.status(201).json({
        success: true,
        data: room,
        message: 'Room created successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async createDirectChat(req, res) {
    try {
      const userId = req.user.sub;
      const { targetUserId } = req.body;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'Target user ID is required'
        });
      }

      const room = await this.chatService.createDirectRoom(userId, targetUserId);

      res.status(201).json({
        success: true,
        data: room,
        message: 'Direct chat created successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getUserRooms(req, res) {
    try {
      const userId = req.user.sub;
      const rooms = await this.chatService.getUserRooms(userId);

      // Add unread counts and stats
      const roomsWithUnread = await Promise.all(
        rooms.map(async (room) => {
          const unreadCount = await this.messageService.getUnreadCount(room.id, userId);
          const stats = await this.chatService.getRoomStats(room.id);
          return {
            ...room,
            unreadCount,
            ...stats
          };
        })
      );

      res.json({
        success: true,
        data: roomsWithUnread
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getRoomDetails(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.sub;

      const room = await this.chatService.getRoomWithDetails(roomId);

      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }

      // Check if user has access
      const hasAccess = room.participants.some(p => p.user.id === userId && p.isActive);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const stats = await this.chatService.getRoomStats(roomId);

      res.json({
        success: true,
        data: {
          ...room,
          ...stats
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async joinRoom(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.sub;

      await this.chatService.addParticipant(roomId, userId);

      res.json({
        success: true,
        message: 'Joined room successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async leaveRoom(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.sub;

      await this.chatService.removeParticipant(roomId, userId);

      res.json({
        success: true,
        message: 'Left room successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Message Management
  async sendMessage(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.sub;
      const { content, type, metadata, replyToId } = req.body;

      const message = await this.messageService.sendMessage(userId, roomId, content, {
        type,
        metadata,
        replyToId
      });

      // Emit to WebSocket
      const io = req.app.get('io');
      if (io) {
        io.to(roomId).emit('new_message', message);
      }

      res.status(201).json({
        success: true,
        data: message,
        message: 'Message sent successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getMessages(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.sub;
      const { limit, offset, since, until, type } = req.query;

      const messages = await this.messageService.getMessages(roomId, userId, {
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
        since,
        until,
        type
      });

      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async editMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.sub;
      const { content } = req.body;

      const message = await this.messageService.editMessage(messageId, userId, content);

      console.log(message);

      // Emit to WebSocket
      const io = req.app.get('io');
      if (io && message.room) {
        io.to(message.room.id).emit('message_edited', message);
      }

      res.json({
        success: true,
        data: message,
        message: 'Message edited successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.sub;
      const { soft = true } = req.query;

      // Get message details before deletion for WebSocket notification
      const { ChatMessageRepository } = require('../../lab/websocket/chat');
      const messageRepo = new ChatMessageRepository();
      const messageBeforeDelete = await messageRepo.findByIdWithDetails(messageId);

      await this.messageService.deleteMessage(messageId, userId, soft === 'true');

      // Emit to WebSocket
      const io = req.app.get('io');
      if (io && messageBeforeDelete && messageBeforeDelete.room) {
        io.to(messageBeforeDelete.room.id).emit('message_deleted', {
          messageId,
          roomId: messageBeforeDelete.room.id,
          soft: soft === 'true'
        });
      }

      res.json({
        success: true,
        message: 'Message deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async markAsRead(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.sub;
      const { messageId } = req.body;

      await this.messageService.markAsRead(roomId, userId, messageId);

      res.json({
        success: true,
        message: 'Marked as read'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async searchMessages(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.sub;
      const { q: query, limit, offset } = req.query;

      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const messages = await this.messageService.searchMessages(roomId, userId, query, {
        limit: parseInt(limit) || 20,
        offset: parseInt(offset) || 0
      });

      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Appointment Chat Management
  async createAppointmentChat(req, res) {
    try {
      const { appointmentId, patientId, scheduledStartTime, scheduledEndTime, settings } = req.body;
      const doctorId = req.user.sub;

      if (req.user.role !== USER_ROLES.DOCTOR) {
        return res.status(403).json({
          success: false,
          message: 'Only doctors can create appointment chats'
        });
      }

      const appointmentChat = await this.appointmentChatService.createAppointmentChat(
        appointmentId,
        doctorId,
        patientId,
        { scheduledStartTime, scheduledEndTime, settings }
      );

      res.status(201).json({
        success: true,
        data: appointmentChat,
        message: 'Appointment chat created successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getAppointmentChats(req, res) {
    try {
      const userId = req.user.sub;
      const { status } = req.query;

      const appointmentChats = await this.appointmentChatService.getUserAppointmentChats(userId, status);

      res.json({
        success: true,
        data: appointmentChats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getAppointmentChatStatus(req, res) {
    try {
      const { appointmentChatId } = req.params;
      const userId = req.user.sub;

      const status = await this.appointmentChatService.getAppointmentChatStatus(appointmentChatId);

      if (!status) {
        return res.status(404).json({
          success: false,
          message: 'Appointment chat not found'
        });
      }

      // Check access
      const hasAccess = status.doctor.id === userId || status.patient.id === userId;
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async joinAppointmentChat(req, res) {
    try {
      const { appointmentChatId } = req.params;
      const userId = req.user.sub;

      const appointmentChat = await this.appointmentChatService.startAppointmentChat(appointmentChatId, userId);

      res.json({
        success: true,
        data: appointmentChat,
        message: 'Joined appointment chat successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async endAppointmentChat(req, res) {
    try {
      const { appointmentChatId } = req.params;
      const userId = req.user.sub;

      const appointmentChat = await this.appointmentChatService.endAppointmentChat(appointmentChatId, userId);

      // Emit to WebSocket
      const io = req.app.get('io');
      if (io && appointmentChat.room) {
        io.to(appointmentChat.room.id).emit('appointment_ended', appointmentChat);
      }

      res.json({
        success: true,
        data: appointmentChat,
        message: 'Appointment chat ended successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Additional utility endpoints
  async getRoomParticipants(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.sub;

      // Check if user has access to room
      const room = await this.chatService.getRoomWithDetails(roomId);

      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }

      const hasAccess = room.participants.some(p => p.user.id === userId && p.isActive);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const participants = room.participants.filter(p => p.isActive);

      res.json({
        success: true,
        data: participants
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async updateParticipantRole(req, res) {
    try {
      const { roomId, participantId } = req.params;
      const { role } = req.body;
      const userId = req.user.sub;

      // Check if user has permission to update roles
      const hasPermission = await this.chatService.checkPermission(roomId, userId, 'edit_room');

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
      }

      await this.chatService.updateParticipantRole(roomId, participantId, role, userId);

      res.json({
        success: true,
        message: 'Participant role updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getUnreadCounts(req, res) {
    try {
      const userId = req.user.sub;
      const rooms = await this.chatService.getUserRooms(userId);

      const unreadCounts = await Promise.all(
        rooms.map(async (room) => {
          const unreadCount = await this.messageService.getUnreadCount(room.id, userId);
          return {
            roomId: room.id,
            roomName: room.name,
            unreadCount
          };
        })
      );

      const totalUnread = unreadCounts.reduce((sum, room) => sum + room.unreadCount, 0);

      res.json({
        success: true,
        data: {
          totalUnread,
          rooms: unreadCounts
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = ChatController;