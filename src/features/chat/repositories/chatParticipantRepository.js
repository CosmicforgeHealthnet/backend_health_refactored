// src/repositories/chat/chatParticipantRepository.js
const { In } = require('typeorm');
const AppDataSource = require('../../../config/database');
const ChatParticipant = require('../entities/ChatParticipant');

class ChatParticipantRepository {
    constructor() {
        this.repo = AppDataSource.getRepository(ChatParticipant);
    }

    /** Create a new participant */
    create(data) {
        return this.repo.create(data);
    }

    /** Save participant */
    save(participant) {
        return this.repo.save(participant);
    }

    /** Find participant by ID */
    findById(id) {
        return this.repo.findOne({ where: { id } });
    }

    /** Find participant by user and room */
    findByUserAndRoom(userId, roomId) {
        return this.repo.findOne({
            where: { user: { id: userId }, room: { id: roomId } },
            relations: ['user', 'room']
        });
    }

    /** Find active participant by user and room */
    findActiveByUserAndRoom(userId, roomId) {
        return this.repo.findOne({
            where: {
                user: { id: userId },
                room: { id: roomId },
                isActive: true
            },
            relations: ['user', 'room']
        });
    }

    /** Find all participants in a room */
    findByRoomId(roomId, activeOnly = true) {
        const where = { room: { id: roomId } };
        if (activeOnly) {
            where.isActive = true;
        }

        return this.repo.find({
            where,
            relations: ['user'],
            order: { joinedAt: 'ASC' }
        });
    }

    /** Find all rooms for a user */
    findByUserId(userId, activeOnly = true) {
        const where = { user: { id: userId } };
        if (activeOnly) {
            where.isActive = true;
        }

        return this.repo.find({
            where,
            relations: ['room'],
            order: { joinedAt: 'DESC' }
        });
    }

    /** Count active participants in a room */
    countActiveByRoomId(roomId) {
        return this.repo.count({
            where: { room: { id: roomId }, isActive: true }
        });
    }

    /** Check if user has specific role in room */
    findByUserRoomAndRole(userId, roomId, roles) {
        const rolesArray = Array.isArray(roles) ? roles : [roles];

        return this.repo.findOne({
            where: {
                user: { id: userId },
                room: { id: roomId },
                role: In(rolesArray),
                isActive: true
            }
        });
    }

    /** Update participant */
    update(id, data) {
        return this.repo.update(id, data);
    }

    /** Update participant by user and room */
    updateByUserAndRoom(userId, roomId, data) {
        return this.repo.update(
            { user: { id: userId }, room: { id: roomId } },
            data
        );
    }

    /** Deactivate participant (leave room) */
    deactivate(userId, roomId) {
        return this.repo.update(
            { user: { id: userId }, room: { id: roomId } },
            { isActive: false, leftAt: new Date() }
        );
    }

    /** Delete participant */
    delete(id) {
        return this.repo.delete(id);
    }

    /** Get participant statistics */
    async getParticipantStats(userId) {
        const totalRooms = await this.repo.count({
            where: { user: { id: userId } }
        });

        const activeRooms = await this.repo.count({
            where: { user: { id: userId }, isActive: true }
        });

        return {
            totalRooms,
            activeRooms
        };
    }
}


module.exports = ChatParticipantRepository;
