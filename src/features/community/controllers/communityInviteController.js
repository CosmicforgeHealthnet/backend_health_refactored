const communityInviteService = require("../services/communityInviteService");
const { publicUser, formatInvite } = require("../utils/formatters");

class CommunityInviteController {
    async searchUsers(req, res, next) {
        try {
            const { q, limit = 20 } = req.query;
            const users = await communityInviteService.searchInvitableUsers(req.params.id, req.user.id, q, Number(limit));
            return res.status(200).json({ success: true, users: users.map(publicUser) });
        } catch (error) {
            next(error);
        }
    }

    async suggestedUsers(req, res, next) {
        try {
            const { limit = 20 } = req.query;
            const users = await communityInviteService.getSuggestedUsers(req.params.id, req.user.id, Number(limit));
            return res.status(200).json({ success: true, users: users.map(publicUser) });
        } catch (error) {
            next(error);
        }
    }

    async send(req, res, next) {
        try {
            const { inviteeId, message } = req.body;
            const invite = await communityInviteService.sendInvite(req.params.id, req.user.id, inviteeId, message);
            return res.status(201).json({ success: true, message: "Invite sent", invite: formatInvite(invite) });
        } catch (error) {
            next(error);
        }
    }

    async listSent(req, res, next) {
        try {
            const { status } = req.query;
            const invites = await communityInviteService.listSentInvites(req.params.id, { status });
            return res.status(200).json({ success: true, invites: invites.map(formatInvite) });
        } catch (error) {
            next(error);
        }
    }

    async listMine(req, res, next) {
        try {
            const { status } = req.query;
            const invites = await communityInviteService.listMyInvites(req.user.id, { status });
            return res.status(200).json({ success: true, invites: invites.map(formatInvite) });
        } catch (error) {
            next(error);
        }
    }

    async accept(req, res, next) {
        try {
            const invite = await communityInviteService.acceptInvite(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Invite accepted", invite: formatInvite(invite) });
        } catch (error) {
            next(error);
        }
    }

    async decline(req, res, next) {
        try {
            const invite = await communityInviteService.declineInvite(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Invite declined", invite: formatInvite(invite) });
        } catch (error) {
            next(error);
        }
    }

    async cancel(req, res, next) {
        try {
            await communityInviteService.cancelInvite(req.params.inviteId, req.user.id);
            return res.status(200).json({ success: true, message: "Invite cancelled" });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CommunityInviteController();
