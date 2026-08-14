const communityRepository = require("../repositories/communityRepository");
const communityMemberRepository = require("../repositories/communityMemberRepository");
const communityVoiceSpaceRepository = require("../repositories/communityVoiceSpaceRepository");
const communityVoiceSpaceParticipantRepository = require("../repositories/communityVoiceSpaceParticipantRepository");
const VoiceSpaceZoomService = require("./voiceSpaceZoomService");
const NotificationService = require("../../notifications/services/notificationService");
const { NotFoundError, ForbiddenError, ValidationError } = require("../../../shared/utils/errors");

const voiceSpaceZoomService = new VoiceSpaceZoomService();
const notificationService = new NotificationService();

class CommunityVoiceSpaceService {
    async startSpace(communityId, userId, title) {
        if (!title) throw new ValidationError("title is required");

        const community = await communityRepository.findById(communityId);
        if (!community || !community.isActive) throw new NotFoundError("Community not found");

        const membership = await communityMemberRepository.findActiveByUserAndCommunity(userId, communityId);
        if (!membership) throw new ForbiddenError("You must be a member of this community to start a voice space");

        const existing = await communityVoiceSpaceRepository.findActiveByCommunity(communityId);
        if (existing) throw new ValidationError("This community already has a live voice space — join it or wait for it to end");

        const meeting = await voiceSpaceZoomService.createInstantMeeting(title);

        const space = await communityVoiceSpaceRepository.create({
            community: { id: communityId },
            host: { id: userId },
            title,
            status: "live",
            provider: "zoom",
            zoomMeetingId: meeting.zoomMeetingId,
            joinUrl: meeting.joinUrl,
            hostStartUrl: meeting.startUrl,
        });

        await communityVoiceSpaceParticipantRepository.create({
            space: { id: space.id },
            user: { id: userId },
            role: "host",
            isActive: true,
            joinedAt: new Date(),
        });

        const members = await communityMemberRepository.findByCommunity(communityId);
        await Promise.all(
            members
                .filter((m) => m.user.id !== userId)
                .map((m) =>
                    notificationService
                        .createNotification(
                            m.user.id,
                            "notification",
                            `A voice space just started in ${community.name}: "${title}"`,
                            { communityId, spaceId: space.id },
                            "community"
                        )
                        .catch(() => {})
                )
        );

        return communityVoiceSpaceRepository.findById(space.id);
    }

    async getSpace(spaceId, viewerId) {
        const space = await communityVoiceSpaceRepository.findById(spaceId);
        if (!space) throw new NotFoundError("Voice space not found");

        const participant = viewerId
            ? await communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser(spaceId, viewerId)
            : null;

        return { ...space, myRole: participant ? participant.role : null, handRaised: participant?.handRaised ?? false };
    }

    async endSpace(spaceId, actingUserId) {
        const space = await communityVoiceSpaceRepository.findById(spaceId);
        if (!space) throw new NotFoundError("Voice space not found");
        if (space.host?.id !== actingUserId) throw new ForbiddenError("Only the host can end this voice space");
        if (space.status !== "live") throw new ValidationError("This voice space has already ended");

        await voiceSpaceZoomService.endMeeting(space.zoomMeetingId);
        await communityVoiceSpaceRepository.end(spaceId);
        await communityVoiceSpaceParticipantRepository.deactivateAllBySpace(spaceId);
    }

    async getActiveSpace(communityId) {
        return communityVoiceSpaceRepository.findActiveByCommunity(communityId);
    }

    async listCommunitySpaces(communityId, { page, limit } = {}) {
        return communityVoiceSpaceRepository.findByCommunity(communityId, { page, limit });
    }
}

module.exports = new CommunityVoiceSpaceService();
