/* eslint-env jest */
// Unit tests for CommunityService

jest.mock('../../repositories/communityRepository');
jest.mock('../../repositories/communityMemberRepository');
jest.mock('../../../chat/services/chatRoomService');

const communityRepository = require('../../repositories/communityRepository');
const communityMemberRepository = require('../../repositories/communityMemberRepository');
const ChatService = require('../../../chat/services/chatRoomService');

// communityService exports a singleton instance
const communityService = require('../communityService');

// The service constructs `new ChatService()` once at module-load time, so the mock
// instance must be captured now — jest.clearAllMocks() in beforeEach wipes
// ChatService.mock.instances, and no further instances are ever created.
const mockChatService = ChatService.mock.instances[0];

// ─── Helpers ────────────────────────────────────────────────────────────────

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const OTHER_USER_ID = 'bbbb0000-0000-0000-0000-000000000002';
const COMMUNITY_ID = 'cccc0000-0000-0000-0000-000000000003';
const CHAT_ROOM_ID = 'eeee0000-0000-0000-0000-000000000005';

function makeCommunity(overrides = {}) {
  return {
    id: COMMUNITY_ID,
    name: 'Diabetes Support Circle',
    slug: 'diabetes-support-circle',
    privacyType: 'public',
    isActive: true,
    memberCount: 1,
    postCount: 0,
    createdBy: { id: USER_ID },
    ...overrides,
  };
}

function makeMembership(overrides = {}) {
  return {
    id: 'dddd0000-0000-0000-0000-000000000004',
    role: 'member',
    isActive: true,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  communityRepository.findBySlug = jest.fn().mockResolvedValue(null);
  communityRepository.create = jest.fn().mockImplementation((data) => Promise.resolve(makeCommunity(data)));
  communityRepository.findById = jest.fn().mockResolvedValue(makeCommunity());
  communityRepository.update = jest.fn().mockResolvedValue(undefined);
  communityRepository.softDelete = jest.fn().mockResolvedValue(undefined);
  communityRepository.findByUser = jest.fn().mockResolvedValue([]);
  communityRepository.findMany = jest.fn().mockResolvedValue({ communities: [], total: 0, page: 1, limit: 20 });

  communityMemberRepository.create = jest.fn().mockResolvedValue(makeMembership({ role: 'owner' }));
  communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue(null);

  mockChatService.createRoom.mockReset().mockResolvedValue({ id: CHAT_ROOM_ID });
});

// ============================================================================
// createCommunity
// ============================================================================

describe('createCommunity', () => {
  test('throws when name is missing', async () => {
    await expect(communityService.createCommunity(USER_ID, {})).rejects.toThrow('name is required');
    expect(communityRepository.create).not.toHaveBeenCalled();
  });

  test('creates a community and an owner membership', async () => {
    const result = await communityService.createCommunity(USER_ID, { name: 'Diabetes Support Circle' });

    expect(communityRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Diabetes Support Circle',
        slug: 'diabetes-support-circle',
        privacyType: 'public',
        memberCount: 1,
        createdBy: { id: USER_ID },
      })
    );
    expect(communityMemberRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        community: { id: COMMUNITY_ID },
        user: { id: USER_ID },
        role: 'owner',
        isActive: true,
      })
    );
    expect(result.slug).toBe('diabetes-support-circle');
  });

  test('creates a group chat room for the community and links it back', async () => {
    await communityService.createCommunity(USER_ID, { name: 'Diabetes Support Circle', privacyType: 'private' });

    expect(mockChatService.createRoom).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ type: 'group', isPrivate: true })
    );
    expect(communityRepository.update).toHaveBeenCalledWith(COMMUNITY_ID, { chatRoom: { id: CHAT_ROOM_ID } });
  });

  test('appends a random suffix to the slug when the base slug is already taken', async () => {
    communityRepository.findBySlug = jest.fn().mockResolvedValue(makeCommunity());

    await communityService.createCommunity(USER_ID, { name: 'Diabetes Support Circle' });

    const createCall = communityRepository.create.mock.calls[0][0];
    expect(createCall.slug).toMatch(/^diabetes-support-circle-[0-9a-f]{6}$/);
  });

  test('defaults privacyType to public unless explicitly private', async () => {
    await communityService.createCommunity(USER_ID, { name: 'Test', privacyType: 'private' });
    expect(communityRepository.create).toHaveBeenCalledWith(expect.objectContaining({ privacyType: 'private' }));
  });
});

// ============================================================================
// getCommunityById
// ============================================================================

describe('getCommunityById', () => {
  test('throws NotFoundError when community does not exist', async () => {
    communityRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityService.getCommunityById(COMMUNITY_ID, USER_ID)).rejects.toThrow('Community not found');
  });

  test('throws NotFoundError when community is soft-deleted', async () => {
    communityRepository.findById = jest.fn().mockResolvedValue(makeCommunity({ isActive: false }));
    await expect(communityService.getCommunityById(COMMUNITY_ID, USER_ID)).rejects.toThrow('Community not found');
  });

  test('returns isMember=false and myRole=null for a non-member viewer', async () => {
    const result = await communityService.getCommunityById(COMMUNITY_ID, OTHER_USER_ID);
    expect(result).toMatchObject({ isMember: false, myRole: null, hasPendingRequest: false });
  });

  test('returns isMember=true and myRole for an active member', async () => {
    communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue(
      makeMembership({ role: 'moderator', isActive: true })
    );

    const result = await communityService.getCommunityById(COMMUNITY_ID, USER_ID);
    expect(result).toMatchObject({ isMember: true, myRole: 'moderator', hasPendingRequest: false });
  });

  test('flags hasPendingRequest for an inactive pending_member row', async () => {
    communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue(
      makeMembership({ role: 'pending_member', isActive: false })
    );

    const result = await communityService.getCommunityById(COMMUNITY_ID, USER_ID);
    expect(result).toMatchObject({ isMember: false, myRole: null, hasPendingRequest: true });
  });
});

// ============================================================================
// updateCommunity / deleteCommunity
// ============================================================================

describe('updateCommunity', () => {
  test('throws NotFoundError when community does not exist', async () => {
    communityRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityService.updateCommunity(COMMUNITY_ID, { name: 'New' })).rejects.toThrow('Community not found');
  });

  test('only forwards allowed fields to the repository', async () => {
    await communityService.updateCommunity(COMMUNITY_ID, {
      name: 'New Name',
      memberCount: 999, // not an allowed field — must be ignored
      isActive: false, // not an allowed field — must be ignored
    });

    expect(communityRepository.update).toHaveBeenCalledWith(COMMUNITY_ID, { name: 'New Name' });
  });
});

describe('deleteCommunity', () => {
  test('throws NotFoundError when community does not exist', async () => {
    communityRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityService.deleteCommunity(COMMUNITY_ID)).rejects.toThrow('Community not found');
  });

  test('soft-deletes the community', async () => {
    await communityService.deleteCommunity(COMMUNITY_ID);
    expect(communityRepository.softDelete).toHaveBeenCalledWith(COMMUNITY_ID);
  });
});

// ============================================================================
// listMyCommunities / discoverCommunities
// ============================================================================

describe('discoverCommunities', () => {
  test('excludes the viewer\'s own communities', async () => {
    await communityService.discoverCommunities(USER_ID, { search: 'diabetes', page: 2, limit: 10 });

    expect(communityRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'diabetes', excludeUserId: USER_ID, page: 2, limit: 10 })
    );
  });
});
