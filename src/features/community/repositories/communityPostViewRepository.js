const AppDataSource = require("../../../config/database");

const viewRepo = () => AppDataSource.getRepository("CommunityPostView");

const communityPostViewRepository = {
    findByPostAndUser(postId, userId) {
        return viewRepo().findOne({ where: { post: { id: postId }, user: { id: userId } } });
    },

    create(postId, userId) {
        return viewRepo().save({ post: { id: postId }, user: { id: userId } });
    },
};

module.exports = communityPostViewRepository;
