const communityVoiceSpaceParticipantService = require("../services/communityVoiceSpaceParticipantService");
const { formatVoiceSpace, formatVoiceSpaceParticipant } = require("../utils/formatters");

class CommunityVoiceSpaceParticipantController {
    async join(req, res, next) {
        try {
            const space = await communityVoiceSpaceParticipantService.joinSpace(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Joined voice space", space: formatVoiceSpace(space, req.user.id) });
        } catch (error) {
            next(error);
        }
    }

    async leave(req, res, next) {
        try {
            await communityVoiceSpaceParticipantService.leaveSpace(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Left voice space" });
        } catch (error) {
            next(error);
        }
    }

    async requestToSpeak(req, res, next) {
        try {
            await communityVoiceSpaceParticipantService.requestToSpeak(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Request to speak sent" });
        } catch (error) {
            next(error);
        }
    }

    async promote(req, res, next) {
        try {
            await communityVoiceSpaceParticipantService.promoteToSpeaker(req.params.id, req.params.userId, req.user.id);
            return res.status(200).json({ success: true, message: "Participant promoted to speaker" });
        } catch (error) {
            next(error);
        }
    }

    async demote(req, res, next) {
        try {
            await communityVoiceSpaceParticipantService.demoteToListener(req.params.id, req.params.userId, req.user.id);
            return res.status(200).json({ success: true, message: "Speaker moved back to listener" });
        } catch (error) {
            next(error);
        }
    }

    async listParticipants(req, res, next) {
        try {
            const participants = await communityVoiceSpaceParticipantService.listParticipants(req.params.id, req.user.id);
            return res.status(200).json({ success: true, participants: participants.map(formatVoiceSpaceParticipant) });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CommunityVoiceSpaceParticipantController();
