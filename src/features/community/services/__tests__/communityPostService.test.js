/* eslint-env jest */
// Unit tests for CommunityPostService

jest.mock('../../repositories/communityRepository');
jest.mock('../../repositories/communityMemberRepository');
jest.mock('../../repositories/communityPostRepository');
jest.mock('../../repositories/communityPostMediaRepository');
jest.mock('../../repositories/communityPostLikeRepository');
jest.mock('../../repositories/communityPostCommentRepository');
jest.mock('../../repositories/communityPostSaveRepository');
jest.mock('../../repositories/communityPostViewRepository');

const communityRepository = require('../../repositories/communityRepository');
const communityMemberRepository = require('../../repositories/communityMemberRepository');
const communityPostRepository = require('../../repositories/communityPostRepository');
const communityPostMediaRepository = require('../../repositories/communityPostMediaRepository');
const communityPostLikeRepository = require('../../repositories/communityPostLikeRepository');
const communityPostCommentRepository = require('../../repositories/communityPostCommentRepository');
const communityPostSaveRepository = require('../../repositories/communityPostSaveRepository');
const communityPostViewRepository = require('../../repositories/communityPostViewRepository');

// communityPostService exports a singleton instance
const communityPostService = require('../communityPostService');

// ─── Helpers ────────────────────────────────────────────────────────────────

const AUTHOR_ID = 'aaaa0000-0000-0000-0000-000000000001';
const OTHER_USER_ID = 'bbbb0000-0000-0000-0000-000000000002';
const COMMUNITY_ID = 'cccc0000-0000-0000-0000-000000000003';
const POST_ID = 'dddd0000-0000-0000-0000-000000000004';
const COMMENT_ID = 'eeee0000-0000-0000-0000-000000000005';

function makePost(overrides = {}) {
  return {
    id: POST_ID,
    content: 'Hello world',
    likeCount: 0,
    commentCount: 0,
    viewCount: 0,
    author: { id: AUTHOR_ID },
    community: { id: COMMUNITY_ID },
    ...overrides,
  };
}

function makeComment(overrides = {}) {
  return { id: COMMENT_ID, content: 'Nice post', author: { id: AUTHOR_ID }, post: { id: POST_ID }, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();

  communityRepository.incrementPostCount = jest.fn().mockResolvedValue(undefined);
  communityRepository.decrementPostCount = jest.fn().mockResolvedValue(undefined);

  communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(null);

  communityMemberRepository.findActiveCommunityIdsByUser = jest.fn().mockResolvedValue([]);

  communityPostRepository.create = jest.fn().mockResolvedValue(makePost());
  communityPostRepository.findById = jest.fn().mockResolvedValue(makePost());
  communityPostRepository.findByCommunities = jest.fn().mockResolvedValue({ posts: [], total: 0, page: 1, limit: 20 });
  communityPostRepository.findByCommunity = jest.fn().mockResolvedValue({ posts: [], total: 0, page: 1, limit: 20 });
  communityPostRepository.softDelete = jest.fn().mockResolvedValue(undefined);
  communityPostRepository.incrementViewCount = jest.fn().mockResolvedValue(undefined);
  communityPostRepository.incrementLikeCount = jest.fn().mockResolvedValue(undefined);
  communityPostRepository.decrementLikeCount = jest.fn().mockResolvedValue(undefined);
  communityPostRepository.incrementCommentCount = jest.fn().mockResolvedValue(undefined);
  communityPostRepository.decrementCommentCount = jest.fn().mockResolvedValue(undefined);

  communityPostMediaRepository.createMany = jest.fn().mockResolvedValue([]);

  communityPostLikeRepository.findByPostAndUser = jest.fn().mockResolvedValue(null);
  communityPostLikeRepository.create = jest.fn().mockResolvedValue(undefined);
  communityPostLikeRepository.delete = jest.fn().mockResolvedValue(undefined);
  communityPostLikeRepository.findLikedPostIdsByUser = jest.fn().mockResolvedValue([]);

  communityPostCommentRepository.create = jest.fn().mockResolvedValue(makeComment());
  communityPostCommentRepository.findById = jest.fn().mockResolvedValue(makeComment());
  communityPostCommentRepository.softDelete = jest.fn().mockResolvedValue(undefined);

  communityPostSaveRepository.findByPostAndUser = jest.fn().mockResolvedValue(null);
  communityPostSaveRepository.create = jest.fn().mockResolvedValue(undefined);
  communityPostSaveRepository.delete = jest.fn().mockResolvedValue(undefined);
  communityPostSaveRepository.findByUser = jest.fn().mockResolvedValue({ saves: [], total: 0, page: 1, limit: 20 });
  communityPostSaveRepository.findSavedPostIdsByUser = jest.fn().mockResolvedValue([]);

  communityPostViewRepository.findByPostAndUser = jest.fn().mockResolvedValue(null);
  communityPostViewRepository.create = jest.fn().mockResolvedValue(undefined);
});

// ============================================================================
// createPost
// ============================================================================

describe('createPost', () => {
  test('throws ValidationError when there is no content and no media', async () => {
    await expect(communityPostService.createPost(COMMUNITY_ID, AUTHOR_ID, {})).rejects.toThrow(
      'needs content or at least one media attachment'
    );
    expect(communityPostRepository.create).not.toHaveBeenCalled();
  });

  test('creates a post from content alone and increments the post count', async () => {
    await communityPostService.createPost(COMMUNITY_ID, AUTHOR_ID, { content: 'hi' });

    expect(communityPostRepository.create).toHaveBeenCalledWith({
      community: { id: COMMUNITY_ID },
      author: { id: AUTHOR_ID },
      content: 'hi',
    });
    expect(communityPostMediaRepository.createMany).not.toHaveBeenCalled();
    expect(communityRepository.incrementPostCount).toHaveBeenCalledWith(COMMUNITY_ID);
  });

  test('creates a media-only post and attaches the media', async () => {
    await communityPostService.createPost(COMMUNITY_ID, AUTHOR_ID, { mediaUrls: ['https://x/img.png'] });

    expect(communityPostMediaRepository.createMany).toHaveBeenCalledWith(POST_ID, ['https://x/img.png']);
  });
});

// ============================================================================
// getPost
// ============================================================================

describe('getPost', () => {
  test('throws NotFoundError when the post does not exist', async () => {
    communityPostRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityPostService.getPost(POST_ID, AUTHOR_ID)).rejects.toThrow('Post not found');
  });

  test('records a view and increments the count the first time this viewer opens the post', async () => {
    communityPostLikeRepository.findByPostAndUser = jest.fn().mockResolvedValue({ id: 'like-1' });
    communityPostSaveRepository.findByPostAndUser = jest.fn().mockResolvedValue(null);

    const result = await communityPostService.getPost(POST_ID, OTHER_USER_ID);

    expect(communityPostViewRepository.create).toHaveBeenCalledWith(POST_ID, OTHER_USER_ID);
    expect(communityPostRepository.incrementViewCount).toHaveBeenCalledWith(POST_ID);
    expect(result).toMatchObject({ isLiked: true, isSaved: false, viewCount: 1 });
  });

  test('does not increment the view count again for a viewer who has already viewed this post', async () => {
    communityPostViewRepository.findByPostAndUser = jest.fn().mockResolvedValue({ id: 'view-1' });

    const result = await communityPostService.getPost(POST_ID, OTHER_USER_ID);

    expect(communityPostViewRepository.create).not.toHaveBeenCalled();
    expect(communityPostRepository.incrementViewCount).not.toHaveBeenCalled();
    expect(result.viewCount).toBe(0);
  });

  test('returns isLiked=false/isSaved=false for an anonymous viewer and does not record a view', async () => {
    const result = await communityPostService.getPost(POST_ID, undefined);
    expect(result).toMatchObject({ isLiked: false, isSaved: false });
    expect(communityPostLikeRepository.findByPostAndUser).not.toHaveBeenCalled();
    expect(communityPostViewRepository.create).not.toHaveBeenCalled();
  });
});

// ============================================================================
// listMyFeed
// ============================================================================

describe('listMyFeed', () => {
  test('resolves the caller\'s joined community ids and fetches posts across them', async () => {
    communityMemberRepository.findActiveCommunityIdsByUser = jest.fn().mockResolvedValue(['c1', 'c2']);
    communityPostRepository.findByCommunities = jest.fn().mockResolvedValue({ posts: [makePost()], total: 1, page: 1, limit: 20 });

    const result = await communityPostService.listMyFeed(AUTHOR_ID, { page: 1, limit: 20 });

    expect(communityMemberRepository.findActiveCommunityIdsByUser).toHaveBeenCalledWith(AUTHOR_ID);
    expect(communityPostRepository.findByCommunities).toHaveBeenCalledWith(['c1', 'c2'], { page: 1, limit: 20 });
    expect(result.posts).toHaveLength(1);
  });

  test('passes an empty array through when the caller has no joined communities', async () => {
    communityMemberRepository.findActiveCommunityIdsByUser = jest.fn().mockResolvedValue([]);

    await communityPostService.listMyFeed(AUTHOR_ID, {});

    expect(communityPostRepository.findByCommunities).toHaveBeenCalledWith([], {});
  });

  test('tags each feed post with isLiked/isSaved for the caller', async () => {
    const post1 = makePost({ id: 'post-1' });
    const post2 = makePost({ id: 'post-2' });
    communityPostRepository.findByCommunities = jest.fn().mockResolvedValue({ posts: [post1, post2], total: 2, page: 1, limit: 20 });
    communityPostLikeRepository.findLikedPostIdsByUser = jest.fn().mockResolvedValue(['post-1']);
    communityPostSaveRepository.findSavedPostIdsByUser = jest.fn().mockResolvedValue(['post-2']);

    const result = await communityPostService.listMyFeed(AUTHOR_ID, { page: 1, limit: 20 });

    expect(communityPostLikeRepository.findLikedPostIdsByUser).toHaveBeenCalledWith(AUTHOR_ID, ['post-1', 'post-2']);
    expect(communityPostSaveRepository.findSavedPostIdsByUser).toHaveBeenCalledWith(AUTHOR_ID, ['post-1', 'post-2']);
    expect(result.posts).toEqual([
      expect.objectContaining({ id: 'post-1', isLiked: true, isSaved: false }),
      expect.objectContaining({ id: 'post-2', isLiked: false, isSaved: true }),
    ]);
  });
});

// ============================================================================
// listCommunityPosts
// ============================================================================

describe('listCommunityPosts', () => {
  test('tags each post with isLiked/isSaved for the viewer', async () => {
    const post1 = makePost({ id: 'post-1' });
    communityPostRepository.findByCommunity = jest.fn().mockResolvedValue({ posts: [post1], total: 1, page: 1, limit: 20 });
    communityPostLikeRepository.findLikedPostIdsByUser = jest.fn().mockResolvedValue(['post-1']);
    communityPostSaveRepository.findSavedPostIdsByUser = jest.fn().mockResolvedValue([]);

    const result = await communityPostService.listCommunityPosts(COMMUNITY_ID, OTHER_USER_ID, { page: 1, limit: 20 });

    expect(communityPostRepository.findByCommunity).toHaveBeenCalledWith(COMMUNITY_ID, { page: 1, limit: 20 });
    expect(communityPostLikeRepository.findLikedPostIdsByUser).toHaveBeenCalledWith(OTHER_USER_ID, ['post-1']);
    expect(result.posts).toEqual([expect.objectContaining({ id: 'post-1', isLiked: true, isSaved: false })]);
  });

  test('returns isLiked=false/isSaved=false for every post when there is no viewer', async () => {
    communityPostRepository.findByCommunity = jest.fn().mockResolvedValue({ posts: [makePost()], total: 1, page: 1, limit: 20 });

    const result = await communityPostService.listCommunityPosts(COMMUNITY_ID, undefined, {});

    expect(communityPostLikeRepository.findLikedPostIdsByUser).not.toHaveBeenCalled();
    expect(result.posts).toEqual([expect.objectContaining({ isLiked: false, isSaved: false })]);
  });
});

// ============================================================================
// recordView
// ============================================================================

describe('recordView', () => {
  test('throws NotFoundError when the post does not exist', async () => {
    communityPostRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityPostService.recordView(POST_ID, OTHER_USER_ID)).rejects.toThrow('Post not found');
    expect(communityPostRepository.incrementViewCount).not.toHaveBeenCalled();
  });

  test('increments the view count and returns the new total on a viewer\'s first view', async () => {
    communityPostRepository.findById = jest.fn().mockResolvedValue(makePost({ viewCount: 4 }));

    const result = await communityPostService.recordView(POST_ID, OTHER_USER_ID);

    expect(communityPostViewRepository.create).toHaveBeenCalledWith(POST_ID, OTHER_USER_ID);
    expect(communityPostRepository.incrementViewCount).toHaveBeenCalledWith(POST_ID);
    expect(result).toEqual({ viewCount: 5 });
  });

  test('does not increment again on a repeat call from the same viewer', async () => {
    communityPostRepository.findById = jest.fn().mockResolvedValue(makePost({ viewCount: 4 }));
    communityPostViewRepository.findByPostAndUser = jest.fn().mockResolvedValue({ id: 'view-1' });

    const result = await communityPostService.recordView(POST_ID, OTHER_USER_ID);

    expect(communityPostViewRepository.create).not.toHaveBeenCalled();
    expect(communityPostRepository.incrementViewCount).not.toHaveBeenCalled();
    expect(result).toEqual({ viewCount: 4 });
  });

  test('a concurrent duplicate insert (unique-constraint race) is swallowed without incrementing twice', async () => {
    communityPostRepository.findById = jest.fn().mockResolvedValue(makePost({ viewCount: 4 }));
    communityPostViewRepository.create = jest.fn().mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    const result = await communityPostService.recordView(POST_ID, OTHER_USER_ID);

    expect(communityPostRepository.incrementViewCount).not.toHaveBeenCalled();
    expect(result).toEqual({ viewCount: 4 });
  });
});

// ============================================================================
// deletePost
// ============================================================================

describe('deletePost', () => {
  test('throws NotFoundError when the post does not exist', async () => {
    communityPostRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityPostService.deletePost(POST_ID, AUTHOR_ID)).rejects.toThrow('Post not found');
  });

  test('allows the author to delete their own post', async () => {
    await communityPostService.deletePost(POST_ID, AUTHOR_ID);

    expect(communityMemberRepository.findActiveByUserAndCommunity).not.toHaveBeenCalled();
    expect(communityPostRepository.softDelete).toHaveBeenCalledWith(POST_ID, AUTHOR_ID);
    expect(communityRepository.decrementPostCount).toHaveBeenCalledWith(COMMUNITY_ID);
  });

  test('throws ForbiddenError for a non-author, non-moderator', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'member' });
    await expect(communityPostService.deletePost(POST_ID, OTHER_USER_ID)).rejects.toThrow('cannot delete this post');
    expect(communityPostRepository.softDelete).not.toHaveBeenCalled();
  });

  test.each(['owner', 'admin', 'moderator'])('allows a %s to delete another member\'s post', async (role) => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role });
    await communityPostService.deletePost(POST_ID, OTHER_USER_ID);
    expect(communityPostRepository.softDelete).toHaveBeenCalledWith(POST_ID, OTHER_USER_ID);
  });
});

// ============================================================================
// like / unlike
// ============================================================================

describe('likePost', () => {
  test('throws NotFoundError when the post does not exist', async () => {
    communityPostRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityPostService.likePost(POST_ID, OTHER_USER_ID)).rejects.toThrow('Post not found');
  });

  test('throws ValidationError when already liked', async () => {
    communityPostLikeRepository.findByPostAndUser = jest.fn().mockResolvedValue({ id: 'like-1' });
    await expect(communityPostService.likePost(POST_ID, OTHER_USER_ID)).rejects.toThrow('already liked');
  });

  test('creates the like and increments the like count', async () => {
    await communityPostService.likePost(POST_ID, OTHER_USER_ID);
    expect(communityPostLikeRepository.create).toHaveBeenCalledWith(POST_ID, OTHER_USER_ID);
    expect(communityPostRepository.incrementLikeCount).toHaveBeenCalledWith(POST_ID);
  });
});

describe('unlikePost', () => {
  test('throws NotFoundError when not currently liked', async () => {
    await expect(communityPostService.unlikePost(POST_ID, OTHER_USER_ID)).rejects.toThrow('have not liked');
  });

  test('deletes the like and decrements the like count', async () => {
    communityPostLikeRepository.findByPostAndUser = jest.fn().mockResolvedValue({ id: 'like-1' });
    await communityPostService.unlikePost(POST_ID, OTHER_USER_ID);
    expect(communityPostLikeRepository.delete).toHaveBeenCalledWith(POST_ID, OTHER_USER_ID);
    expect(communityPostRepository.decrementLikeCount).toHaveBeenCalledWith(POST_ID);
  });
});

// ============================================================================
// comments
// ============================================================================

describe('addComment', () => {
  test('throws ValidationError when content is missing', async () => {
    await expect(communityPostService.addComment(POST_ID, OTHER_USER_ID, {})).rejects.toThrow('content is required');
  });

  test('throws NotFoundError when the post does not exist', async () => {
    communityPostRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityPostService.addComment(POST_ID, OTHER_USER_ID, { content: 'hi' })).rejects.toThrow(
      'Post not found'
    );
  });

  test('creates the comment and increments the comment count', async () => {
    await communityPostService.addComment(POST_ID, OTHER_USER_ID, { content: 'hi', parentCommentId: null });

    expect(communityPostCommentRepository.create).toHaveBeenCalledWith({
      post: { id: POST_ID },
      author: { id: OTHER_USER_ID },
      content: 'hi',
      parentComment: null,
    });
    expect(communityPostRepository.incrementCommentCount).toHaveBeenCalledWith(POST_ID);
  });
});

describe('deleteComment', () => {
  test('throws NotFoundError when the comment does not exist or belongs to a different post', async () => {
    communityPostCommentRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityPostService.deleteComment(POST_ID, COMMENT_ID, AUTHOR_ID)).rejects.toThrow(
      'Comment not found'
    );

    communityPostCommentRepository.findById = jest.fn().mockResolvedValue(makeComment({ post: { id: 'other-post' } }));
    await expect(communityPostService.deleteComment(POST_ID, COMMENT_ID, AUTHOR_ID)).rejects.toThrow(
      'Comment not found'
    );
  });

  test('allows the author to delete their own comment', async () => {
    await communityPostService.deleteComment(POST_ID, COMMENT_ID, AUTHOR_ID);
    expect(communityPostCommentRepository.softDelete).toHaveBeenCalledWith(COMMENT_ID);
    expect(communityPostRepository.decrementCommentCount).toHaveBeenCalledWith(POST_ID);
  });

  test('throws ForbiddenError for a non-author, non-moderator', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'member' });
    await expect(communityPostService.deleteComment(POST_ID, COMMENT_ID, OTHER_USER_ID)).rejects.toThrow(
      'cannot delete this comment'
    );
  });

  test('allows a moderator to delete another member\'s comment', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'moderator' });
    await communityPostService.deleteComment(POST_ID, COMMENT_ID, OTHER_USER_ID);
    expect(communityPostCommentRepository.softDelete).toHaveBeenCalledWith(COMMENT_ID);
  });
});

// ============================================================================
// save / unsave
// ============================================================================

describe('savePost', () => {
  test('throws NotFoundError when the post does not exist', async () => {
    communityPostRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityPostService.savePost(POST_ID, OTHER_USER_ID)).rejects.toThrow('Post not found');
  });

  test('throws ValidationError when already saved', async () => {
    communityPostSaveRepository.findByPostAndUser = jest.fn().mockResolvedValue({ id: 'save-1' });
    await expect(communityPostService.savePost(POST_ID, OTHER_USER_ID)).rejects.toThrow('already saved');
  });

  test('creates the save', async () => {
    await communityPostService.savePost(POST_ID, OTHER_USER_ID);
    expect(communityPostSaveRepository.create).toHaveBeenCalledWith(POST_ID, OTHER_USER_ID);
  });
});

describe('unsavePost', () => {
  test('throws NotFoundError when not currently saved', async () => {
    await expect(communityPostService.unsavePost(POST_ID, OTHER_USER_ID)).rejects.toThrow('have not saved');
  });

  test('deletes the save', async () => {
    communityPostSaveRepository.findByPostAndUser = jest.fn().mockResolvedValue({ id: 'save-1' });
    await communityPostService.unsavePost(POST_ID, OTHER_USER_ID);
    expect(communityPostSaveRepository.delete).toHaveBeenCalledWith(POST_ID, OTHER_USER_ID);
  });
});
