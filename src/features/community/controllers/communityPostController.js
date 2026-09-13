const communityPostService = require("../services/communityPostService");
const { formatPost, formatComment, formatSave } = require("../utils/formatters");

class CommunityPostController {
    async create(req, res, next) {
        try {
            const { content, mediaUrls } = req.body;
            const post = await communityPostService.createPost(req.params.communityId, req.user.id, {
                content, mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : undefined,
            });
            return res.status(201).json({ success: true, message: "Post created", post: formatPost(post) });
        } catch (error) {
            next(error);
        }
    }

    async listMyFeed(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const result = await communityPostService.listMyFeed(req.user.id, { page: Number(page), limit: Number(limit) });
            return res.status(200).json({ success: true, ...result, posts: result.posts.map(formatPost) });
        } catch (error) {
            next(error);
        }
    }

    async listByCommunity(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const result = await communityPostService.listCommunityPosts(req.params.communityId, req.user.id, {
                page: Number(page), limit: Number(limit),
            });
            return res.status(200).json({ success: true, ...result, posts: result.posts.map(formatPost) });
        } catch (error) {
            next(error);
        }
    }

    async getById(req, res, next) {
        try {
            const post = await communityPostService.getPost(req.params.id, req.user.id);
            return res.status(200).json({ success: true, post: formatPost(post) });
        } catch (error) {
            next(error);
        }
    }

    async view(req, res, next) {
        try {
            const result = await communityPostService.recordView(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "View recorded", viewCount: result.viewCount });
        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {
        try {
            await communityPostService.deletePost(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Post deleted" });
        } catch (error) {
            next(error);
        }
    }

    async like(req, res, next) {
        try {
            await communityPostService.likePost(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Post liked" });
        } catch (error) {
            next(error);
        }
    }

    async unlike(req, res, next) {
        try {
            await communityPostService.unlikePost(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Post unliked" });
        } catch (error) {
            next(error);
        }
    }

    async addComment(req, res, next) {
        try {
            const { content, parentCommentId } = req.body;
            const comment = await communityPostService.addComment(req.params.id, req.user.id, { content, parentCommentId });
            return res.status(201).json({ success: true, message: "Comment added", comment: formatComment(comment) });
        } catch (error) {
            next(error);
        }
    }

    async listComments(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const result = await communityPostService.listComments(req.params.id, { page: Number(page), limit: Number(limit) });
            return res.status(200).json({ success: true, ...result, comments: result.comments.map(formatComment) });
        } catch (error) {
            next(error);
        }
    }

    async deleteComment(req, res, next) {
        try {
            await communityPostService.deleteComment(req.params.id, req.params.commentId, req.user.id);
            return res.status(200).json({ success: true, message: "Comment deleted" });
        } catch (error) {
            next(error);
        }
    }

    async save(req, res, next) {
        try {
            await communityPostService.savePost(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Post saved" });
        } catch (error) {
            next(error);
        }
    }

    async unsave(req, res, next) {
        try {
            await communityPostService.unsavePost(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Post unsaved" });
        } catch (error) {
            next(error);
        }
    }

    async listMySavedPosts(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const result = await communityPostService.listMySavedPosts(req.user.id, { page: Number(page), limit: Number(limit) });
            return res.status(200).json({ success: true, ...result, saves: result.saves.map(formatSave) });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CommunityPostController();
