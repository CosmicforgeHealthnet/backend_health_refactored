const AppDataSource = require("../../../config/database");

const saveRepo = () => AppDataSource.getRepository("CommunityPostSave");

const communityPostSaveRepository = {
    findByPostAndUser(postId, userId) {
        return saveRepo().findOne({ where: { post: { id: postId }, user: { id: userId } } });
    },

    async findByUser(userId, { page = 1, limit = 20 } = {}) {
        const qb = saveRepo()
            .createQueryBuilder("s")
            .leftJoinAndSelect("s.post", "post")
            .leftJoinAndSelect("post.author", "author")
            .leftJoinAndSelect("post.media", "media")
            .where("s.userId = :userId", { userId })
            .andWhere("post.isDeleted = false")
            .orderBy("s.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        const [saves, total] = await qb.getManyAndCount();
        return { saves, total, page, limit };
    },

    create(postId, userId) {
        return saveRepo().save({ post: { id: postId }, user: { id: userId } });
    },

    delete(postId, userId) {
        return saveRepo().delete({ post: { id: postId }, user: { id: userId } });
    },
};

module.exports = communityPostSaveRepository;
