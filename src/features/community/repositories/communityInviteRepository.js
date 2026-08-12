const AppDataSource = require("../../../config/database");

const inviteRepo = () => AppDataSource.getRepository("CommunityInvite");
const userRepo = () => AppDataSource.getRepository("User");

const communityInviteRepository = {
    findById(id) {
        return inviteRepo().findOne({ where: { id }, relations: ["community", "invitedBy", "invitee"] });
    },

    findPendingByCommunityAndInvitee(communityId, inviteeId) {
        return inviteRepo().findOne({
            where: { community: { id: communityId }, invitee: { id: inviteeId }, status: "pending" },
        });
    },

    findByCommunity(communityId, { status = "pending" } = {}) {
        return inviteRepo().find({
            where: { community: { id: communityId }, status },
            relations: ["invitedBy", "invitee"],
            order: { createdAt: "DESC" },
        });
    },

    findByInvitee(inviteeId, { status = "pending" } = {}) {
        return inviteRepo().find({
            where: { invitee: { id: inviteeId }, status },
            relations: ["community", "invitedBy"],
            order: { createdAt: "DESC" },
        });
    },

    create(data) {
        return inviteRepo().save(data);
    },

    updateStatus(id, status, extra = {}) {
        return inviteRepo().update(id, { status, respondedAt: new Date(), ...extra });
    },

    userExists(userId) {
        return userRepo().exists({ where: { id: userId } });
    },

    /** Platform users matching `query` who aren't already active members of communityId. */
    searchInvitableUsers(communityId, excludeUserId, query, limit = 20) {
        const qb = userRepo()
            .createQueryBuilder("u")
            .select(["u.id", "u.fullName", "u.profileImageUrl", "u.role"])
            .where("u.id != :excludeUserId", { excludeUserId })
            .andWhere(`u.id NOT IN (
                SELECT cm."userId" FROM community_members cm
                WHERE cm."communityId" = :communityId AND cm."isActive" = true
            )`, { communityId })
            .orderBy("u.fullName", "ASC")
            .take(limit);

        if (query) {
            qb.andWhere("(LOWER(u.fullName) LIKE :q OR LOWER(u.email) LIKE :q)", { q: `%${query.toLowerCase()}%` });
        }

        return qb.getMany();
    },

    /** Users who share at least one other active community with userId, not yet in communityId. */
    findSuggestedUsers(communityId, userId, limit = 20) {
        return userRepo()
            .createQueryBuilder("u")
            .select(["u.id", "u.fullName", "u.profileImageUrl", "u.role"])
            .innerJoin("community_members", "sharedCm", `"sharedCm"."userId" = "u"."id" AND "sharedCm"."isActive" = true`)
            .where(`"sharedCm"."communityId" IN (
                SELECT "communityId" FROM community_members
                WHERE "userId" = :userId AND "isActive" = true AND "communityId" != :communityId
            )`, { userId, communityId })
            .andWhere("u.id != :userId", { userId })
            .andWhere(`u.id NOT IN (
                SELECT cm."userId" FROM community_members cm
                WHERE cm."communityId" = :communityId AND cm."isActive" = true
            )`, { communityId })
            .distinct(true)
            .take(limit)
            .getMany();
    },
};

module.exports = communityInviteRepository;
