const crypto = require("crypto");
const communityRepository = require("../repositories/communityRepository");
const communityMemberRepository = require("../repositories/communityMemberRepository");
const ChatService = require("../../chat/services/chatRoomService");
const { NotFoundError } = require("../../../shared/utils/errors");

const chatService = new ChatService();

// Every community's group chat room is unbounded — chat's own default (50) is
// tuned for direct/appointment rooms, not a whole community's membership.
const COMMUNITY_CHAT_ROOM_MAX_PARTICIPANTS = 100000;

function slugify(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

class CommunityService {
    async createCommunity(userId, data) {
        if (!data.name) throw new Error("name is required");

        const baseSlug = slugify(data.name) || "community";
        let slug = baseSlug;
        if (await communityRepository.findBySlug(slug)) {
            slug = `${baseSlug}-${crypto.randomBytes(3).toString("hex")}`;
        }

        const community = await communityRepository.create({
            name: data.name,
            slug,
            description: data.description,
            category: data.category,
            tags: data.tags,
            privacyType: data.privacyType === "private" ? "private" : "public",
            bannerUrl: data.bannerUrl,
            avatarUrl: data.avatarUrl,
            rules: data.rules,
            memberCount: 1,
            createdBy: { id: userId },
        });

        await communityMemberRepository.create({
            community: { id: community.id },
            user: { id: userId },
            role: "owner",
            isActive: true,
            joinedAt: new Date(),
        });

        const chatRoom = await chatService.createRoom(userId, {
            name: `${community.name} Chat`,
            description: `Group chat for ${community.name}`,
            type: "group",
            isPrivate: community.privacyType === "private",
            maxParticipants: COMMUNITY_CHAT_ROOM_MAX_PARTICIPANTS,
        });
        await communityRepository.update(community.id, { chatRoom: { id: chatRoom.id } });

        return communityRepository.findById(community.id);
    }

    async getCommunityById(communityId, viewerUserId) {
        const community = await communityRepository.findById(communityId);
        if (!community || !community.isActive) throw new NotFoundError("Community not found");

        let membership = null;
        let hasPendingRequest = false;
        if (viewerUserId) {
            membership = await communityMemberRepository.findByUserAndCommunity(viewerUserId, communityId);
            if (membership && membership.role === "pending_member" && !membership.isActive) {
                hasPendingRequest = true;
            }
        }

        return {
            ...community,
            isMember: !!(membership && membership.isActive),
            myRole: membership && membership.isActive ? membership.role : null,
            hasPendingRequest,
        };
    }

    async updateCommunity(communityId, data) {
        const community = await communityRepository.findById(communityId);
        if (!community || !community.isActive) throw new NotFoundError("Community not found");

        const allowedFields = ["name", "description", "category", "tags", "privacyType", "bannerUrl", "avatarUrl", "rules"];
        const updates = {};
        for (const field of allowedFields) {
            if (data[field] !== undefined) updates[field] = data[field];
        }

        await communityRepository.update(communityId, updates);
        return communityRepository.findById(communityId);
    }

    async deleteCommunity(communityId) {
        const community = await communityRepository.findById(communityId);
        if (!community || !community.isActive) throw new NotFoundError("Community not found");

        await communityRepository.softDelete(communityId);
    }

    async listMyCommunities(userId) {
        return communityRepository.findByUser(userId);
    }

    async discoverCommunities(userId, { search, category, privacyType, page, limit } = {}) {
        return communityRepository.findMany({
            search,
            category,
            privacyType,
            excludeUserId: userId,
            page,
            limit,
        });
    }
}

module.exports = new CommunityService();
