const communityEventRepository = require("../repositories/communityEventRepository");
const communityEventRSVPRepository = require("../repositories/communityEventRSVPRepository");
const communityMemberRepository = require("../repositories/communityMemberRepository");
const { NotFoundError, ForbiddenError, ValidationError } = require("../../../shared/utils/errors");

const MANAGER_ROLES = ["owner", "admin"];

class CommunityEventRSVPService {
    async rsvp(eventId, userId) {
        const event = await communityEventRepository.findById(eventId);
        if (!event) throw new NotFoundError("Event not found");
        if (event.status !== "published") throw new ValidationError("You can't RSVP to an event that isn't published yet");

        const existing = await communityEventRSVPRepository.findByEventAndUser(eventId, userId);
        if (existing) throw new ValidationError("You've already RSVP'd to this event");

        await communityEventRSVPRepository.create(eventId, userId);
        await communityEventRepository.incrementGuestCount(eventId);
    }

    async cancelRsvp(eventId, userId) {
        const existing = await communityEventRSVPRepository.findByEventAndUser(eventId, userId);
        if (!existing) throw new NotFoundError("You have not RSVP'd to this event");

        await communityEventRSVPRepository.delete(eventId, userId);
        await communityEventRepository.decrementGuestCount(eventId);
    }

    async setReminder(eventId, userId, remindMe) {
        const existing = await communityEventRSVPRepository.findByEventAndUser(eventId, userId);
        if (!existing) throw new ValidationError("RSVP to this event before setting a reminder");

        await communityEventRSVPRepository.updateReminder(existing.id, !!remindMe);
    }

    async listAttendees(eventId, actingUserId) {
        const event = await communityEventRepository.findById(eventId);
        if (!event) throw new NotFoundError("Event not found");

        const membership = await communityMemberRepository.findActiveByUserAndCommunity(actingUserId, event.community.id);
        if (!membership || !MANAGER_ROLES.includes(membership.role)) {
            throw new ForbiddenError("Only the community owner or an admin can view attendees");
        }

        return communityEventRSVPRepository.findByEvent(eventId);
    }
}

module.exports = new CommunityEventRSVPService();
