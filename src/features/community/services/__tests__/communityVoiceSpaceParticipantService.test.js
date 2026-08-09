/* eslint-env jest */
// Unit tests for CommunityVoiceSpaceParticipantService.
//
// communityVoiceSpaceService is NOT mocked here — leaveSpace() delegates to its
// real endSpace() when the leaver is the host, and since that service's own
// dependencies (repositories, NotificationService, VoiceSpaceZoomService) are
// mocked below too, the delegation exercises real interaction, not a stub.

jest.mock('../../repositories/communityMemberRepository');
jest.mock('../../repositories/communityRepository');
jest.mock('../../repositories/communityVoiceSpaceRepository');
jest.mock('../../repositories/communityVoiceSpaceParticipantRepository');
jest.mock('../../../notifications/services/notificationService');
jest.mock('../voiceSpaceZoomService');

const communityMemberRepository = require('../../repositories/communityMemberRepository');
const communityVoiceSpaceRepository = require('../../repositories/communityVoiceSpaceRepository');
const communityVoiceSpaceParticipantRepository = require('../../repositories/communityVoiceSpaceParticipantRepository');
const NotificationService = require('../../../notifications/services/notificationService');
const VoiceSpaceZoomService = require('../voiceSpaceZoomService');

// communityVoiceSpaceParticipantService exports a singleton instance
const communityVoiceSpaceParticipantService = require('../communityVoiceSpaceParticipantService');

// ─── Helpers ────────────────────────────────────────────────────────────────

const HOST_ID = 'aaaa0000-0000-0000-0000-000000000001';
const MEMBER_ID = 'bbbb0000-0000-0000-0000-000000000002';
const OTHER_MEMBER_ID = 'cccc0000-0000-0000-0000-000000000003';
const COMMUNITY_ID = 'dddd0000-0000-0000-0000-000000000004';
const SPACE_ID = 'eeee0000-0000-0000-0000-000000000005';

function makeSpace(overrides = {}) {
  return {
    id: SPACE_ID,
    title: 'Ask Me Anything',
    status: 'live',
    zoomMeetingId: '123456789',
    community: { id: COMMUNITY_ID },
    host: { id: HOST_ID },
    ...overrides,
  };
}

function makeParticipant(overrides = {}) {
  return { id: 'ffff0000-0000-0000-0000-000000000006', role: 'listener', handRaised: false, isActive: true, ...overrides };
}

// NOTE: this file's own top-level `require("./communityVoiceSpaceService")` runs
// (and fully evaluates) BEFORE this module's own `new NotificationService()` call,
// so instances[0] belongs to the transitively-loaded real communityVoiceSpaceService
// and instances[1] is the one communityVoiceSpaceParticipantService itself uses.
const mockNotify = NotificationService.mock.instances[1].createNotification;
const mockZoom = VoiceSpaceZoomService.mock.instances[0];

beforeEach(() => {
  jest.clearAllMocks();

  communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'member' });

  communityVoiceSpaceRepository.findById = jest.fn().mockResolvedValue(makeSpace());
  communityVoiceSpaceRepository.end = jest.fn().mockResolvedValue(undefined);

  communityVoiceSpaceParticipantRepository.findBySpaceAndUser = jest.fn().mockResolvedValue(null);
  communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser = jest.fn().mockResolvedValue(null);
  communityVoiceSpaceParticipantRepository.create = jest.fn().mockResolvedValue(undefined);
  communityVoiceSpaceParticipantRepository.activate = jest.fn().mockResolvedValue(undefined);
  communityVoiceSpaceParticipantRepository.deactivate = jest.fn().mockResolvedValue(undefined);
  communityVoiceSpaceParticipantRepository.deactivateAllBySpace = jest.fn().mockResolvedValue(undefined);
  communityVoiceSpaceParticipantRepository.setHandRaised = jest.fn().mockResolvedValue(undefined);
  communityVoiceSpaceParticipantRepository.updateRole = jest.fn().mockResolvedValue(undefined);
  communityVoiceSpaceParticipantRepository.findBySpace = jest.fn().mockResolvedValue([]);

  mockNotify.mockReset().mockResolvedValue(null);
  mockZoom.endMeeting.mockReset().mockResolvedValue(undefined);
});

// ============================================================================
// joinSpace
// ============================================================================

describe('joinSpace', () => {
  test('throws NotFoundError when the space does not exist', async () => {
    communityVoiceSpaceRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityVoiceSpaceParticipantService.joinSpace(SPACE_ID, MEMBER_ID)).rejects.toThrow('Voice space not found');
  });

  test('throws ValidationError when the space has ended', async () => {
    communityVoiceSpaceRepository.findById = jest.fn().mockResolvedValue(makeSpace({ status: 'ended' }));
    await expect(communityVoiceSpaceParticipantService.joinSpace(SPACE_ID, MEMBER_ID)).rejects.toThrow('already ended');
  });

  test('throws ForbiddenError when the caller is not an active community member', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(null);
    await expect(communityVoiceSpaceParticipantService.joinSpace(SPACE_ID, MEMBER_ID)).rejects.toThrow('must be a member');
  });

  test('throws ValidationError when already an active participant', async () => {
    communityVoiceSpaceParticipantRepository.findBySpaceAndUser = jest.fn().mockResolvedValue(makeParticipant({ isActive: true }));
    await expect(communityVoiceSpaceParticipantService.joinSpace(SPACE_ID, MEMBER_ID)).rejects.toThrow('already joined');
  });

  test('reactivates a previously-left participant row', async () => {
    communityVoiceSpaceParticipantRepository.findBySpaceAndUser = jest.fn().mockResolvedValue(makeParticipant({ id: 'p1', isActive: false }));

    await communityVoiceSpaceParticipantService.joinSpace(SPACE_ID, MEMBER_ID);

    expect(communityVoiceSpaceParticipantRepository.activate).toHaveBeenCalledWith('p1', { role: 'listener' });
    expect(communityVoiceSpaceParticipantRepository.create).not.toHaveBeenCalled();
  });

  test('creates a new listener row', async () => {
    await communityVoiceSpaceParticipantService.joinSpace(SPACE_ID, MEMBER_ID);

    expect(communityVoiceSpaceParticipantRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ space: { id: SPACE_ID }, user: { id: MEMBER_ID }, role: 'listener', isActive: true })
    );
  });
});

// ============================================================================
// leaveSpace
// ============================================================================

describe('leaveSpace', () => {
  test('throws NotFoundError when not in the space', async () => {
    await expect(communityVoiceSpaceParticipantService.leaveSpace(SPACE_ID, MEMBER_ID)).rejects.toThrow('You are not in this voice space');
  });

  test('deactivates a listener without ending the space', async () => {
    communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser = jest.fn().mockResolvedValue(makeParticipant({ id: 'p1', role: 'listener' }));

    await communityVoiceSpaceParticipantService.leaveSpace(SPACE_ID, MEMBER_ID);

    expect(communityVoiceSpaceParticipantRepository.deactivate).toHaveBeenCalledWith('p1');
    expect(communityVoiceSpaceRepository.end).not.toHaveBeenCalled();
  });

  test('ends the space when the host leaves', async () => {
    communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser = jest.fn().mockResolvedValue(makeParticipant({ id: 'p1', role: 'host' }));

    await communityVoiceSpaceParticipantService.leaveSpace(SPACE_ID, HOST_ID);

    expect(communityVoiceSpaceParticipantRepository.deactivate).toHaveBeenCalledWith('p1');
    expect(mockZoom.endMeeting).toHaveBeenCalledWith('123456789');
    expect(communityVoiceSpaceRepository.end).toHaveBeenCalledWith(SPACE_ID);
    expect(communityVoiceSpaceParticipantRepository.deactivateAllBySpace).toHaveBeenCalledWith(SPACE_ID);
  });
});

// ============================================================================
// requestToSpeak
// ============================================================================

describe('requestToSpeak', () => {
  test('throws NotFoundError when not in the space', async () => {
    await expect(communityVoiceSpaceParticipantService.requestToSpeak(SPACE_ID, MEMBER_ID)).rejects.toThrow('You are not in this voice space');
  });

  test('throws ValidationError for a non-listener', async () => {
    communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser = jest.fn().mockResolvedValue(makeParticipant({ role: 'speaker' }));
    await expect(communityVoiceSpaceParticipantService.requestToSpeak(SPACE_ID, MEMBER_ID)).rejects.toThrow('Only listeners can request to speak');
  });

  test('raises the hand and notifies the host', async () => {
    communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser = jest.fn().mockResolvedValue(makeParticipant({ id: 'p1', role: 'listener' }));

    await communityVoiceSpaceParticipantService.requestToSpeak(SPACE_ID, MEMBER_ID);

    expect(communityVoiceSpaceParticipantRepository.setHandRaised).toHaveBeenCalledWith('p1', true);
    expect(mockNotify).toHaveBeenCalledWith(
      HOST_ID,
      'notification',
      expect.stringContaining('raised their hand'),
      expect.any(Object),
      'community'
    );
  });
});

// ============================================================================
// promoteToSpeaker / demoteToListener
// ============================================================================

describe('promoteToSpeaker', () => {
  test('throws ForbiddenError when the caller is not the host', async () => {
    await expect(
      communityVoiceSpaceParticipantService.promoteToSpeaker(SPACE_ID, OTHER_MEMBER_ID, MEMBER_ID)
    ).rejects.toThrow('Only the host');
  });

  test('throws NotFoundError when the target is not in the space', async () => {
    await expect(
      communityVoiceSpaceParticipantService.promoteToSpeaker(SPACE_ID, OTHER_MEMBER_ID, HOST_ID)
    ).rejects.toThrow('not in this voice space');
  });

  test('throws ValidationError when the target is already a speaker', async () => {
    communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser = jest.fn().mockResolvedValue(makeParticipant({ role: 'speaker' }));
    await expect(
      communityVoiceSpaceParticipantService.promoteToSpeaker(SPACE_ID, OTHER_MEMBER_ID, HOST_ID)
    ).rejects.toThrow('already a speaker');
  });

  test('promotes a listener to speaker', async () => {
    communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser = jest.fn().mockResolvedValue(makeParticipant({ id: 'p1', role: 'listener' }));

    await communityVoiceSpaceParticipantService.promoteToSpeaker(SPACE_ID, OTHER_MEMBER_ID, HOST_ID);

    expect(communityVoiceSpaceParticipantRepository.updateRole).toHaveBeenCalledWith('p1', 'speaker');
  });
});

describe('demoteToListener', () => {
  test('throws ForbiddenError when the caller is not the host', async () => {
    await expect(
      communityVoiceSpaceParticipantService.demoteToListener(SPACE_ID, OTHER_MEMBER_ID, MEMBER_ID)
    ).rejects.toThrow('Only the host');
  });

  test('throws ValidationError when the target is not currently a speaker', async () => {
    communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser = jest.fn().mockResolvedValue(makeParticipant({ role: 'listener' }));
    await expect(
      communityVoiceSpaceParticipantService.demoteToListener(SPACE_ID, OTHER_MEMBER_ID, HOST_ID)
    ).rejects.toThrow('not currently a speaker');
  });

  test('demotes a speaker back to listener', async () => {
    communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser = jest.fn().mockResolvedValue(makeParticipant({ id: 'p1', role: 'speaker' }));

    await communityVoiceSpaceParticipantService.demoteToListener(SPACE_ID, OTHER_MEMBER_ID, HOST_ID);

    expect(communityVoiceSpaceParticipantRepository.updateRole).toHaveBeenCalledWith('p1', 'listener');
  });
});

// ============================================================================
// listParticipants
// ============================================================================

describe('listParticipants', () => {
  test('throws NotFoundError when the space does not exist', async () => {
    communityVoiceSpaceRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityVoiceSpaceParticipantService.listParticipants(SPACE_ID, MEMBER_ID)).rejects.toThrow('Voice space not found');
  });

  test('throws ForbiddenError for a non-member', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(null);
    await expect(communityVoiceSpaceParticipantService.listParticipants(SPACE_ID, MEMBER_ID)).rejects.toThrow('must be a member');
  });

  test('returns the participant list for a member', async () => {
    communityVoiceSpaceParticipantRepository.findBySpace = jest.fn().mockResolvedValue([makeParticipant()]);
    const result = await communityVoiceSpaceParticipantService.listParticipants(SPACE_ID, MEMBER_ID);
    expect(result).toHaveLength(1);
  });
});
