const communityRepository = require("../repositories/communityRepository");
const communityMemberRepository = require("../repositories/communityMemberRepository");
const communityInviteRepository = require("../repositories/communityInviteRepository");
const NotificationService = require("../../notifications/services/notificationService");
const ChatService = require("../../chat/services/chatRoomService");
const { NotFoundError, ForbiddenError, ValidationError } = require("../../../shared/utils/errors");

const notificationService = new NotificationService();
const chatService = new ChatService();
const MANAGER_ROLES = ["owner", "admin"];

// Mirrors communityMembershipService's chat-access sync — kept local rather than
// shared since that module has no named exports (it exports a singleton instance).
async function addChatParticipant(chatRoomId, userId, chatRole) {
    if (!chatRoomId) return;
    try {
        await chatService.addParticipant(chatRoomId, userId, chatRole, userId);
    } catch (error) {
        if (!/already in room/i.test(error.message)) {
            console.error("[CommunityInviteService] failed to add chat participant:", error.message);
        }
    }
}

class CommunityInviteService {
    async searchInvitableUsers(communityId, actingUserId, query, limit = 20) {
        const membership = await communityMemberRepository.findActiveByUserAndCommunity(actingUserId, communityId);
        if (!membership) throw new ForbiddenError("You must be a member of this community to invite people");

        return communityInviteRepository.searchInvitableUsers(communityId, actingUserId, query, limit);
    }

    async getSuggestedUsers(communityId, actingUserId, limit = 20) {
        const membership = await communityMemberRepository.findActiveByUserAndCommunity(actingUserId, communityId);
        if (!membership) throw new ForbiddenError("You must be a member of this community to invite people");

        return communityInviteRepository.findSuggestedUsers(communityId, actingUserId, limit);
    }

    async sendInvite(communityId, actingUserId, inviteeId, message) {
        if (!inviteeId) throw new ValidationError("inviteeId is required");
        if (inviteeId === actingUserId) throw new ValidationError("You cannot invite yourself");

        const community = await communityRepository.findById(communityId);
        if (!community || !community.isActive) throw new NotFoundError("Community not found");

        const membership = await communityMemberRepository.findActiveByUserAndCommunity(actingUserId, communityId);
        if (!membership) throw new ForbiddenError("You must be a member of this community to invite people");

        const inviteeExists = await communityInviteRepository.userExists(inviteeId);
        if (!inviteeExists) throw new NotFoundError("That user does not exist");

        const inviteeMembership = await communityMemberRepository.findActiveByUserAndCommunity(inviteeId, communityId);
        if (inviteeMembership) throw new ValidationError("That user is already a member of this community");

        const existingInvite = await communityInviteRepository.findPendingByCommunityAndInvitee(communityId, inviteeId);
        if (existingInvite) throw new ValidationError("That user already has a pending invite to this community");

        const invite = await communityInviteRepository.create({
            community: { id: communityId },
            invitedBy: { id: actingUserId },
            invitee: { id: inviteeId },
            message,
            status: "pending",
        });

        await notificationService
            .createNotification(
                inviteeId,
                "notification",
                `You've been invited to join ${community.name}`,
                { communityId, inviteId: invite.id, invitedById: actingUserId },
                "community"
            )
            .catch(() => {});

        return communityInviteRepository.findById(invite.id);
    }

    async listSentInvites(communityId, { status } = {}) {
        return communityInviteRepository.findByCommunity(communityId, { status });
    }

    async listMyInvites(userId, { status } = {}) {
        return communityInviteRepository.findByInvitee(userId, { status });
    }

    async acceptInvite(inviteId, actingUserId) {
        const invite = await communityInviteRepository.findById(inviteId);
        if (!invite || invite.status !== "pending") throw new NotFoundError("Invite not found");
        if (invite.invitee.id !== actingUserId) throw new ForbiddenError("This invite is not addressed to you");

        const communityId = invite.community.id;
        const existing = await communityMemberRepository.findByUserAndCommunity(actingUserId, communityId);
        if (existing) {
            await communityMemberRepository.activate(existing.id, {
                role: "member",
                invitedBy: invite.invitedBy ? { id: invite.invitedBy.id } : null,
            });
        } else {
            await communityMemberRepository.create({
                community: { id: communityId },
                user: { id: actingUserId },
                role: "member",
                isActive: true,
                joinedAt: new Date(),
                invitedBy: invite.invitedBy ? { id: invite.invitedBy.id } : null,
            });
        }
        await communityRepository.incrementMemberCount(communityId);

        const community = await communityRepository.findById(communityId);
        await addChatParticipant(community?.chatRoom?.id, actingUserId, "member");

        await communityInviteRepository.updateStatus(inviteId, "accepted");

        if (invite.invitedBy?.id) {
            await notificationService
                .createNotification(
                    invite.invitedBy.id,
                    "notification",
                    `Your invite to ${invite.community.name} was accepted`,
                    { communityId },
                    "community"
                )
                .catch(() => {});
        }

        return communityInviteRepository.findById(inviteId);
    }

    async declineInvite(inviteId, actingUserId) {
        const invite = await communityInviteRepository.findById(inviteId);
        if (!invite || invite.status !== "pending") throw new NotFoundError("Invite not found");
        if (invite.invitee.id !== actingUserId) throw new ForbiddenError("This invite is not addressed to you");

        await communityInviteRepository.updateStatus(inviteId, "declined");
        return communityInviteRepository.findById(inviteId);
    }

    async cancelInvite(inviteId, actingUserId) {
        const invite = await communityInviteRepository.findById(inviteId);
        if (!invite || invite.status !== "pending") throw new NotFoundError("Invite not found");

        const isSender = invite.invitedBy?.id === actingUserId;
        if (!isSender) {
            const membership = await communityMemberRepository.findActiveByUserAndCommunity(actingUserId, invite.community.id);
            if (!membership || !MANAGER_ROLES.includes(membership.role)) {
                throw new ForbiddenError("Only the sender or a community owner/admin can cancel this invite");
            }
        }

        await communityInviteRepository.updateStatus(inviteId, "cancelled");
    }
}

module.exports = new CommunityInviteService();
