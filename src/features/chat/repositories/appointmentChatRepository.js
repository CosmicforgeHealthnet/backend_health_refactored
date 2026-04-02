// src/repositories/chat/appointmentChatRepository.js
const AppDataSource = require("../../../config/database");
const AppointmentChat = require("../entities/AppointmentChat");

class AppointmentChatRepository {
    constructor() {
        this.repo = AppDataSource.getRepository(AppointmentChat);
    }

    /** Create a new appointment chat */
    create(data) {
        return this.repo.create(data);
    }

    /** Save appointment chat */
    save(appointmentChat) {
        return this.repo.save(appointmentChat);
    }

    /** Find appointment chat by ID */
    findById(id) {
        return this.repo.findOne({
            where: { id },
            relations: [
                "room",
                "room.participants",
                "room.participants.user",
                "doctor",
                "patient",
                "appointment"
            ],
        });
    }

    /** Find appointment chat by ID with relations */
    findByIdWithDetails(id) {
        return this.repo.findOne({
            where: { id },
            relations: [
                "room",
                "room.participants",
                "room.participants.user",
                "doctor",
                "patient",
                "appointment",
            ],
        });
    }

    /** Find appointment chats by user ID */
    findByUserId(userId, status = null) {
        let queryBuilder = this.repo
            .createQueryBuilder("ac")
            .leftJoinAndSelect("ac.room", "room")
            .leftJoinAndSelect("ac.doctor", "doctor")
            .leftJoinAndSelect("ac.patient", "patient")
            .where("ac.doctorId = :userId OR ac.patientId = :userId", { userId });

        if (status) {
            queryBuilder.andWhere("ac.status = :status", { status });
        }

        return queryBuilder.orderBy("ac.scheduledStartTime", "DESC").getMany();
    }

    /** Find active appointment chats */
    findActiveAppointments() {
        const now = new Date();
        return this.repo
            .createQueryBuilder("ac")
            .where("ac.status IN (:...statuses)", {
                statuses: ["scheduled", "active"],
            })
            .andWhere("ac.scheduledStartTime <= :now", { now })
            .andWhere("ac.scheduledEndTime >= :now", { now })
            .getMany();
    }

    /** Find expired appointment chats that need to be closed */
    findExpiredChats() {
        return this.repo
            .createQueryBuilder("ac")
            .where("ac.status IN (:...statuses)", {
                statuses: ["scheduled", "active"],
            })
            .andWhere("ac.autoCloseEnabled = true")
            .andWhere(
                "ac.scheduledEndTime + INTERVAL ac.postChatDuration SECOND < NOW()"
            )
            .getMany();
    }

    /** Find appointment chat by room ID */
    findByRoomId(roomId) {
        return this.repo.findOne({
            where: { room: { id: roomId } },
            relations: ["doctor", "patient", "room"],
        });
    }

    /** Find upcoming appointment chats for a user */
    findUpcomingByUserId(userId) {
        const now = new Date();
        return this.repo
            .createQueryBuilder("ac")
            .leftJoinAndSelect("ac.room", "room")
            .leftJoinAndSelect("ac.doctor", "doctor")
            .leftJoinAndSelect("ac.patient", "patient")
            .where("(ac.doctorId = :userId OR ac.patientId = :userId)", { userId })
            .andWhere("ac.status = :status", { status: "scheduled" })
            .andWhere("ac.scheduledStartTime > :now", { now })
            .orderBy("ac.scheduledStartTime", "ASC")
            .getMany();
    }

    /** Update appointment chat */
    update(id, data) {
        return this.repo.update(id, data);
    }

    /** Update appointment chat status */
    updateStatus(id, status) {
        return this.repo.update(id, { status });
    }

    /** Find an existing appointment chat room between a doctor and patient */
    findExistingRoomByDoctorAndPatient(doctorId, patientId) {
        return this.repo
            .createQueryBuilder("ac")
            .leftJoinAndSelect("ac.room", "room")
            .where("ac.doctorId = :doctorId", { doctorId })
            .andWhere("ac.patientId = :patientId", { patientId })
            .andWhere("ac.status != :cancelled", { cancelled: "cancelled" })
            .andWhere("room.deletedAt IS NULL")
            .orderBy("ac.createdAt", "DESC")
            .getOne();
    }

    /** Delete appointment chat */
    delete(id) {
        return this.repo.delete(id);
    }

    /** Count appointment chats by status */
    countByStatus(status) {
        return this.repo.count({ where: { status } });
    }

    /** Get appointment chat statistics */
    async getAppointmentStats() {
        const total = await this.repo.count();
        const scheduled = await this.countByStatus("scheduled");
        const active = await this.countByStatus("active");
        const completed = await this.countByStatus("completed");

        return {
            total,
            scheduled,
            active,
            completed,
        };
    }
}

module.exports = AppointmentChatRepository;
