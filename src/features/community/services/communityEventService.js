const communityEventRepository = require("../repositories/communityEventRepository");
const communityMemberRepository = require("../repositories/communityMemberRepository");
const communityEventRSVPRepository = require("../repositories/communityEventRSVPRepository");
const NotificationService = require("../../notifications/services/notificationService");
const { NotFoundError, ForbiddenError, ValidationError } = require("../../../shared/utils/errors");

const notificationService = new NotificationService();
const MANAGER_ROLES = ["owner", "admin"];

class CommunityEventService {
    async createEvent(communityId, userId, { title, description, startAt, coverImageUrl, status }) {
        if (!title) throw new ValidationError("title is required");
        if (!startAt || Number.isNaN(Date.parse(startAt))) throw new ValidationError("startAt must be a valid date/time");

        const event = await communityEventRepository.create({
            community: { id: communityId },
            createdBy: { id: userId },
            title,
            description,
            startAt: new Date(startAt),
            coverImageUrl,
            status: status === "published" ? "published" : "draft",
        });

        if (event.status === "published") {
            await this._notifyCommunityOfNewEvent(communityId, event);
        }

        return communityEventRepository.findById(event.id);
    }

    async getEvent(eventId, viewerId) {
        const event = await communityEventRepository.findById(eventId);
        if (!event) throw new NotFoundError("Event not found");

        const membership = viewerId
            ? await communityMemberRepository.findActiveByUserAndCommunity(viewerId, event.community.id)
            : null;
        const isManager = !!membership && MANAGER_ROLES.includes(membership.role);

        if (event.status === "draft" && !isManager) {
            throw new ForbiddenError("This event is not published yet");
        }

        const rsvp = viewerId ? await communityEventRSVPRepository.findByEventAndUser(eventId, viewerId) : null;

        return { ...event, isGoing: !!rsvp, remindMe: rsvp ? rsvp.remindMe : false };
    }

    async listCommunityEvents(communityId, viewerId, { page, limit } = {}) {
        const membership = viewerId
            ? await communityMemberRepository.findActiveByUserAndCommunity(viewerId, communityId)
            : null;
        const includeDrafts = !!membership && MANAGER_ROLES.includes(membership.role);

        return communityEventRepository.findByCommunity(communityId, { includeDrafts, page, limit });
    }

    async updateEvent(eventId, actingUserId, data) {
        const event = await this._requireManagerAccess(eventId, actingUserId);

        const allowedFields = ["title", "description", "startAt", "coverImageUrl", "status"];
        const updates = {};
        for (const field of allowedFields) {
            if (data[field] !== undefined) updates[field] = data[field];
        }
        if (updates.startAt) {
            if (Number.isNaN(Date.parse(updates.startAt))) throw new ValidationError("startAt must be a valid date/time");
            updates.startAt = new Date(updates.startAt);
        }
        if (updates.status && !["draft", "published"].includes(updates.status)) {
            throw new ValidationError("status must be draft or published");
        }

        const isNewlyPublished = event.status === "draft" && updates.status === "published";

        await communityEventRepository.update(eventId, updates);
        const updated = await communityEventRepository.findById(eventId);

        if (isNewlyPublished) {
            await this._notifyCommunityOfNewEvent(event.community.id, updated);
        }

        return updated;
    }

    async deleteEvent(eventId, actingUserId) {
        await this._requireManagerAccess(eventId, actingUserId);
        await communityEventRepository.softDelete(eventId);
    }

    async _requireManagerAccess(eventId, actingUserId) {
        const event = await communityEventRepository.findById(eventId);
        if (!event) throw new NotFoundError("Event not found");

        const membership = await communityMemberRepository.findActiveByUserAndCommunity(actingUserId, event.community.id);
        if (!membership || !MANAGER_ROLES.includes(membership.role)) {
            throw new ForbiddenError("Only the community owner or an admin can manage this event");
        }
        return event;
    }

    async _notifyCommunityOfNewEvent(communityId, event) {
        const members = await communityMemberRepository.findByCommunity(communityId);
        await Promise.all(
            members
                .filter((m) => m.user.id !== event.createdBy?.id)
                .map((m) =>
                    notificationService
                        .createNotification(
                            m.user.id,
                            "notification",
                            `New event in your community: ${event.title}`,
                            { communityId, eventId: event.id },
                            "community"
                        )
                        .catch(() => {})
                )
        );
    }
}

module.exports = new CommunityEventService();
