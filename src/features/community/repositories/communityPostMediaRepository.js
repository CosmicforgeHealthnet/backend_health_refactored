const AppDataSource = require("../../../config/database");

const mediaRepo = () => AppDataSource.getRepository("CommunityPostMedia");

const communityPostMediaRepository = {
    createMany(postId, mediaItems) {
        const rows = mediaItems.map((item, index) => ({
            post: { id: postId },
            mediaUrl: typeof item === "string" ? item : item.url,
            mediaType: (typeof item === "string" ? undefined : item.type) || "image",
            order: index,
        }));
        return mediaRepo().save(rows);
    },

    findByPost(postId) {
        return mediaRepo().find({ where: { post: { id: postId } }, order: { order: "ASC" } });
    },
};

module.exports = communityPostMediaRepository;
