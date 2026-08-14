const AppDataSource = require("../../../config/database");

const spaceRepo = () => AppDataSource.getRepository("CommunityVoiceSpace");

const communityVoiceSpaceRepository = {
    findById(id) {
        return spaceRepo().findOne({ where: { id }, relations: ["community", "host"] });
    },

    findActiveByCommunity(communityId) {
        return spaceRepo().findOne({ where: { community: { id: communityId }, status: "live" }, relations: ["host"] });
    },

    async findByCommunity(communityId, { page = 1, limit = 20 } = {}) {
        const qb = spaceRepo()
            .createQueryBuilder("s")
            .leftJoinAndSelect("s.host", "host")
            .where("s.communityId = :communityId", { communityId })
            .andWhere("s.status = 'ended'")
            .orderBy("s.endedAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        const [spaces, total] = await qb.getManyAndCount();
        return { spaces, total, page, limit };
    },

    create(data) {
        return spaceRepo().save(data);
    },

    end(id) {
        return spaceRepo().update(id, { status: "ended", endedAt: new Date() });
    },
};

module.exports = communityVoiceSpaceRepository;
