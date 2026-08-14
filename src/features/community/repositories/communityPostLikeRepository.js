const AppDataSource = require("../../../config/database");

const likeRepo = () => AppDataSource.getRepository("CommunityPostLike");

const communityPostLikeRepository = {
    findByPostAndUser(postId, userId) {
        return likeRepo().findOne({ where: { post: { id: postId }, user: { id: userId } } });
    },

    create(postId, userId) {
        return likeRepo().save({ post: { id: postId }, user: { id: userId } });
    },

    delete(postId, userId) {
        return likeRepo().delete({ post: { id: postId }, user: { id: userId } });
    },
};

module.exports = communityPostLikeRepository;
