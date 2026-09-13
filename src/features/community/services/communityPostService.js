const communityRepository = require("../repositories/communityRepository");
const communityMemberRepository = require("../repositories/communityMemberRepository");
const communityPostRepository = require("../repositories/communityPostRepository");
const communityPostMediaRepository = require("../repositories/communityPostMediaRepository");
const communityPostLikeRepository = require("../repositories/communityPostLikeRepository");
const communityPostCommentRepository = require("../repositories/communityPostCommentRepository");
const communityPostSaveRepository = require("../repositories/communityPostSaveRepository");
const communityPostViewRepository = require("../repositories/communityPostViewRepository");
const { NotFoundError, ForbiddenError, ValidationError } = require("../../../shared/utils/errors");

const MODERATOR_ROLES = ["owner", "admin", "moderator"];

// Batch-attaches isLiked/isSaved for a viewer across a page of posts (two queries
// total, not one per post) — the same flags getPost returns for a single post.
async function attachViewerFlags(posts, viewerId) {
    if (!posts.length) return posts;
    if (!viewerId) return posts.map((p) => ({ ...p, isLiked: false, isSaved: false }));

    const postIds = posts.map((p) => p.id);
    const [likedIds, savedIds] = await Promise.all([
        communityPostLikeRepository.findLikedPostIdsByUser(viewerId, postIds),
        communityPostSaveRepository.findSavedPostIdsByUser(viewerId, postIds),
    ]);
    const likedSet = new Set(likedIds);
    const savedSet = new Set(savedIds);

    return posts.map((p) => ({ ...p, isLiked: likedSet.has(p.id), isSaved: savedSet.has(p.id) }));
}

// Caps a post's viewCount to at most one increment per viewer, no matter how many
// times they open the post or ping the view endpoint. Returns whether this call
// was the one that actually counted (so callers can reflect it in their response
// without a second read of the row).
async function recordViewOnce(postId, viewerId) {
    if (!viewerId) return false;

    const existing = await communityPostViewRepository.findByPostAndUser(postId, viewerId);
    if (existing) return false;

    try {
        await communityPostViewRepository.create(postId, viewerId);
    } catch (error) {
        // Unique constraint race — a concurrent request from the same viewer won it first.
        if (!/duplicate key|unique constraint/i.test(error.message)) throw error;
        return false;
    }

    await communityPostRepository.incrementViewCount(postId);
    return true;
}

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

        const wasNewView = await recordViewOnce(postId, viewerId);

        let isLiked = false;
        let isSaved = false;
        if (viewerId) {
            isLiked = !!(await communityPostLikeRepository.findByPostAndUser(postId, viewerId));
            isSaved = !!(await communityPostSaveRepository.findByPostAndUser(postId, viewerId));
        }

        return { ...post, viewCount: post.viewCount + (wasNewView ? 1 : 0), isLiked, isSaved };
    }

    async listCommunityPosts(communityId, viewerId, { page, limit } = {}) {
        const result = await communityPostRepository.findByCommunity(communityId, { page, limit });
        return { ...result, posts: await attachViewerFlags(result.posts, viewerId) };
    }

    async listMyFeed(userId, { page, limit } = {}) {
        const communityIds = await communityMemberRepository.findActiveCommunityIdsByUser(userId);
        const result = await communityPostRepository.findByCommunities(communityIds, { page, limit });
        return { ...result, posts: await attachViewerFlags(result.posts, userId) };
    }

    async recordView(postId, viewerId) {
        const post = await communityPostRepository.findById(postId);
        if (!post) throw new NotFoundError("Post not found");

        const wasNewView = await recordViewOnce(postId, viewerId);
        return { viewCount: post.viewCount + (wasNewView ? 1 : 0) };
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
