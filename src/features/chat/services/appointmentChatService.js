// src/services/chat/appointmentChatService.js
const ChatRoomRepository = require("../repositories/chatRoomRepository");
const AppointmentChatRepository = require("../repositories/appointmentChatRepository");

const ChatService = require('./chatRoomService');
const MessageService = require('./chatMessageService');

class AppointmentChatService {
  constructor() {
    this.appointmentChatRepo = new AppointmentChatRepository();
    this.roomRepo = new ChatRoomRepository();
    this.chatService = new ChatService();
    this.messageService = new MessageService();
  }

  async createAppointmentChat(appointmentId, doctorId, patientId, scheduleData) {
    const { scheduledStartTime, scheduledEndTime, settings = {} } = scheduleData;

    // Validate time
    const startTime = new Date(scheduledStartTime);
    const endTime = new Date(scheduledEndTime);

    if (startTime >= endTime) {
      throw new Error('End time must be after start time');
    }

    // 🔥 CRITICAL FIX: Check if a chat already exists for this SPECIFIC appointment
    // This prevents the "duplicate key value" crash when this method is called multiple times
    if (appointmentId) {
      const existingApptChat = await this.appointmentChatRepo.findByAppointmentId(appointmentId);
      if (existingApptChat) {
        console.log(`ℹ️ Appointment chat already exists for appointment ${appointmentId}. Returning existing.`);
        return existingApptChat;
      }
    }

    // Check for an existing chat room between this doctor and patient
    const existingAppointmentChat = await this.appointmentChatRepo.findExistingRoomByDoctorAndPatient(doctorId, patientId);

    let room;
    if (existingAppointmentChat && existingAppointmentChat.room) {
      // Reuse the existing room so all messages stay in one conversation
      room = existingAppointmentChat.room;
    } else {
      // No existing room — create a new one
      room = await this.chatService.createRoom(doctorId, {
        name: `Appointment Chat - ${startTime.toLocaleDateString()}`,
        type: 'appointment',
        isPrivate: true,
        maxParticipants: 2,
        settings: {
          ...settings,
          autoClose: true,
          timeRestricted: true
        }
      });

      // Add patient to room
      await this.chatService.addParticipant(room.id, patientId, 'member');
    }

    // Create appointment chat record (linked to the shared room)
    const appointmentChatData = {
      room,
      appointment: appointmentId ? { id: appointmentId } : null,
      doctor: { id: doctorId },
      patient: { id: patientId },
      scheduledStartTime: startTime,
      scheduledEndTime: endTime,
      autoCloseEnabled: settings.autoCloseEnabled !== false,
      preJoinAllowed: settings.preJoinAllowed || false,
      postChatDuration: settings.postChatDuration || 300,
      settings
    };

    const appointmentChat = this.appointmentChatRepo.create(appointmentChatData);
    return await this.appointmentChatRepo.save(appointmentChat);
  }

  async getAppointmentChat(appointmentChatId) {
    return await this.appointmentChatRepo.findByIdWithDetails(appointmentChatId);
  }

  async getUserAppointmentChats(userId, status = null) {
    return await this.appointmentChatRepo.findByUserId(userId, status);
  }

  async canJoinAppointmentChat(appointmentChatId, userId) {
    const appointmentChat = await this.getAppointmentChat(appointmentChatId);

    if (!appointmentChat) {
      return { canJoin: false, reason: 'Appointment chat not found' };
    }

    // Check if user is doctor or patient
    const isAuthorized = appointmentChat.doctor.id === userId ||
      appointmentChat.patient.id === userId;

    if (!isAuthorized) {
      return { canJoin: false, reason: 'Not authorized' };
    }

    const now = new Date();
    const startTime = new Date(appointmentChat.scheduledStartTime);
    const endTime = new Date(appointmentChat.scheduledEndTime);
    const postEndTime = new Date(endTime.getTime() + (appointmentChat.postChatDuration * 1000));

    // Check time restrictions
    if (!appointmentChat.preJoinAllowed && now < startTime) {
      return {
        canJoin: false,
        reason: 'Chat not yet available',
        availableAt: startTime
      };
    }

    if (now > postEndTime) {
      return {
        canJoin: false,
        reason: 'Chat session has ended'
      };
    }

    return { canJoin: true };
  }

  async startAppointmentChat(appointmentChatId, userId) {
    const appointmentChat = await this.getAppointmentChat(appointmentChatId);

    if (!appointmentChat) {
      throw new Error('Appointment chat not found');
    }

    const { canJoin, reason } = await this.canJoinAppointmentChat(appointmentChatId, userId);

    if (!canJoin) {
      throw new Error(reason);
    }

    // Update status if not already active
    if (appointmentChat.status === 'scheduled') {
      await this.appointmentChatRepo.update(appointmentChatId, {
        status: 'active',
        actualStartTime: new Date()
      });

      // Send system message
      await this.messageService.sendMessage('system', appointmentChat.room.id,
        'Appointment chat session has started', { type: 'system' });
    }

    return await this.getAppointmentChat(appointmentChatId);
  }

  async endAppointmentChat(appointmentChatId, userId) {
    const appointmentChat = await this.getAppointmentChat(appointmentChatId);

    if (!appointmentChat) {
      throw new Error('Appointment chat not found');
    }

    // Only doctor or patient can end the chat
    const canEnd = appointmentChat.doctor.id === userId ||
      appointmentChat.patient.id === userId;

    if (!canEnd) {
      throw new Error('Not authorized to end this chat');
    }

    await this.appointmentChatRepo.update(appointmentChatId, {
      status: 'completed',
      actualEndTime: new Date()
    });

    // Send system message
    await this.messageService.sendMessage('system', appointmentChat.room.id,
      'Appointment chat session has ended', { type: 'system' });

    return await this.getAppointmentChat(appointmentChatId);
  }

  async getAppointmentChatStatus(appointmentChatId) {
    const appointmentChat = await this.getAppointmentChat(appointmentChatId);

    if (!appointmentChat) {
      return null;
    }

    const now = new Date();
    const startTime = new Date(appointmentChat.scheduledStartTime);
    const endTime = new Date(appointmentChat.scheduledEndTime);
    const postEndTime = new Date(endTime.getTime() + (appointmentChat.postChatDuration * 1000));

    let timeStatus = 'before';
    if (now >= startTime && now <= endTime) {
      timeStatus = 'active';
    } else if (now > endTime && now <= postEndTime) {
      timeStatus = 'post_session';
    } else if (now > postEndTime) {
      timeStatus = 'expired';
    }

    return {
      ...appointmentChat,
      timeStatus,
      timeUntilStart: Math.max(0, startTime.getTime() - now.getTime()),
      timeUntilEnd: Math.max(0, endTime.getTime() - now.getTime()),
      timeUntilClose: Math.max(0, postEndTime.getTime() - now.getTime())
    };
  }

  // Background task to auto-close expired chats
  async closeExpiredChats() {
    const expiredChats = await this.appointmentChatRepo.findExpiredChats();

    for (const chat of expiredChats) {
      try {
        await this.appointmentChatRepo.update(chat.id, {
          status: 'completed',
          actualEndTime: new Date()
        });

        // Send system message
        await this.messageService.sendMessage('system', chat.room.id,
          'Appointment chat has been automatically closed', { type: 'system' });

        console.log(`Auto-closed appointment chat: ${chat.id}`);
      } catch (error) {
        console.error(`Error auto-closing chat ${chat.id}:`, error);
      }
    }

    return expiredChats.length;
  }
}


module.exports = AppointmentChatService;