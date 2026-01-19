// src/repositories/chat/chatMessageRepository.js
const AppDataSource = require('../../../config/database');
const ChatMessage = require('../entities/ChatMessage');

class ChatMessageRepository {
    constructor() {
        this.repo = AppDataSource.getRepository(ChatMessage);
    }

    /** Create a new message */
    create(data) {
        return this.repo.create(data);
    }

    /** Save message */
    save(message) {
        return this.repo.save(message);
    }

    /** Find message by ID */
    findById(id) {
        return this.repo.findOne({ where: { id } });
    }

    /** Find message by ID with relations */
    findByIdWithDetails(id) {
        return this.repo.findOne({
            where: { id },
            relations: ['sender', 'room', 'replyTo', 'replyTo.sender']
        });
    }

    /** Find messages in a room with pagination */
    findByRoomId(roomId, options = {}) {
        const {
            limit = 50,
            offset = 0,
            since,
            until,
            type,
            includeDeleted = false
        } = options;

        let queryBuilder = this.repo
            .createQueryBuilder('message')
            .leftJoinAndSelect('message.sender', 'sender')
            .leftJoinAndSelect('message.replyTo', 'replyTo')
            .leftJoinAndSelect('replyTo.sender', 'replyToSender')
            .where('message.roomId = :roomId', { roomId })
            .orderBy('message.createdAt', 'DESC');

        if (!includeDeleted) {
            queryBuilder.andWhere('message.deleted = false');
        }

        if (since) {
            queryBuilder.andWhere('message.createdAt >= :since', { since });
        }

        if (until) {
            queryBuilder.andWhere('message.createdAt <= :until', { until });
        }

        if (type) {
            queryBuilder.andWhere('message.type = :type', { type });
        }

        return queryBuilder
            .skip(offset)
            .take(limit)
            .getMany();
    }

    /** Search messages in a room */
    searchInRoom(roomId, query, options = {}) {
        const { limit = 20, offset = 0 } = options;

        return this.repo
            .createQueryBuilder('message')
            .leftJoinAndSelect('message.sender', 'sender')
            .where('message.roomId = :roomId', { roomId })
            .andWhere('message.deleted = false')
            .andWhere('message.content ILIKE :query', { query: `%${query}%` })
            .orderBy('message.createdAt', 'DESC')
            .skip(offset)
            .take(limit)
            .getMany();
    }

    /** Count messages in a room */
    countByRoomId(roomId, includeDeleted = false) {
        const queryBuilder = this.repo
            .createQueryBuilder('message')
            .where('message.roomId = :roomId', { roomId });

        if (!includeDeleted) {
            queryBuilder.andWhere('message.deleted = false');
        }

        return queryBuilder.getCount();
    }

    /** Get unread message count for a user in a room */
    async getUnreadCount(roomId, userId, lastReadAt) {
        return this.repo
            .createQueryBuilder('message')
            .where('message.roomId = :roomId', { roomId })
            .andWhere('message.deleted = false')
            .andWhere('message.createdAt > :lastReadAt', { lastReadAt })
            .andWhere('message.senderId != :userId', { userId }) // Exclude own messages
            .getCount();
    }

    /** Find latest message in a room */
    findLatestByRoomId(roomId) {
        return this.repo.findOne({
            where: { room: { id: roomId }, deleted: false },
            order: { createdAt: 'DESC' },
            relations: ['sender']
        });
    }

    /** Update message */
    update(id, data) {
        return this.repo.update(id, data);
    }

    /** Delete message (hard delete) */
    delete(id) {
        return this.repo.delete(id);
    }

    /** Soft delete message */
    softDelete(id) {
        return this.repo.update(id, {
            deleted: true,
            deletedAt: new Date(),
            content: '[Message deleted]'
        });
    }

    /** Find messages by sender */
    findBySenderId(senderId, options = {}) {
        const { limit = 50, offset = 0 } = options;

        return this.repo.find({
            where: { sender: { id: senderId }, deleted: false },
            relations: ['room'],
            order: { createdAt: 'DESC' },
            skip: offset,
            take: limit
        });
    }

    /** Count total messages */
    count() {
        return this.repo.count({ where: { deleted: false } });
    }
}

module.exports = ChatMessageRepository;
