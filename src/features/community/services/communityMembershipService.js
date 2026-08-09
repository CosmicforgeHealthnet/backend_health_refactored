const communityRepository = require("../repositories/communityRepository");
const communityMemberRepository = require("../repositories/communityMemberRepository");
const communityJoinRequestRepository = require("../repositories/communityJoinRequestRepository");
const NotificationService = require("../../notifications/services/notificationService");
const ChatService = require("../../chat/services/chatRoomService");
const { NotFoundError, ForbiddenError, ValidationError } = require("../../../shared/utils/errors");

const notificationService = new NotificationService();
const chatService = new ChatService();

// Community chat access is a derived, secondary system — a hiccup syncing it must
// never fail the underlying community membership action (join/leave/approve/etc).
async function addChatParticipant(chatRoomId, userId, chatRole) {
    if (!chatRoomId) return;
    try {
        await chatService.addParticipant(chatRoomId, userId, chatRole, userId);
    } catch (error) {
        if (!/already in room/i.test(error.message)) {
            console.error("[CommunityMembershipService] failed to add chat participant:", error.message);
        }
    }
}

async function removeChatParticipant(chatRoomId, userId) {
    if (!chatRoomId) return;
    try {
        await chatService.removeParticipant(chatRoomId, userId);
    } catch (error) {
        if (!/participant not found/i.test(error.message)) {
            console.error("[CommunityMembershipService] failed to remove chat participant:", error.message);
        }
    }
}

async function updateChatParticipantRole(chatRoomId, userId, chatRole, actingUserId) {
    if (!chatRoomId) return;
    try {
        await chatService.updateParticipantRole(chatRoomId, userId, chatRole, actingUserId);
    } catch (error) {
        console.error("[CommunityMembershipService] failed to update chat participant role:", error.message);
    }
}

// Community roles (owner/admin/moderator/member/pending_member) don't map 1:1 onto
// ChatParticipant roles (admin/moderator/member) — owner is chat-admin, pending_member
// never gets a chat participant row at all.
function toChatRole(communityRole) {
    if (communityRole === "owner") return "admin";
    if (communityRole === "admin" || communityRole === "moderator") return communityRole;
    return "member";
}

class CommunityMembershipService {
    async joinCommunity(communityId, userId) {
        const community = await communityRepository.findById(communityId);
        if (!community || !community.isActive) throw new NotFoundError("Community not found");
        if (community.privacyType === "private") {
            throw new ValidationError("This community is private — submit a join request instead");
        }

        const existing = await communityMemberRepository.findByUserAndCommunity(userId, communityId);
        if (existing && existing.isActive) throw new ValidationError("You are already a member of this community");

        if (existing) {
            await communityMemberRepository.activate(existing.id, { role: "member" });
        } else {
            await communityMemberRepository.create({
                community: { id: communityId },
                user: { id: userId },
                role: "member",
                isActive: true,
                joinedAt: new Date(),
            });
        }
        await communityRepository.incrementMemberCount(communityId);
        await addChatParticipant(community.chatRoom?.id, userId, "member");

        return communityMemberRepository.findByUserAndCommunity(userId, communityId);
    }

    async requestToJoin(communityId, userId, message) {
        const community = await communityRepository.findById(communityId);
        if (!community || !community.isActive) throw new NotFoundError("Community not found");
        if (community.privacyType !== "private") {
            throw new ValidationError("This community is public — join directly instead");
        }

        const existing = await communityMemberRepository.findByUserAndCommunity(userId, communityId);
        if (existing && existing.isActive) throw new ValidationError("You are already a member of this community");

        const existingRequest = await communityJoinRequestRepository.findPendingByUserAndCommunity(userId, communityId);
        if (existingRequest) throw new ValidationError("You already have a pending join request for this community");

        if (!existing) {
            await communityMemberRepository.create({
                community: { id: communityId },
                user: { id: userId },
                role: "pending_member",
                isActive: false,
            });
        }

        const joinRequest = await communityJoinRequestRepository.create({
            community: { id: communityId },
            user: { id: userId },
            message,
            status: "pending",
        });

        const reviewers = await communityMemberRepository.findByCommunity(communityId, { role: ["owner", "admin"] });
        await Promise.all(
            reviewers.map((reviewer) =>
                notificationService
                    .createNotification(
                        reviewer.user.id,
                        "notification",
                        `A member requested to join ${community.name}`,
                        { communityId, requestId: joinRequest.id, requesterId: userId },
                        "community"
                    )
                    .catch(() => {})
            )
        );

        return joinRequest;
    }

    async listJoinRequests(communityId, { status } = {}) {
        return communityJoinRequestRepository.findByCommunity(communityId, { status });
    }

    async approveJoinRequest(requestId, reviewerId) {
        const request = await communityJoinRequestRepository.findById(requestId);
        if (!request || request.status !== "pending") throw new NotFoundError("Join request not found");

        const member = await communityMemberRepository.findByUserAndCommunity(request.user.id, request.community.id);
        if (member) {
            await communityMemberRepository.activate(member.id, { role: "member" });
        } else {
            await communityMemberRepository.create({
                community: { id: request.community.id },
                user: { id: request.user.id },
                role: "member",
                isActive: true,
                joinedAt: new Date(),
            });
        }
        await communityRepository.incrementMemberCount(request.community.id);
        await addChatParticipant(request.community.chatRoom?.id, request.user.id, "member");
        await communityJoinRequestRepository.updateStatus(requestId, "approved", { reviewedBy: { id: reviewerId } });

        await notificationService
            .createNotification(
                request.user.id,
                "notification",
                `Your request to join ${request.community.name} was approved`,
                { communityId: request.community.id },
                "community"
            )
            .catch(() => {});

        return communityJoinRequestRepository.findById(requestId);
    }

    async rejectJoinRequest(requestId, reviewerId, reason) {
        const request = await communityJoinRequestRepository.findById(requestId);
        if (!request || request.status !== "pending") throw new NotFoundError("Join request not found");

        const member = await communityMemberRepository.findByUserAndCommunity(request.user.id, request.community.id);
        if (member && !member.isActive) await communityMemberRepository.delete(member.id);

        await communityJoinRequestRepository.updateStatus(requestId, "rejected", {
            reviewedBy: { id: reviewerId },
            rejectionReason: reason,
        });

        await notificationService
            .createNotification(
                request.user.id,
                "notification",
                `Your request to join ${request.community.name} was declined`,
                { communityId: request.community.id, reason },
                "community"
            )
            .catch(() => {});

        return communityJoinRequestRepository.findById(requestId);
    }

    async leaveCommunity(communityId, userId) {
        const membership = await communityMemberRepository.findActiveByUserAndCommunity(userId, communityId);
        if (!membership) throw new NotFoundError("You are not a member of this community");

        if (membership.role === "owner") {
            throw new ValidationError("Promote another member to owner before leaving the community");
        }

        const community = await communityRepository.findById(communityId);
        await communityMemberRepository.deactivate(membership.id);
        await communityRepository.decrementMemberCount(communityId);
        await removeChatParticipant(community?.chatRoom?.id, userId);
    }

    async removeMember(communityId, targetUserId, actingUserId) {
        if (targetUserId === actingUserId) throw new ValidationError("Use the leave endpoint to remove yourself");

        const membership = await communityMemberRepository.findActiveByUserAndCommunity(targetUserId, communityId);
        if (!membership) throw new NotFoundError("Member not found in this community");
        if (membership.role === "owner") throw new ForbiddenError("The community owner cannot be removed");

        const community = await communityRepository.findById(communityId);
        await communityMemberRepository.deactivate(membership.id);
        await communityRepository.decrementMemberCount(communityId);
        await removeChatParticipant(community?.chatRoom?.id, targetUserId);
    }

    async promoteMember(communityId, targetUserId, newRole, actingUserId) {
        if (!["admin", "moderator", "member"].includes(newRole)) {
            throw new ValidationError("newRole must be one of: admin, moderator, member");
        }
        if (targetUserId === actingUserId) throw new ValidationError("You cannot change your own role");

        const membership = await communityMemberRepository.findActiveByUserAndCommunity(targetUserId, communityId);
        if (!membership) throw new NotFoundError("Member not found in this community");
        if (membership.role === "owner") throw new ForbiddenError("The community owner's role cannot be changed here");

        const community = await communityRepository.findById(communityId);
        await communityMemberRepository.updateRole(membership.id, newRole);
        await updateChatParticipantRole(community?.chatRoom?.id, targetUserId, toChatRole(newRole), actingUserId);

        return communityMemberRepository.findByUserAndCommunity(targetUserId, communityId);
    }

    async listMembers(communityId, { role } = {}) {
        return communityMemberRepository.findByCommunity(communityId, { role });
    }
}

module.exports = new CommunityMembershipService();
