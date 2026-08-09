const communityRepository = require("../repositories/communityRepository");
const communityMemberRepository = require("../repositories/communityMemberRepository");
const communityPostRepository = require("../repositories/communityPostRepository");
const communityPostMediaRepository = require("../repositories/communityPostMediaRepository");
const communityPostLikeRepository = require("../repositories/communityPostLikeRepository");
const communityPostCommentRepository = require("../repositories/communityPostCommentRepository");
const communityPostSaveRepository = require("../repositories/communityPostSaveRepository");
const { NotFoundError, ForbiddenError, ValidationError } = require("../../../shared/utils/errors");

const MODERATOR_ROLES = ["owner", "admin", "moderator"];

class CommunityPostService {
    async createPost(communityId, userId, { content, mediaUrls }) {
        if (!content && !(mediaUrls && mediaUrls.length)) {
            throw new ValidationError("A post needs content or at least one media attachment");
        }

        const post = await communityPostRepository.create({
            community: { id: communityId },
            author: { id: userId },
            content,
        });

        if (mediaUrls && mediaUrls.length) {
            await communityPostMediaRepository.createMany(post.id, mediaUrls);
        }
        await communityRepository.incrementPostCount(communityId);

        return communityPostRepository.findById(post.id);
    }

    async getPost(postId, viewerId) {
        const post = await communityPostRepository.findById(postId);
        if (!post) throw new NotFoundError("Post not found");

        await communityPostRepository.incrementViewCount(postId);

        let isLiked = false;
        let isSaved = false;
        if (viewerId) {
            isLiked = !!(await communityPostLikeRepository.findByPostAndUser(postId, viewerId));
            isSaved = !!(await communityPostSaveRepository.findByPostAndUser(postId, viewerId));
        }

        return { ...post, viewCount: post.viewCount + 1, isLiked, isSaved };
    }

    async listCommunityPosts(communityId, { page, limit } = {}) {
        return communityPostRepository.findByCommunity(communityId, { page, limit });
    }

    async deletePost(postId, actingUserId) {
        const post = await communityPostRepository.findById(postId);
        if (!post) throw new NotFoundError("Post not found");

        const isAuthor = post.author.id === actingUserId;
        let isModerator = false;
        if (!isAuthor) {
            const membership = await communityMemberRepository.findActiveByUserAndCommunity(actingUserId, post.community.id);
            isModerator = !!membership && MODERATOR_ROLES.includes(membership.role);
        }
        if (!isAuthor && !isModerator) throw new ForbiddenError("You cannot delete this post");

        await communityPostRepository.softDelete(postId, actingUserId);
        await communityRepository.decrementPostCount(post.community.id);
    }

    async likePost(postId, userId) {
        const post = await communityPostRepository.findById(postId);
        if (!post) throw new NotFoundError("Post not found");

        const existing = await communityPostLikeRepository.findByPostAndUser(postId, userId);
        if (existing) throw new ValidationError("You already liked this post");

        await communityPostLikeRepository.create(postId, userId);
        await communityPostRepository.incrementLikeCount(postId);
    }

    async unlikePost(postId, userId) {
        const existing = await communityPostLikeRepository.findByPostAndUser(postId, userId);
        if (!existing) throw new NotFoundError("You have not liked this post");

        await communityPostLikeRepository.delete(postId, userId);
        await communityPostRepository.decrementLikeCount(postId);
    }

    async addComment(postId, userId, { content, parentCommentId }) {
        if (!content) throw new ValidationError("content is required");

        const post = await communityPostRepository.findById(postId);
        if (!post) throw new NotFoundError("Post not found");

        const comment = await communityPostCommentRepository.create({
            post: { id: postId },
            author: { id: userId },
            content,
            parentComment: parentCommentId ? { id: parentCommentId } : null,
        });
        await communityPostRepository.incrementCommentCount(postId);

        return communityPostCommentRepository.findById(comment.id);
    }

    async listComments(postId, { page, limit } = {}) {
        return communityPostCommentRepository.findByPost(postId, { page, limit });
    }

    async deleteComment(postId, commentId, actingUserId) {
        const comment = await communityPostCommentRepository.findById(commentId);
        if (!comment || comment.post.id !== postId) throw new NotFoundError("Comment not found");

        const isAuthor = comment.author.id === actingUserId;
        let isModerator = false;
        if (!isAuthor) {
            const post = await communityPostRepository.findById(postId);
            const membership = await communityMemberRepository.findActiveByUserAndCommunity(actingUserId, post.community.id);
            isModerator = !!membership && MODERATOR_ROLES.includes(membership.role);
        }
        if (!isAuthor && !isModerator) throw new ForbiddenError("You cannot delete this comment");

        await communityPostCommentRepository.softDelete(commentId);
        await communityPostRepository.decrementCommentCount(postId);
    }

    async savePost(postId, userId) {
        const post = await communityPostRepository.findById(postId);
        if (!post) throw new NotFoundError("Post not found");

        const existing = await communityPostSaveRepository.findByPostAndUser(postId, userId);
        if (existing) throw new ValidationError("You already saved this post");

        await communityPostSaveRepository.create(postId, userId);
    }

    async unsavePost(postId, userId) {
        const existing = await communityPostSaveRepository.findByPostAndUser(postId, userId);
        if (!existing) throw new NotFoundError("You have not saved this post");

        await communityPostSaveRepository.delete(postId, userId);
    }

    async listMySavedPosts(userId, { page, limit } = {}) {
        return communityPostSaveRepository.findByUser(userId, { page, limit });
    }
}

module.exports = new CommunityPostService();
