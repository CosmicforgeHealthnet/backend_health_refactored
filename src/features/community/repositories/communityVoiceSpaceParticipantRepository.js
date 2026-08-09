const AppDataSource = require("../../../config/database");

const participantRepo = () => AppDataSource.getRepository("CommunityVoiceSpaceParticipant");

const communityVoiceSpaceParticipantRepository = {
    findBySpaceAndUser(spaceId, userId) {
        return participantRepo().findOne({ where: { space: { id: spaceId }, user: { id: userId } } });
    },

    findActiveBySpaceAndUser(spaceId, userId) {
        return participantRepo().findOne({ where: { space: { id: spaceId }, user: { id: userId }, isActive: true } });
    },

    create(data) {
        return participantRepo().save(data);
    },

    activate(id, extra = {}) {
        return participantRepo().update(id, { isActive: true, joinedAt: new Date(), leftAt: null, ...extra });
    },

    deactivate(id) {
        return participantRepo().update(id, { isActive: false, leftAt: new Date() });
    },

    deactivateAllBySpace(spaceId) {
        return participantRepo().update({ space: { id: spaceId }, isActive: true }, { isActive: false, leftAt: new Date() });
    },

    updateRole(id, role) {
        return participantRepo().update(id, { role, handRaised: false });
    },

    setHandRaised(id, handRaised) {
        return participantRepo().update(id, { handRaised });
    },

    findBySpace(spaceId, { role, activeOnly = true } = {}) {
        const where = { space: { id: spaceId } };
        if (activeOnly) where.isActive = true;
        if (role) where.role = role;
        return participantRepo().find({ where, relations: ["user"], order: { createdAt: "ASC" } });
    },
};

module.exports = communityVoiceSpaceParticipantRepository;
