
const ChatRoomRepository = require("../repositories/chatRoomRepository");
const ChatParticipantRepository = require("../repositories/chatParticipantRepository");


const UserRepository = require('../../auth/repositories/userRepository');

class ChatService {
  constructor() {
    this.chatRoomRepo = new ChatRoomRepository();
    this.participantRepo = new ChatParticipantRepository();
    this.userRepo = UserRepository;
  }

  // Room Management
  async createRoom(creatorId, roomData) {
    const { name, description, type = 'group', isPrivate = false, maxParticipants = 50 } = roomData;

    const creator = await this.userRepo.findById(creatorId);
    if (!creator) {
      throw new Error('Creator not found');
    }

    // Create room
    const room = this.chatRoomRepo.create({
      name,
      description,
      type,
      isPrivate,
      maxParticipants,
      createdBy: creator,
      settings: roomData.settings || {},
      metadata: roomData.metadata || {}
    });

    const savedRoom = await this.chatRoomRepo.save(room);

    // Add creator as admin participant
    await this.addParticipant(savedRoom.id, creatorId, 'admin');

    return this.getRoomWithDetails(savedRoom.id);
  }

  async createDirectRoom(user1Id, user2Id) {
    // Check if direct room already exists
    const existingRoom = await this.chatRoomRepo.findDirectRoomBetweenUsers(user1Id, user2Id);

    if (existingRoom) {
      return this.getRoomWithDetails(existingRoom.id);
    }

    // Create new direct room
    const room = this.chatRoomRepo.create({
      name: `Direct Chat`,
      type: 'direct',
      isPrivate: true,
      maxParticipants: 2
    });

    const savedRoom = await this.chatRoomRepo.save(room);

    // Add both users
    await this.addParticipant(savedRoom.id, user1Id, 'member');
    await this.addParticipant(savedRoom.id, user2Id, 'member');

    return this.getRoomWithDetails(savedRoom.id);
  }

  async getRoomWithDetails(roomId) {
    return await this.chatRoomRepo.findByIdWithDetails(roomId);
  }

  async getUserRooms(userId) {
    return await this.chatRoomRepo.findByUserId(userId);
  }

  // Participant Management
  async addParticipant(roomId, userId, role = 'member', addedById = null) {
    const room = await this.chatRoomRepo.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Check if user already in room
    const existingParticipant = await this.participantRepo.findByUserAndRoom(userId, roomId);

    if (existingParticipant) {
      if (existingParticipant.isActive) {
        throw new Error('User already in room');
      } else {
        // Reactivate participant
        existingParticipant.isActive = true;
        existingParticipant.leftAt = null;
        existingParticipant.role = role;
        return await this.participantRepo.save(existingParticipant);
      }
    }

    // Check room capacity
    const activeParticipants = await this.participantRepo.countActiveByRoomId(roomId);

    if (activeParticipants >= room.maxParticipants) {
      throw new Error('Room is full');
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const participant = this.participantRepo.create({
      user,
      room,
      role,
      addedBy: addedById ? await this.userRepo.findById(addedById) : null
    });

    return await this.participantRepo.save(participant);
  }

  async removeParticipant(roomId, userId, removedById = null) {
    const participant = await this.participantRepo.findActiveByUserAndRoom(userId, roomId);

    if (!participant) {
      throw new Error('Participant not found');
    }

    return await this.participantRepo.deactivate(userId, roomId);
  }

  async updateParticipantRole(roomId, userId, newRole, updatedById) {
    const participant = await this.participantRepo.findActiveByUserAndRoom(userId, roomId);

    if (!participant) {
      throw new Error('Participant not found');
    }

    return await this.participantRepo.update(participant.id, { role: newRole });
  }

  // Permission checking
  async checkPermission(roomId, userId, action) {
    const participant = await this.participantRepo.findActiveByUserAndRoom(userId, roomId);

    if (!participant) {
      return false;
    }

    const permissions = {
      'send_message': ['admin', 'moderator', 'member'],
      'edit_message': ['admin', 'moderator'],
      'delete_message': ['admin', 'moderator'],
      'add_participant': ['admin', 'moderator'],
      'remove_participant': ['admin', 'moderator'],
      'edit_room': ['admin']
    };

    return permissions[action]?.includes(participant.role) || false;
  }

  // Room updates
  async updateRoom(roomId, userId, updates) {
    const hasPermission = await this.checkPermission(roomId, userId, 'edit_room');
    if (!hasPermission) {
      throw new Error('Permission denied');
    }

    return await this.chatRoomRepo.update(roomId, updates);
  }

  async deleteRoom(roomId, userId) {
    const hasPermission = await this.checkPermission(roomId, userId, 'edit_room');
    if (!hasPermission) {
      throw new Error('Permission denied');
    }

    return await this.chatRoomRepo.softDelete(roomId);
  }

  // Statistics
  async getRoomStats(roomId) {
    return await this.chatRoomRepo.getRoomStats(roomId);
  }
}

module.exports = ChatService