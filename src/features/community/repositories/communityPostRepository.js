const AppDataSource = require("../../../config/database");

const postRepo = () => AppDataSource.getRepository("CommunityPost");

const communityPostRepository = {
    findById(id) {
        return postRepo().findOne({
            where: { id, isDeleted: false },
            relations: ["author", "community", "media"],
        });
    },

    async findByCommunity(communityId, { page = 1, limit = 20 } = {}) {
        const qb = postRepo()
            .createQueryBuilder("p")
            .leftJoinAndSelect("p.author", "author")
            .leftJoinAndSelect("p.media", "media")
            .where("p.communityId = :communityId", { communityId })
            .andWhere("p.isDeleted = false")
            .orderBy("p.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        const [posts, total] = await qb.getManyAndCount();
        return { posts, total, page, limit };
    },

    create(data) {
        return postRepo().save(data);
    },

    softDelete(id, deletedById) {
        return postRepo().update(id, { isDeleted: true, deletedAt: new Date(), deletedBy: { id: deletedById } });
    },

    incrementLikeCount(id, by = 1) {
        return postRepo().increment({ id }, "likeCount", by);
    },

    decrementLikeCount(id, by = 1) {
        return postRepo().decrement({ id }, "likeCount", by);
    },

    incrementCommentCount(id, by = 1) {
        return postRepo().increment({ id }, "commentCount", by);
    },

    decrementCommentCount(id, by = 1) {
        return postRepo().decrement({ id }, "commentCount", by);
    },

    incrementViewCount(id) {
        return postRepo().increment({ id }, "viewCount", 1);
    },
};

module.exports = communityPostRepository;
