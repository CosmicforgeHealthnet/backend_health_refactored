// src/services/chat/messageService.js

const ChatMessageRepository = require("../repositories/chatMessageRepository");
const ChatParticipantRepository = require("../repositories/chatParticipantRepository");
const UserRepository = require('../../auth/repositories/userRepository');
const ChatRoomRepository = require('../repositories/chatRoomRepository');


class MessageService {
  constructor() {
    this.messageRepo = new ChatMessageRepository();
    this.participantRepo = new ChatParticipantRepository();
    this.userRepo = UserRepository;
  }

  async sendMessage(senderId, roomId, content, options = {}) {
    // Validate sender is in room
    const participant = await this.participantRepo.findActiveByUserAndRoom(senderId, roomId);

    if (!participant) {
      throw new Error('User is not a participant in this room');
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }

    if (content.length > 4000) {
      throw new Error('Message too long (max 4000 characters)');
    }

    const sender = await this.userRepo.findById(senderId);

    const messageData = {
      content: content.trim(),
      type: options.type || 'text',
      sender,
      room: { id: roomId },
      metadata: options.metadata || {}
    };

    if (options.replyToId) {
      const replyToMessage = await this.messageRepo.findById(options.replyToId);
      if (replyToMessage) {
        messageData.replyTo = replyToMessage;
      }
    }

    const message = this.messageRepo.create(messageData);
    const savedMessage = await this.messageRepo.save(message);

    // Update room's updatedAt timestamp
    const roomRepo = new ChatRoomRepository();
    await roomRepo.update(roomId, { updatedAt: new Date() });

    return await this.messageRepo.findByIdWithDetails(savedMessage.id);
  }

  async getMessages(roomId, userId, options = {}) {
    // Verify user has access to room
    const participant = await this.participantRepo.findActiveByUserAndRoom(userId, roomId);

    if (!participant) {
      throw new Error('Access denied');
    }

    const messages = await this.messageRepo.findByRoomId(roomId, options);
    return messages.reverse(); // Return in chronological order
  }

  async editMessage(messageId, userId, newContent) {
    const message = await this.messageRepo.findByIdWithDetails(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.sender.id !== userId) {
      throw new Error('Only the message author can edit this message');
    }

    if (message.deleted) {
      throw new Error('Cannot edit deleted message');
    }

    // Store edit history
    const editHistory = message.editHistory || [];
    editHistory.push({
      content: message.content,
      editedAt: message.updatedAt
    });

    console.log(editHistory);

    await this.messageRepo.update(messageId, {
      content: newContent.trim(),
      edited: true,
      editHistory
    });

    return await this.messageRepo.findByIdWithDetails(messageId);
  }

  async deleteMessage(messageId, userId, soft = true) {
    const message = await this.messageRepo.findByIdWithDetails(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    // Check permissions (author or room moderator)
    const isAuthor = message.sender.id === userId;
    const isModerator = await this.participantRepo.findByUserRoomAndRole(
      userId,
      message.room.id,
      ['admin', 'moderator']
    );

    if (!isAuthor && !isModerator) {
      throw new Error('Permission denied');
    }

    if (soft) {
      return await this.messageRepo.softDelete(messageId);
    } else {
      return await this.messageRepo.delete(messageId);
    }
  }

  async markAsRead(roomId, userId, messageId = null) {
    const participant = await this.participantRepo.findActiveByUserAndRoom(userId, roomId);

    if (!participant) {
      throw new Error('User is not a participant in this room');
    }

    if (messageId) {
      // Mark specific message as read
      const message = await this.messageRepo.findById(messageId);
      if (message) {
        const readBy = message.readBy || [];
        if (!readBy.includes(userId)) {
          readBy.push(userId);
          await this.messageRepo.update(messageId, { readBy });
        }
      }
    }

    // Update participant's last read timestamp
    await this.participantRepo.update(participant.id, { lastReadAt: new Date() });

    return true;
  }

  async getUnreadCount(roomId, userId) {
    const participant = await this.participantRepo.findActiveByUserAndRoom(userId, roomId);

    if (!participant) {
      return 0;
    }

    const lastReadAt = participant.lastReadAt || participant.joinedAt;
    return await this.messageRepo.getUnreadCount(roomId, userId, lastReadAt);
  }

  async searchMessages(roomId, userId, query, options = {}) {
    // Verify access
    const participant = await this.participantRepo.findActiveByUserAndRoom(userId, roomId);

    if (!participant) {
      throw new Error('Access denied');
    }

    return await this.messageRepo.searchInRoom(roomId, query, options);
  }
}

module.exports = MessageService;