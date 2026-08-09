const communityMembershipService = require("../services/communityMembershipService");
const { formatMember, formatJoinRequest } = require("../utils/formatters");

class CommunityMembershipController {
    async join(req, res, next) {
        try {
            const membership = await communityMembershipService.joinCommunity(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Joined community", membership: formatMember(membership) });
        } catch (error) {
            next(error);
        }
    }

    async requestToJoin(req, res, next) {
        try {
            const joinRequest = await communityMembershipService.requestToJoin(req.params.id, req.user.id, req.body.message);
            return res.status(201).json({ success: true, message: "Join request submitted", joinRequest: formatJoinRequest(joinRequest) });
        } catch (error) {
            next(error);
        }
    }

    async listJoinRequests(req, res, next) {
        try {
            const { status = "pending" } = req.query;
            const joinRequests = await communityMembershipService.listJoinRequests(req.params.id, { status });
            return res.status(200).json({ success: true, joinRequests: joinRequests.map(formatJoinRequest) });
        } catch (error) {
            next(error);
        }
    }

    async approveJoinRequest(req, res, next) {
        try {
            const joinRequest = await communityMembershipService.approveJoinRequest(req.params.requestId, req.user.id);
            return res.status(200).json({ success: true, message: "Join request approved", joinRequest: formatJoinRequest(joinRequest) });
        } catch (error) {
            next(error);
        }
    }

    async rejectJoinRequest(req, res, next) {
        try {
            const joinRequest = await communityMembershipService.rejectJoinRequest(req.params.requestId, req.user.id, req.body.reason);
            return res.status(200).json({ success: true, message: "Join request rejected", joinRequest: formatJoinRequest(joinRequest) });
        } catch (error) {
            next(error);
        }
    }

    async leave(req, res, next) {
        try {
            await communityMembershipService.leaveCommunity(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Left community" });
        } catch (error) {
            next(error);
        }
    }

    async listMembers(req, res, next) {
        try {
            const { role } = req.query;
            const members = await communityMembershipService.listMembers(req.params.id, { role });
            return res.status(200).json({ success: true, members: members.map(formatMember) });
        } catch (error) {
            next(error);
        }
    }

    async removeMember(req, res, next) {
        try {
            await communityMembershipService.removeMember(req.params.id, req.params.userId, req.user.id);
            return res.status(200).json({ success: true, message: "Member removed" });
        } catch (error) {
            next(error);
        }
    }

    async promoteMember(req, res, next) {
        try {
            const { role } = req.body;
            if (!role) return res.status(400).json({ success: false, message: "role is required" });

            const membership = await communityMembershipService.promoteMember(req.params.id, req.params.userId, role, req.user.id);
            return res.status(200).json({ success: true, message: "Member role updated", membership: formatMember(membership) });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CommunityMembershipController();
