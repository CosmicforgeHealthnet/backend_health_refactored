const AppDataSource = require("../../../config/database");

const rsvpRepo = () => AppDataSource.getRepository("CommunityEventRSVP");

const communityEventRSVPRepository = {
    findByEventAndUser(eventId, userId) {
        return rsvpRepo().findOne({ where: { event: { id: eventId }, user: { id: userId } } });
    },

    create(eventId, userId) {
        return rsvpRepo().save({ event: { id: eventId }, user: { id: userId }, remindMe: true });
    },

    delete(eventId, userId) {
        return rsvpRepo().delete({ event: { id: eventId }, user: { id: userId } });
    },

    updateReminder(id, remindMe) {
        return rsvpRepo().update(id, { remindMe });
    },

    findByEvent(eventId) {
        return rsvpRepo().find({ where: { event: { id: eventId } }, relations: ["user"], order: { createdAt: "ASC" } });
    },

    /** RSVPs whose event starts within the reminder window, still awaiting a reminder. */
    findDueReminders(windowEnd) {
        return rsvpRepo()
            .createQueryBuilder("r")
            .leftJoinAndSelect("r.event", "event")
            .leftJoinAndSelect("event.community", "community")
            .leftJoinAndSelect("r.user", "user")
            .where("r.remindMe = true")
            .andWhere("r.reminderSentAt IS NULL")
            .andWhere("event.isDeleted = false")
            .andWhere("event.status = 'published'")
            .andWhere("event.startAt > now()")
            .andWhere("event.startAt <= :windowEnd", { windowEnd })
            .getMany();
    },

    markReminderSent(id) {
        return rsvpRepo().update(id, { reminderSentAt: new Date() });
    },
};

module.exports = communityEventRSVPRepository;
