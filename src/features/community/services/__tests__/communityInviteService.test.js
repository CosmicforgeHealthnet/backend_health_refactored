/* eslint-env jest */
// Unit tests for CommunityInviteService

jest.mock('../../repositories/communityRepository');
jest.mock('../../repositories/communityMemberRepository');
jest.mock('../../repositories/communityInviteRepository');
jest.mock('../../../notifications/services/notificationService');
jest.mock('../../../chat/services/chatRoomService');

const communityRepository = require('../../repositories/communityRepository');
const communityMemberRepository = require('../../repositories/communityMemberRepository');
const communityInviteRepository = require('../../repositories/communityInviteRepository');
const NotificationService = require('../../../notifications/services/notificationService');
const ChatService = require('../../../chat/services/chatRoomService');

// communityInviteService exports a singleton instance
const communityInviteService = require('../communityInviteService');

// ─── Helpers ────────────────────────────────────────────────────────────────

const SENDER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const INVITEE_ID = 'bbbb0000-0000-0000-0000-000000000002';
const COMMUNITY_ID = 'cccc0000-0000-0000-0000-000000000003';
const INVITE_ID = 'dddd0000-0000-0000-0000-000000000004';
const CHAT_ROOM_ID = 'eeee0000-0000-0000-0000-000000000005';

function makeCommunity(overrides = {}) {
  return { id: COMMUNITY_ID, name: 'Diabetes Support Circle', isActive: true, chatRoom: { id: CHAT_ROOM_ID }, ...overrides };
}

function makeInvite(overrides = {}) {
  return {
    id: INVITE_ID,
    status: 'pending',
    community: makeCommunity(),
    invitedBy: { id: SENDER_ID },
    invitee: { id: INVITEE_ID },
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

  // Sender is always an active member; only sendInvite's invitee-already-member
  // check should see a non-member unless a test explicitly overrides this.
  communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockImplementation((userId) => {
    if (userId === SENDER_ID) return Promise.resolve({ role: 'member' });
    return Promise.resolve(null);
  });
  communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue(null);
  communityMemberRepository.create = jest.fn().mockResolvedValue(undefined);
  communityMemberRepository.activate = jest.fn().mockResolvedValue(undefined);

  communityInviteRepository.searchInvitableUsers = jest.fn().mockResolvedValue([]);
  communityInviteRepository.findSuggestedUsers = jest.fn().mockResolvedValue([]);
  communityInviteRepository.userExists = jest.fn().mockResolvedValue(true);
  communityInviteRepository.findPendingByCommunityAndInvitee = jest.fn().mockResolvedValue(null);
  communityInviteRepository.create = jest.fn().mockResolvedValue(makeInvite());
  communityInviteRepository.findById = jest.fn().mockResolvedValue(makeInvite());
  communityInviteRepository.findByCommunity = jest.fn().mockResolvedValue([]);
  communityInviteRepository.findByInvitee = jest.fn().mockResolvedValue([]);
  communityInviteRepository.updateStatus = jest.fn().mockResolvedValue(undefined);

  mockNotify.mockReset().mockResolvedValue(null);
  mockChatService.addParticipant.mockReset().mockResolvedValue(undefined);
});

// ============================================================================
// searchInvitableUsers / getSuggestedUsers
// ============================================================================

describe('searchInvitableUsers', () => {
  test('throws ForbiddenError when the caller is not an active member', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(null);
    await expect(communityInviteService.searchInvitableUsers(COMMUNITY_ID, SENDER_ID, 'jo')).rejects.toThrow(
      'must be a member'
    );
  });

  test('delegates to the repository', async () => {
    await communityInviteService.searchInvitableUsers(COMMUNITY_ID, SENDER_ID, 'jo', 10);
    expect(communityInviteRepository.searchInvitableUsers).toHaveBeenCalledWith(COMMUNITY_ID, SENDER_ID, 'jo', 10);
  });
});

describe('getSuggestedUsers', () => {
  test('throws ForbiddenError when the caller is not an active member', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(null);
    await expect(communityInviteService.getSuggestedUsers(COMMUNITY_ID, SENDER_ID)).rejects.toThrow('must be a member');
  });

  test('delegates to the repository', async () => {
    await communityInviteService.getSuggestedUsers(COMMUNITY_ID, SENDER_ID, 5);
    expect(communityInviteRepository.findSuggestedUsers).toHaveBeenCalledWith(COMMUNITY_ID, SENDER_ID, 5);
  });
});

// ============================================================================
// sendInvite
// ============================================================================

describe('sendInvite', () => {
  test('throws ValidationError when inviteeId is missing', async () => {
    await expect(communityInviteService.sendInvite(COMMUNITY_ID, SENDER_ID, undefined)).rejects.toThrow(
      'inviteeId is required'
    );
  });

  test('throws ValidationError when inviting yourself', async () => {
    await expect(communityInviteService.sendInvite(COMMUNITY_ID, SENDER_ID, SENDER_ID)).rejects.toThrow(
      'cannot invite yourself'
    );
  });

  test('throws NotFoundError when the community does not exist', async () => {
    communityRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityInviteService.sendInvite(COMMUNITY_ID, SENDER_ID, INVITEE_ID)).rejects.toThrow(
      'Community not found'
    );
  });

  test('throws ForbiddenError when the caller is not an active member', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(null);
    await expect(communityInviteService.sendInvite(COMMUNITY_ID, SENDER_ID, INVITEE_ID)).rejects.toThrow(
      'must be a member'
    );
  });

  test('throws NotFoundError when the invitee does not exist', async () => {
    communityInviteRepository.userExists = jest.fn().mockResolvedValue(false);
    await expect(communityInviteService.sendInvite(COMMUNITY_ID, SENDER_ID, INVITEE_ID)).rejects.toThrow(
      'does not exist'
    );
  });

  test('throws ValidationError when the invitee is already a member', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest
      .fn()
      .mockResolvedValueOnce({ role: 'member' }) // sender check
      .mockResolvedValueOnce({ role: 'member' }); // invitee check
    await expect(communityInviteService.sendInvite(COMMUNITY_ID, SENDER_ID, INVITEE_ID)).rejects.toThrow(
      'already a member'
    );
  });

  test('throws ValidationError when a pending invite already exists', async () => {
    communityInviteRepository.findPendingByCommunityAndInvitee = jest.fn().mockResolvedValue(makeInvite());
    await expect(communityInviteService.sendInvite(COMMUNITY_ID, SENDER_ID, INVITEE_ID)).rejects.toThrow(
      'already has a pending invite'
    );
  });

  test('creates the invite and notifies the invitee', async () => {
    await communityInviteService.sendInvite(COMMUNITY_ID, SENDER_ID, INVITEE_ID, 'come join us');

    expect(communityInviteRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        community: { id: COMMUNITY_ID },
        invitedBy: { id: SENDER_ID },
        invitee: { id: INVITEE_ID },
        message: 'come join us',
        status: 'pending',
      })
    );
    expect(mockNotify).toHaveBeenCalledWith(
      INVITEE_ID,
      'notification',
      expect.stringContaining('invited'),
      expect.any(Object),
      'community'
    );
  });
});

// ============================================================================
// acceptInvite / declineInvite
// ============================================================================

describe('acceptInvite', () => {
  test('throws NotFoundError when the invite does not exist or is not pending', async () => {
    communityInviteRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityInviteService.acceptInvite(INVITE_ID, INVITEE_ID)).rejects.toThrow('Invite not found');

    communityInviteRepository.findById = jest.fn().mockResolvedValue(makeInvite({ status: 'accepted' }));
    await expect(communityInviteService.acceptInvite(INVITE_ID, INVITEE_ID)).rejects.toThrow('Invite not found');
  });

  test('throws ForbiddenError when the caller is not the invitee', async () => {
    await expect(communityInviteService.acceptInvite(INVITE_ID, SENDER_ID)).rejects.toThrow('not addressed to you');
  });

  test('creates a new member row with invitedBy set, increments count, syncs chat, and notifies the sender', async () => {
    await communityInviteService.acceptInvite(INVITE_ID, INVITEE_ID);

    expect(communityMemberRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        community: { id: COMMUNITY_ID },
        user: { id: INVITEE_ID },
        role: 'member',
        isActive: true,
        invitedBy: { id: SENDER_ID },
      })
    );
    expect(communityRepository.incrementMemberCount).toHaveBeenCalledWith(COMMUNITY_ID);
    expect(mockChatService.addParticipant).toHaveBeenCalledWith(CHAT_ROOM_ID, INVITEE_ID, 'member', INVITEE_ID);
    expect(communityInviteRepository.updateStatus).toHaveBeenCalledWith(INVITE_ID, 'accepted');
    expect(mockNotify).toHaveBeenCalledWith(
      SENDER_ID,
      'notification',
      expect.stringContaining('accepted'),
      expect.any(Object),
      'community'
    );
  });

  test('reactivates an existing inactive member row instead of creating a duplicate', async () => {
    communityMemberRepository.findByUserAndCommunity = jest.fn().mockResolvedValue({ id: 'm1', isActive: false });

    await communityInviteService.acceptInvite(INVITE_ID, INVITEE_ID);

    expect(communityMemberRepository.activate).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ role: 'member', invitedBy: { id: SENDER_ID } })
    );
    expect(communityMemberRepository.create).not.toHaveBeenCalled();
  });
});

describe('declineInvite', () => {
  test('throws NotFoundError when the invite does not exist or is not pending', async () => {
    communityInviteRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityInviteService.declineInvite(INVITE_ID, INVITEE_ID)).rejects.toThrow('Invite not found');
  });

  test('throws ForbiddenError when the caller is not the invitee', async () => {
    await expect(communityInviteService.declineInvite(INVITE_ID, SENDER_ID)).rejects.toThrow('not addressed to you');
  });

  test('marks the invite declined', async () => {
    await communityInviteService.declineInvite(INVITE_ID, INVITEE_ID);
    expect(communityInviteRepository.updateStatus).toHaveBeenCalledWith(INVITE_ID, 'declined');
  });
});

// ============================================================================
// cancelInvite
// ============================================================================

describe('cancelInvite', () => {
  test('throws NotFoundError when the invite does not exist or is not pending', async () => {
    communityInviteRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityInviteService.cancelInvite(INVITE_ID, SENDER_ID)).rejects.toThrow('Invite not found');
  });

  test('the original sender can cancel', async () => {
    await communityInviteService.cancelInvite(INVITE_ID, SENDER_ID);
    expect(communityInviteRepository.updateStatus).toHaveBeenCalledWith(INVITE_ID, 'cancelled');
  });

  test('a non-sender, non-manager cannot cancel', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'member' });
    await expect(communityInviteService.cancelInvite(INVITE_ID, INVITEE_ID)).rejects.toThrow(
      'Only the sender or a community owner/admin'
    );
  });

  test('an owner/admin who did not send it can still cancel', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'admin' });
    await communityInviteService.cancelInvite(INVITE_ID, INVITEE_ID);
    expect(communityInviteRepository.updateStatus).toHaveBeenCalledWith(INVITE_ID, 'cancelled');
  });
});
