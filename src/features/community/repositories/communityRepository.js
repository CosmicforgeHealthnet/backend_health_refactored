const AppDataSource = require("../../../config/database");

const communityRepo = () => AppDataSource.getRepository("Community");
const memberRepo    = () => AppDataSource.getRepository("CommunityMember");

const communityRepository = {
    findById(id) {
        return communityRepo().findOne({ where: { id }, relations: ["createdBy"] });
    },

    findByIdWithDeleted(id) {
        return communityRepo().findOne({ where: { id }, relations: ["createdBy"], withDeleted: true });
    },

    findBySlug(slug) {
        return communityRepo().findOne({ where: { slug } });
    },

    async findMany({ search, category, privacyType, excludeUserId, page = 1, limit = 20 }) {
        const qb = communityRepo()
            .createQueryBuilder("c")
            .where("c.isActive = true")
            .orderBy("c.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (category)    qb.andWhere("c.category = :category", { category });
        if (privacyType) qb.andWhere("c.privacyType = :privacyType", { privacyType });
        if (search) {
            qb.andWhere("(LOWER(c.name) LIKE :search OR LOWER(c.description) LIKE :search)", {
                search: `%${search.toLowerCase()}%`,
            });
        }
        if (excludeUserId) {
            qb.andWhere(`c.id NOT IN (
                SELECT cm."communityId" FROM community_members cm
                WHERE cm."userId" = :excludeUserId AND cm."isActive" = true
            )`, { excludeUserId });
        }

        const [communities, total] = await qb.getManyAndCount();
        return { communities, total, page, limit };
    },

    async findByUser(userId) {
        const memberships = await memberRepo().find({
            where: { user: { id: userId }, isActive: true },
            relations: ["community"],
        });
        return memberships
            .filter((m) => m.community && m.community.isActive)
            .map((m) => ({ ...m.community, myRole: m.role }));
    },

    create(data) {
        return communityRepo().save(data);
    },

    update(id, data) {
        return communityRepo().update(id, data);
    },

    softDelete(id) {
        return communityRepo().update(id, { isActive: false, deletedAt: new Date() });
    },

    incrementMemberCount(id, by = 1) {
        return communityRepo().increment({ id }, "memberCount", by);
    },

    decrementMemberCount(id, by = 1) {
        return communityRepo().decrement({ id }, "memberCount", by);
    },

    incrementPostCount(id, by = 1) {
        return communityRepo().increment({ id }, "postCount", by);
    },

    decrementPostCount(id, by = 1) {
        return communityRepo().decrement({ id }, "postCount", by);
    },
};

module.exports = communityRepository;
