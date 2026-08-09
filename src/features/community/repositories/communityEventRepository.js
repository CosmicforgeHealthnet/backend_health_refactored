const AppDataSource = require("../../../config/database");

const eventRepo = () => AppDataSource.getRepository("CommunityEvent");

const communityEventRepository = {
    findById(id) {
        return eventRepo().findOne({
            where: { id, isDeleted: false },
            relations: ["community", "createdBy"],
        });
    },

    async findByCommunity(communityId, { includeDrafts = false, page = 1, limit = 20 } = {}) {
        const qb = eventRepo()
            .createQueryBuilder("e")
            .leftJoinAndSelect("e.createdBy", "createdBy")
            .where("e.communityId = :communityId", { communityId })
            .andWhere("e.isDeleted = false")
            .orderBy("e.startAt", "ASC")
            .skip((page - 1) * limit)
            .take(limit);

        if (!includeDrafts) qb.andWhere("e.status = 'published'");

        const [events, total] = await qb.getManyAndCount();
        return { events, total, page, limit };
    },

    create(data) {
        return eventRepo().save(data);
    },

    update(id, data) {
        return eventRepo().update(id, data);
    },

    softDelete(id) {
        return eventRepo().update(id, { isDeleted: true, deletedAt: new Date() });
    },

    incrementGuestCount(id, by = 1) {
        return eventRepo().increment({ id }, "guestCount", by);
    },

    decrementGuestCount(id, by = 1) {
        return eventRepo().decrement({ id }, "guestCount", by);
    },
};

module.exports = communityEventRepository;
