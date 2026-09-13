const AppDataSource = require("../../../config/database");
const { In } = require("typeorm");

const likeRepo = () => AppDataSource.getRepository("CommunityPostLike");

const communityPostLikeRepository = {
    findByPostAndUser(postId, userId) {
        return likeRepo().findOne({ where: { post: { id: postId }, user: { id: userId } } });
    },

    async findLikedPostIdsByUser(userId, postIds) {
        if (!postIds.length) return [];
        const rows = await likeRepo().find({
            where: { user: { id: userId }, post: { id: In(postIds) } },
            relations: ["post"],
        });
        return rows.map((r) => r.post.id);
    },

    create(postId, userId) {
        return likeRepo().save({ post: { id: postId }, user: { id: userId } });
    },

    delete(postId, userId) {
        return likeRepo().delete({ post: { id: postId }, user: { id: userId } });
    },
};

module.exports = communityPostLikeRepository;
