const communityEventService = require("../services/communityEventService");
const { formatEvent } = require("../utils/formatters");

class CommunityEventController {
    async create(req, res, next) {
        try {
            const { title, description, startAt, coverImageUrl, status } = req.body;
            const event = await communityEventService.createEvent(req.params.communityId, req.user.id, {
                title, description, startAt, coverImageUrl, status,
            });
            return res.status(201).json({ success: true, message: "Event created", event: formatEvent(event) });
        } catch (error) {
            next(error);
        }
    }

    async listByCommunity(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const result = await communityEventService.listCommunityEvents(req.params.communityId, req.user.id, {
                page: Number(page), limit: Number(limit),
            });
            return res.status(200).json({ success: true, ...result, events: result.events.map(formatEvent) });
        } catch (error) {
            next(error);
        }
    }

    async getById(req, res, next) {
        try {
            const event = await communityEventService.getEvent(req.params.id, req.user.id);
            return res.status(200).json({ success: true, event: formatEvent(event) });
        } catch (error) {
            next(error);
        }
    }

    async update(req, res, next) {
        try {
            const event = await communityEventService.updateEvent(req.params.id, req.user.id, req.body);
            return res.status(200).json({ success: true, message: "Event updated", event: formatEvent(event) });
        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {
        try {
            await communityEventService.deleteEvent(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Event deleted" });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CommunityEventController();
