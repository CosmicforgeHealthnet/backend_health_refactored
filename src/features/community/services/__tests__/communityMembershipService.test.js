/* eslint-env jest */
// Unit tests for CommunityMembershipService

jest.mock('../../repositories/communityRepository');
jest.mock('../../repositories/communityMemberRepository');
jest.mock('../../repositories/communityJoinRequestRepository');
jest.mock('../../../notifications/services/notificationService');
jest.mock('../../../chat/services/chatRoomService');

const communityRepository = require('../../repositories/communityRepository');
const communityMemberRepository = require('../../repositories/communityMemberRepository');
const communityJoinRequestRepository = require('../../repositories/communityJoinRequestRepository');
const NotificationService = require('../../../notifications/services/notificationService');
const ChatService = require('../../../chat/services/chatRoomService');

// communityMembershipService exports a singleton instance
const communityMembershipService = require('../communityMembershipService');

// ─── Helpers ────────────────────────────────────────────────────────────────

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const OWNER_ID = 'bbbb0000-0000-0000-0000-000000000002';
const COMMUNITY_ID = 'cccc0000-0000-0000-0000-000000000003';
const REQUEST_ID = 'dddd0000-0000-0000-0000-000000000004';
const CHAT_ROOM_ID = 'ffff0000-0000-0000-0000-000000000006';

function makeCommunity(overrides = {}) {
  return {
    id: COMMUNITY_ID,
    name: 'Diabetes Support Circle',
    privacyType: 'public',
    isActive: true,
    chatRoom: { id: CHAT_ROOM_ID },
    ...overrides,
  };
}

function makeMembership(overrides = {}) {
  return { id: 'eeee0000-0000-0000-0000-000000000005', role: 'member', isActive: true, ...overrides };
}

function makeJoinRequest(overrides = {}) {
  return {
    id: REQUEST_ID,
    status: 'pending',
    community: makeCommunity({ privacyType: 'private' }),
    user: { id: USER_ID },
    ...overrides,
  };
}

// The service constructs `new NotificationService()`/`new ChatService()` once at
// module-load time, so the mock instances must be captured now — jest.clearAllMocks()
// in beforeEach wipes .mock.instances, and no further instances are ever created.
const mockNotify = NotificationService.mock.instances[0].createNotification;
const mockChatService = ChatService.mock.instances[0];

beforeEach(() => {
  jest.clearAllMocks();

  communityRepository.findById = jest.fn().mockResolvedValue(makeCommunity());
  communityRepository.incrementMemberCount = jest.fn().mockResolvedValue(undefined);
  communityRepository.decrementMemberCount = jest.fn().mockResolvedValue(undefined);

  communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue(null);
  communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(null);
  communityMemberRepository.create = jest.fn().mockResolvedValue(makeMembership());
  communityMemberRepository.activate = jest.fn().mockResolvedValue(undefined);
  communityMemberRepository.deactivate = jest.fn().mockResolvedValue(undefined);
  communityMemberRepository.delete = jest.fn().mockResolvedValue(undefined);
  communityMemberRepository.updateRole = jest.fn().mockResolvedValue(undefined);
  communityMemberRepository.findByCommunity = jest.fn().mockResolvedValue([]);

  communityRepository.softDelete = jest.fn().mockResolvedValue(undefined);

  communityJoinRequestRepository.findPendingByUserAndCommunity = jest.fn().mockResolvedValue(null);
  communityJoinRequestRepository.create = jest.fn().mockResolvedValue(makeJoinRequest());
  communityJoinRequestRepository.findById = jest.fn().mockResolvedValue(makeJoinRequest());
  communityJoinRequestRepository.updateStatus = jest.fn().mockResolvedValue(undefined);

  mockNotify.mockReset().mockResolvedValue(null);

  mockChatService.addParticipant.mockReset().mockResolvedValue(undefined);
  mockChatService.removeParticipant.mockReset().mockResolvedValue(undefined);
  mockChatService.updateParticipantRole.mockReset().mockResolvedValue(undefined);
});

// ============================================================================
// joinCommunity (public communities — instant)
// ============================================================================

describe('joinCommunity', () => {
  test('throws NotFoundError when community does not exist', async () => {
    communityRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityMembershipService.joinCommunity(COMMUNITY_ID, USER_ID)).rejects.toThrow('Community not found');
  });

  test('throws ValidationError for a private community', async () => {
    communityRepository.findById = jest.fn().mockResolvedValue(makeCommunity({ privacyType: 'private' }));
    await expect(communityMembershipService.joinCommunity(COMMUNITY_ID, USER_ID)).rejects.toThrow(
      'submit a join request instead'
    );
  });

  test('throws ValidationError when already an active member', async () => {
    communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ isActive: true }));
    await expect(communityMembershipService.joinCommunity(COMMUNITY_ID, USER_ID)).rejects.toThrow(
      'already a member'
    );
  });

  test('reactivates a previously-left membership instead of creating a duplicate row', async () => {
    communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ isActive: false }));

    await communityMembershipService.joinCommunity(COMMUNITY_ID, USER_ID);

    expect(communityMemberRepository.activate).toHaveBeenCalledWith(expect.any(String), { role: 'member' });
    expect(communityMemberRepository.create).not.toHaveBeenCalled();
    expect(communityRepository.incrementMemberCount).toHaveBeenCalledWith(COMMUNITY_ID);
  });

  test('creates a new member row and increments the member count', async () => {
    await communityMembershipService.joinCommunity(COMMUNITY_ID, USER_ID);

    expect(communityMemberRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ community: { id: COMMUNITY_ID }, user: { id: USER_ID }, role: 'member', isActive: true })
    );
    expect(communityRepository.incrementMemberCount).toHaveBeenCalledWith(COMMUNITY_ID);
  });

  test('grants chat access on join', async () => {
    await communityMembershipService.joinCommunity(COMMUNITY_ID, USER_ID);
    expect(mockChatService.addParticipant).toHaveBeenCalledWith(CHAT_ROOM_ID, USER_ID, 'member', USER_ID);
  });

  test('a hiccup syncing chat access does not fail the join', async () => {
    mockChatService.addParticipant.mockRejectedValue(new Error('Room is full'));
    await expect(communityMembershipService.joinCommunity(COMMUNITY_ID, USER_ID)).resolves.toBeDefined();
  });
});

// ============================================================================
// requestToJoin (private communities)
// ============================================================================

describe('requestToJoin', () => {
  beforeEach(() => {
    communityRepository.findById = jest.fn().mockResolvedValue(makeCommunity({ privacyType: 'private' }));
  });

  test('throws ValidationError for a public community', async () => {
    communityRepository.findById = jest.fn().mockResolvedValue(makeCommunity({ privacyType: 'public' }));
    await expect(communityMembershipService.requestToJoin(COMMUNITY_ID, USER_ID, 'hi')).rejects.toThrow(
      'join directly instead'
    );
  });

  test('throws ValidationError when already an active member', async () => {
    communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ isActive: true }));
    await expect(communityMembershipService.requestToJoin(COMMUNITY_ID, USER_ID, 'hi')).rejects.toThrow(
      'already a member'
    );
  });

  test('throws ValidationError when a pending request already exists', async () => {
    communityJoinRequestRepository.findPendingByUserAndCommunity = jest.fn().mockResolvedValue(makeJoinRequest());
    await expect(communityMembershipService.requestToJoin(COMMUNITY_ID, USER_ID, 'hi')).rejects.toThrow(
      'already have a pending join request'
    );
  });

  test('creates a pending member row and a join request, then notifies owners/admins', async () => {
    communityMemberRepository.findByCommunity = jest.fn().mockResolvedValue([
      { user: { id: OWNER_ID }, role: 'owner' },
    ]);

    await communityMembershipService.requestToJoin(COMMUNITY_ID, USER_ID, 'let me in');

    expect(communityMemberRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ community: { id: COMMUNITY_ID }, user: { id: USER_ID }, role: 'pending_member', isActive: false })
    );
    expect(communityJoinRequestRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ community: { id: COMMUNITY_ID }, user: { id: USER_ID }, message: 'let me in', status: 'pending' })
    );
    expect(communityMemberRepository.findByCommunity).toHaveBeenCalledWith(COMMUNITY_ID, { role: ['owner', 'admin'] });
    expect(mockNotify).toHaveBeenCalledWith(
      OWNER_ID,
      'notification',
      expect.stringContaining('requested to join'),
      expect.any(Object),
      'community'
    );
    expect(mockChatService.addParticipant).not.toHaveBeenCalled();
  });

  test('does not create a duplicate member row when a leftover inactive membership already exists', async () => {
    communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ isActive: false }));

    await communityMembershipService.requestToJoin(COMMUNITY_ID, USER_ID, 'hi');

    expect(communityMemberRepository.create).not.toHaveBeenCalled();
    expect(communityJoinRequestRepository.create).toHaveBeenCalled();
  });
});

// ============================================================================
// approveJoinRequest / rejectJoinRequest
// ============================================================================

describe('approveJoinRequest', () => {
  test('throws NotFoundError when the request does not exist or is not pending', async () => {
    communityJoinRequestRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityMembershipService.approveJoinRequest(REQUEST_ID, OWNER_ID)).rejects.toThrow(
      'Join request not found'
    );

    communityJoinRequestRepository.findById = jest.fn().mockResolvedValue(makeJoinRequest({ status: 'approved' }));
    await expect(communityMembershipService.approveJoinRequest(REQUEST_ID, OWNER_ID)).rejects.toThrow(
      'Join request not found'
    );
  });

  test('activates an existing member row, increments count, marks the request approved, and notifies the requester', async () => {
    communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ isActive: false }));

    await communityMembershipService.approveJoinRequest(REQUEST_ID, OWNER_ID);

    expect(communityMemberRepository.activate).toHaveBeenCalledWith(expect.any(String), { role: 'member' });
    expect(communityMemberRepository.create).not.toHaveBeenCalled();
    expect(communityRepository.incrementMemberCount).toHaveBeenCalledWith(COMMUNITY_ID);
    expect(communityJoinRequestRepository.updateStatus).toHaveBeenCalledWith(REQUEST_ID, 'approved', {
      reviewedBy: { id: OWNER_ID },
    });
    expect(mockNotify).toHaveBeenCalledWith(
      USER_ID,
      'notification',
      expect.stringContaining('approved'),
      expect.any(Object),
      'community'
    );
    expect(mockChatService.addParticipant).toHaveBeenCalledWith(CHAT_ROOM_ID, USER_ID, 'member', USER_ID);
  });

  test('creates a member row when none exists yet', async () => {
    communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue(null);

    await communityMembershipService.approveJoinRequest(REQUEST_ID, OWNER_ID);

    expect(communityMemberRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'member', isActive: true })
    );
  });
});

describe('rejectJoinRequest', () => {
  test('throws NotFoundError when the request does not exist or is not pending', async () => {
    communityJoinRequestRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityMembershipService.rejectJoinRequest(REQUEST_ID, OWNER_ID, 'no')).rejects.toThrow(
      'Join request not found'
    );
  });

  test('deletes the leftover inactive member row, marks the request rejected, and notifies the requester', async () => {
    communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ id: 'member-id', isActive: false }));

    await communityMembershipService.rejectJoinRequest(REQUEST_ID, OWNER_ID, 'not a fit');

    expect(communityMemberRepository.delete).toHaveBeenCalledWith('member-id');
    expect(communityJoinRequestRepository.updateStatus).toHaveBeenCalledWith(REQUEST_ID, 'rejected', {
      reviewedBy: { id: OWNER_ID },
      rejectionReason: 'not a fit',
    });
    expect(mockNotify).toHaveBeenCalledWith(
      USER_ID,
      'notification',
      expect.stringContaining('declined'),
      expect.any(Object),
      'community'
    );
    expect(mockChatService.addParticipant).not.toHaveBeenCalled();
  });

  test('does not delete an already-active member row', async () => {
    communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ isActive: true }));

    await communityMembershipService.rejectJoinRequest(REQUEST_ID, OWNER_ID, 'no');

    expect(communityMemberRepository.delete).not.toHaveBeenCalled();
  });
});

// ============================================================================
// leaveCommunity / removeMember / promoteMember
// ============================================================================

describe('leaveCommunity', () => {
  test('throws NotFoundError when not a member', async () => {
    await expect(communityMembershipService.leaveCommunity(COMMUNITY_ID, USER_ID)).rejects.toThrow(
      'You are not a member'
    );
  });

  test('deactivates the membership, decrements the member count, and revokes chat access', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ id: 'm1', role: 'member' }));

    const result = await communityMembershipService.leaveCommunity(COMMUNITY_ID, USER_ID);

    expect(communityMemberRepository.deactivate).toHaveBeenCalledWith('m1');
    expect(communityRepository.decrementMemberCount).toHaveBeenCalledWith(COMMUNITY_ID);
    expect(mockChatService.removeParticipant).toHaveBeenCalledWith(CHAT_ROOM_ID, USER_ID);
    expect(result).toEqual({ newOwner: null, communityDeleted: false });
  });

  test('an owner leaving promotes the longest-standing admin to owner over moderators/members', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ id: 'owner-m', role: 'owner' }));
    communityMemberRepository.findByCommunity = jest.fn().mockResolvedValue([
      { id: 'mod-m', role: 'moderator', user: { id: 'mod-user' }, joinedAt: '2026-01-01T00:00:00Z' },
      { id: 'admin-m', role: 'admin', user: { id: 'admin-user' }, joinedAt: '2026-02-01T00:00:00Z' },
      { id: 'member-m', role: 'member', user: { id: 'member-user' }, joinedAt: '2026-01-01T00:00:00Z' },
    ]);

    const result = await communityMembershipService.leaveCommunity(COMMUNITY_ID, OWNER_ID);

    expect(communityMemberRepository.updateRole).toHaveBeenCalledWith('admin-m', 'owner');
    expect(mockChatService.updateParticipantRole).toHaveBeenCalledWith(CHAT_ROOM_ID, 'admin-user', 'admin', OWNER_ID);
    expect(mockNotify).toHaveBeenCalledWith(
      'admin-user',
      'notification',
      expect.stringContaining('now the owner'),
      expect.any(Object),
      'community'
    );
    expect(communityMemberRepository.deactivate).toHaveBeenCalledWith('owner-m');
    expect(result).toEqual({ newOwner: { id: 'admin-user', role: 'owner' }, communityDeleted: false });
  });

  test('an owner leaving with no admins promotes the earliest-joined moderator over members', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ id: 'owner-m', role: 'owner' }));
    communityMemberRepository.findByCommunity = jest.fn().mockResolvedValue([
      { id: 'member-m', role: 'member', user: { id: 'member-user' }, joinedAt: '2026-01-01T00:00:00Z' },
      { id: 'mod-m', role: 'moderator', user: { id: 'mod-user' }, joinedAt: '2026-03-01T00:00:00Z' },
    ]);

    const result = await communityMembershipService.leaveCommunity(COMMUNITY_ID, OWNER_ID);

    expect(communityMemberRepository.updateRole).toHaveBeenCalledWith('mod-m', 'owner');
    expect(result.newOwner).toEqual({ id: 'mod-user', role: 'owner' });
  });

  test('an owner leaving as the last active member closes the community instead of promoting anyone', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ id: 'owner-m', role: 'owner' }));
    communityMemberRepository.findByCommunity = jest.fn().mockResolvedValue([]);

    const result = await communityMembershipService.leaveCommunity(COMMUNITY_ID, OWNER_ID);

    expect(communityRepository.softDelete).toHaveBeenCalledWith(COMMUNITY_ID);
    expect(communityMemberRepository.updateRole).not.toHaveBeenCalled();
    expect(result).toEqual({ newOwner: null, communityDeleted: true });
  });
});

describe('removeMember', () => {
  test('throws ValidationError when removing yourself', async () => {
    await expect(communityMembershipService.removeMember(COMMUNITY_ID, USER_ID, USER_ID)).rejects.toThrow(
      'Use the leave endpoint'
    );
  });

  test('throws NotFoundError when the target is not a member', async () => {
    await expect(communityMembershipService.removeMember(COMMUNITY_ID, USER_ID, OWNER_ID)).rejects.toThrow(
      'Member not found'
    );
  });

  test('throws ForbiddenError when trying to remove the owner', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ role: 'owner' }));
    await expect(communityMembershipService.removeMember(COMMUNITY_ID, USER_ID, OWNER_ID)).rejects.toThrow(
      'owner cannot be removed'
    );
  });

  test('deactivates the target, decrements the member count, and revokes chat access', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ id: 'm2', role: 'member' }));

    await communityMembershipService.removeMember(COMMUNITY_ID, USER_ID, OWNER_ID);

    expect(communityMemberRepository.deactivate).toHaveBeenCalledWith('m2');
    expect(communityRepository.decrementMemberCount).toHaveBeenCalledWith(COMMUNITY_ID);
    expect(mockChatService.removeParticipant).toHaveBeenCalledWith(CHAT_ROOM_ID, USER_ID);
  });
});

describe('promoteMember', () => {
  test('throws ValidationError for an invalid role', async () => {
    await expect(communityMembershipService.promoteMember(COMMUNITY_ID, USER_ID, 'owner', OWNER_ID)).rejects.toThrow(
      'newRole must be one of'
    );
  });

  test('throws ValidationError when changing your own role', async () => {
    await expect(communityMembershipService.promoteMember(COMMUNITY_ID, USER_ID, 'admin', USER_ID)).rejects.toThrow(
      'cannot change your own role'
    );
  });

  test('throws NotFoundError when the target is not a member', async () => {
    await expect(communityMembershipService.promoteMember(COMMUNITY_ID, USER_ID, 'admin', OWNER_ID)).rejects.toThrow(
      'Member not found'
    );
  });

  test("throws ForbiddenError when trying to change the owner's role", async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ role: 'owner' }));
    await expect(communityMembershipService.promoteMember(COMMUNITY_ID, USER_ID, 'admin', OWNER_ID)).rejects.toThrow(
      "owner's role cannot be changed"
    );
  });

  test('updates the role for a valid target member and syncs their chat role', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(makeMembership({ id: 'm3', role: 'member' }));

    await communityMembershipService.promoteMember(COMMUNITY_ID, USER_ID, 'moderator', OWNER_ID);

    expect(communityMemberRepository.updateRole).toHaveBeenCalledWith('m3', 'moderator');
    expect(mockChatService.updateParticipantRole).toHaveBeenCalledWith(CHAT_ROOM_ID, USER_ID, 'moderator', OWNER_ID);
  });
});
