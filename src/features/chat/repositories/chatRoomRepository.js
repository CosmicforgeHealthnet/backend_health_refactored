// src/repositories/chat/chatRoomRepository.js
const AppDataSource = require('../../../config/database');
const ChatRoom = require('../entities/ChatRoom');
const ChatParticipant = require('../entities/ChatParticipant');

class ChatRoomRepository {
    constructor() {
        this.repo = AppDataSource.getRepository(ChatRoom);
        this.participantRepo = AppDataSource.getRepository(ChatParticipant);
    }

    /** Create a new chat room */
    create(data) {
        return this.repo.create(data);
    }

    /** Save chat room */
    save(room) {
        return this.repo.save(room);
    }

    /** Find room by ID */
    findById(id) {
        return this.repo.findOne({ where: { id } });
    }

    /** Find room with details (participants, creator, etc.) */
    findByIdWithDetails(id) {
        return this.repo.findOne({
            where: { id },
            relations: [
                'participants',
                'participants.user',
                'createdBy',
            ]
        });
    }

    /** Find all rooms for a specific user */
    findByUserId(userId) {
        return this.repo
            .createQueryBuilder('room')
            .innerJoin('room.participants', 'participant', 'participant.userId = :userId AND participant.isActive = true', { userId })
            .leftJoinAndSelect('room.participants', 'allParticipants', 'allParticipants.isActive = true')
            .leftJoinAndSelect('allParticipants.user', 'user')
            .leftJoinAndSelect('room.createdBy', 'creator')
            .orderBy('room.updatedAt', 'DESC')
            .getMany();
    }

    /** Find existing direct room between two users */
    findDirectRoomBetweenUsers(user1Id, user2Id) {
        return this.repo
            .createQueryBuilder('room')
            .innerJoin('room.participants', 'p1', 'p1.user_id = :user1Id', { user1Id })
            .innerJoin('room.participants', 'p2', 'p2.user_id = :user2Id', { user2Id })
            .where('room.type = :type', { type: 'direct' })
            .getOne();
    }

    /** Find rooms by type */
    findByType(type) {
        return this.repo.find({
            where: { type },
            relations: ['participants', 'participants.user']
        });
    }

    /** Find rooms with filters */
    findWithFilters(filters = {}) {
        const queryBuilder = this.repo.createQueryBuilder('room');

        if (filters.type) {
            queryBuilder.andWhere('room.type = :type', { type: filters.type });
        }

        if (filters.isPrivate !== undefined) {
            queryBuilder.andWhere('room.isPrivate = :isPrivate', { isPrivate: filters.isPrivate });
        }

        if (filters.createdBy) {
            queryBuilder.andWhere('room.created_by_id = :createdBy', { createdBy: filters.createdBy });
        }

        return queryBuilder.getMany();
    }

    /** Update room */
    update(id, data) {
        return this.repo.update(id, data);
    }

    /** Soft delete room */
    softDelete(id) {
        return this.repo.softDelete(id);
    }

    /** Count total rooms */
    count() {
        return this.repo.count();
    }

    /** Get room statistics */
    async getRoomStats(roomId) {
        const room = await this.findById(roomId);
        if (!room) return null;

        // Count active participants
        const participantCount = await this.participantRepo.count({
            where: { room: { id: roomId }, isActive: true }
        });

        return {
            participantCount,
            createdAt: room.createdAt,
            type: room.type,
            isPrivate: room.isPrivate
        };
    }
}

module.exports = ChatRoomRepository
