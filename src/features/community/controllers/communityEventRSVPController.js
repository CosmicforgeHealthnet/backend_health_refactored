const communityEventRSVPService = require("../services/communityEventRSVPService");
const { formatRsvp } = require("../utils/formatters");

class CommunityEventRSVPController {
    async rsvp(req, res, next) {
        try {
            await communityEventRSVPService.rsvp(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "RSVP confirmed" });
        } catch (error) {
            next(error);
        }
    }

    async cancelRsvp(req, res, next) {
        try {
            await communityEventRSVPService.cancelRsvp(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "RSVP cancelled" });
        } catch (error) {
            next(error);
        }
    }

    async setReminder(req, res, next) {
        try {
            const { remindMe } = req.body;
            if (typeof remindMe !== "boolean") {
                return res.status(400).json({ success: false, message: "remindMe (boolean) is required" });
            }
            await communityEventRSVPService.setReminder(req.params.id, req.user.id, remindMe);
            return res.status(200).json({ success: true, message: "Reminder preference updated" });
        } catch (error) {
            next(error);
        }
    }

    async listAttendees(req, res, next) {
        try {
            const attendees = await communityEventRSVPService.listAttendees(req.params.id, req.user.id);
            return res.status(200).json({ success: true, attendees: attendees.map(formatRsvp) });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CommunityEventRSVPController();
