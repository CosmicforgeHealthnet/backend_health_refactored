const AppDataSource = require("../../../config/database");

const joinRequestRepo = () => AppDataSource.getRepository("CommunityJoinRequest");

const communityJoinRequestRepository = {
    findById(id) {
        return joinRequestRepo().findOne({ where: { id }, relations: ["community", "user"] });
    },

    findPendingByUserAndCommunity(userId, communityId) {
        return joinRequestRepo().findOne({
            where: { user: { id: userId }, community: { id: communityId }, status: "pending" },
        });
    },

    findByCommunity(communityId, { status } = {}) {
        const where = { community: { id: communityId } };
        if (status) where.status = status;
        return joinRequestRepo().find({ where, relations: ["user"], order: { createdAt: "DESC" } });
    },

    create(data) {
        return joinRequestRepo().save(data);
    },

    updateStatus(id, status, extra = {}) {
        return joinRequestRepo().update(id, { status, reviewedAt: new Date(), ...extra });
    },
};

module.exports = communityJoinRequestRepository;
