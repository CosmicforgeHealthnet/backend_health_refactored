const AppDataSource = require("../../../config/database");
const { In } = require("typeorm");

const memberRepo = () => AppDataSource.getRepository("CommunityMember");

const communityMemberRepository = {
    findByUserAndCommunity(userId, communityId) {
        return memberRepo().findOne({
            where: { user: { id: userId }, community: { id: communityId } },
        });
    },

    findActiveByUserAndCommunity(userId, communityId) {
        return memberRepo().findOne({
            where: { user: { id: userId }, community: { id: communityId }, isActive: true },
        });
    },

    findByUserCommunityAndRoles(userId, communityId, roles) {
        return memberRepo().findOne({
            where: {
                user: { id: userId },
                community: { id: communityId },
                role: In(Array.isArray(roles) ? roles : [roles]),
                isActive: true,
            },
        });
    },

    findByCommunity(communityId, { role, activeOnly = true } = {}) {
        const where = { community: { id: communityId } };
        if (activeOnly) where.isActive = true;
        if (role) where.role = Array.isArray(role) ? In(role) : role;
        return memberRepo().find({ where, relations: ["user"], order: { createdAt: "ASC" } });
    },

    create(data) {
        return memberRepo().save(data);
    },

    updateRole(id, role) {
        return memberRepo().update(id, { role });
    },

    activate(id, extra = {}) {
        return memberRepo().update(id, { isActive: true, joinedAt: new Date(), ...extra });
    },

    deactivate(id) {
        return memberRepo().update(id, { isActive: false, leftAt: new Date() });
    },

    delete(id) {
        return memberRepo().delete(id);
    },

    countActiveByCommunity(communityId) {
        return memberRepo().count({ where: { community: { id: communityId }, isActive: true } });
    },

    async findActiveCommunityIdsByUser(userId) {
        const rows = await memberRepo().find({
            where: { user: { id: userId }, isActive: true },
            relations: ["community"],
        });
        return rows.filter((r) => r.community && r.community.isActive).map((r) => r.community.id);
    },
};

module.exports = communityMemberRepository;
