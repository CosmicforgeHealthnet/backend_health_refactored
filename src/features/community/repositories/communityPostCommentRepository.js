const AppDataSource = require("../../../config/database");

const commentRepo = () => AppDataSource.getRepository("CommunityPostComment");

const communityPostCommentRepository = {
    findById(id) {
        return commentRepo().findOne({ where: { id, isDeleted: false }, relations: ["author", "post"] });
    },

    async findByPost(postId, { page = 1, limit = 20 } = {}) {
        const qb = commentRepo()
            .createQueryBuilder("c")
            .leftJoinAndSelect("c.author", "author")
            .where("c.postId = :postId", { postId })
            .andWhere("c.isDeleted = false")
            .orderBy("c.createdAt", "ASC")
            .skip((page - 1) * limit)
            .take(limit);

        const [comments, total] = await qb.getManyAndCount();
        return { comments, total, page, limit };
    },

    create(data) {
        return commentRepo().save(data);
    },

    softDelete(id) {
        return commentRepo().update(id, { isDeleted: true, deletedAt: new Date() });
    },
};

module.exports = communityPostCommentRepository;
