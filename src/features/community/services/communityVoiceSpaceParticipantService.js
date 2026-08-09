const communityMemberRepository = require("../repositories/communityMemberRepository");
const communityVoiceSpaceRepository = require("../repositories/communityVoiceSpaceRepository");
const communityVoiceSpaceParticipantRepository = require("../repositories/communityVoiceSpaceParticipantRepository");
const communityVoiceSpaceService = require("./communityVoiceSpaceService");
const NotificationService = require("../../notifications/services/notificationService");
const { NotFoundError, ForbiddenError, ValidationError } = require("../../../shared/utils/errors");

const notificationService = new NotificationService();

class CommunityVoiceSpaceParticipantService {
    async joinSpace(spaceId, userId) {
        const space = await communityVoiceSpaceRepository.findById(spaceId);
        if (!space) throw new NotFoundError("Voice space not found");
        if (space.status !== "live") throw new ValidationError("This voice space has already ended");

        const membership = await communityMemberRepository.findActiveByUserAndCommunity(userId, space.community.id);
        if (!membership) throw new ForbiddenError("You must be a member of this community to join its voice space");

        const existing = await communityVoiceSpaceParticipantRepository.findBySpaceAndUser(spaceId, userId);
        if (existing && existing.isActive) throw new ValidationError("You have already joined this voice space");

        if (existing) {
            await communityVoiceSpaceParticipantRepository.activate(existing.id, { role: "listener" });
        } else {
            await communityVoiceSpaceParticipantRepository.create({
                space: { id: spaceId },
                user: { id: userId },
                role: "listener",
                isActive: true,
                joinedAt: new Date(),
            });
        }

        return space;
    }

    async leaveSpace(spaceId, userId) {
        const participant = await communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser(spaceId, userId);
        if (!participant) throw new NotFoundError("You are not in this voice space");

        await communityVoiceSpaceParticipantRepository.deactivate(participant.id);

        if (participant.role === "host") {
            await communityVoiceSpaceService.endSpace(spaceId, userId);
        }
    }

    async requestToSpeak(spaceId, userId) {
        const participant = await communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser(spaceId, userId);
        if (!participant) throw new NotFoundError("You are not in this voice space");
        if (participant.role !== "listener") throw new ValidationError("Only listeners can request to speak");

        await communityVoiceSpaceParticipantRepository.setHandRaised(participant.id, true);

        const space = await communityVoiceSpaceRepository.findById(spaceId);
        if (space?.host?.id) {
            await notificationService
                .createNotification(
                    space.host.id,
                    "notification",
                    `Someone raised their hand in "${space.title}"`,
                    { communityId: space.community.id, spaceId },
                    "community"
                )
                .catch(() => {});
        }
    }

    async promoteToSpeaker(spaceId, targetUserId, actingUserId) {
        const space = await this._requireHost(spaceId, actingUserId);

        const participant = await communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser(spaceId, targetUserId);
        if (!participant) throw new NotFoundError("That user is not in this voice space");
        if (participant.role === "host") throw new ValidationError("The host is already speaking");
        if (participant.role === "speaker") throw new ValidationError("This user is already a speaker");

        await communityVoiceSpaceParticipantRepository.updateRole(participant.id, "speaker");
        return space;
    }

    async demoteToListener(spaceId, targetUserId, actingUserId) {
        await this._requireHost(spaceId, actingUserId);

        const participant = await communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser(spaceId, targetUserId);
        if (!participant) throw new NotFoundError("That user is not in this voice space");
        if (participant.role !== "speaker") throw new ValidationError("This user is not currently a speaker");

        await communityVoiceSpaceParticipantRepository.updateRole(participant.id, "listener");
    }

    async listParticipants(spaceId, viewerId) {
        const space = await communityVoiceSpaceRepository.findById(spaceId);
        if (!space) throw new NotFoundError("Voice space not found");

        const membership = await communityMemberRepository.findActiveByUserAndCommunity(viewerId, space.community.id);
        if (!membership) throw new ForbiddenError("You must be a member of this community to view this voice space");

        return communityVoiceSpaceParticipantRepository.findBySpace(spaceId);
    }

    async _requireHost(spaceId, actingUserId) {
        const space = await communityVoiceSpaceRepository.findById(spaceId);
        if (!space) throw new NotFoundError("Voice space not found");
        if (space.host?.id !== actingUserId) throw new ForbiddenError("Only the host can do that");
        return space;
    }
}

module.exports = new CommunityVoiceSpaceParticipantService();
