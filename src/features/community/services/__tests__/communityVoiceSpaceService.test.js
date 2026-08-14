/* eslint-env jest */
// Unit tests for CommunityVoiceSpaceService

jest.mock('../../repositories/communityRepository');
jest.mock('../../repositories/communityMemberRepository');
jest.mock('../../repositories/communityVoiceSpaceRepository');
jest.mock('../../repositories/communityVoiceSpaceParticipantRepository');
jest.mock('../../../notifications/services/notificationService');
jest.mock('../voiceSpaceZoomService');

const communityRepository = require('../../repositories/communityRepository');
const communityMemberRepository = require('../../repositories/communityMemberRepository');
const communityVoiceSpaceRepository = require('../../repositories/communityVoiceSpaceRepository');
const communityVoiceSpaceParticipantRepository = require('../../repositories/communityVoiceSpaceParticipantRepository');
const NotificationService = require('../../../notifications/services/notificationService');
const VoiceSpaceZoomService = require('../voiceSpaceZoomService');

// communityVoiceSpaceService exports a singleton instance
const communityVoiceSpaceService = require('../communityVoiceSpaceService');

// ─── Helpers ────────────────────────────────────────────────────────────────

const HOST_ID = 'aaaa0000-0000-0000-0000-000000000001';
const MEMBER_ID = 'bbbb0000-0000-0000-0000-000000000002';
const COMMUNITY_ID = 'cccc0000-0000-0000-0000-000000000003';
const SPACE_ID = 'dddd0000-0000-0000-0000-000000000004';

function makeCommunity(overrides = {}) {
  return { id: COMMUNITY_ID, name: 'Diabetes Support Circle', isActive: true, ...overrides };
}

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

// These services construct `new NotificationService()`/`new VoiceSpaceZoomService()`
// once at module-load time, so the mock instances must be captured now —
// jest.clearAllMocks() in beforeEach wipes .mock.instances.
const mockNotify = NotificationService.mock.instances[0].createNotification;
const mockZoom = VoiceSpaceZoomService.mock.instances[0];

beforeEach(() => {
  jest.clearAllMocks();

  communityRepository.findById = jest.fn().mockResolvedValue(makeCommunity());
  communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'member' });
  communityMemberRepository.findByCommunity = jest.fn().mockResolvedValue([]);

  communityVoiceSpaceRepository.findActiveByCommunity = jest.fn().mockResolvedValue(null);
  communityVoiceSpaceRepository.findById = jest.fn().mockResolvedValue(makeSpace());
  communityVoiceSpaceRepository.findByCommunity = jest.fn().mockResolvedValue({ spaces: [], total: 0, page: 1, limit: 20 });
  communityVoiceSpaceRepository.create = jest.fn().mockResolvedValue(makeSpace());
  communityVoiceSpaceRepository.end = jest.fn().mockResolvedValue(undefined);

  communityVoiceSpaceParticipantRepository.create = jest.fn().mockResolvedValue(undefined);
  communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser = jest.fn().mockResolvedValue(null);
  communityVoiceSpaceParticipantRepository.deactivateAllBySpace = jest.fn().mockResolvedValue(undefined);

  mockNotify.mockReset().mockResolvedValue(null);
  mockZoom.createInstantMeeting.mockReset().mockResolvedValue({
    zoomMeetingId: '123456789', joinUrl: 'https://zoom.us/j/123456789', startUrl: 'https://zoom.us/s/123456789?zak=secret',
  });
  mockZoom.endMeeting.mockReset().mockResolvedValue(undefined);
});

// ============================================================================
// startSpace
// ============================================================================

describe('startSpace', () => {
  test('throws ValidationError when title is missing', async () => {
    await expect(communityVoiceSpaceService.startSpace(COMMUNITY_ID, HOST_ID, '')).rejects.toThrow('title is required');
  });

  test('throws NotFoundError when the community does not exist', async () => {
    communityRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityVoiceSpaceService.startSpace(COMMUNITY_ID, HOST_ID, 'AMA')).rejects.toThrow('Community not found');
  });

  test('throws ForbiddenError when the caller is not an active member', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(null);
    await expect(communityVoiceSpaceService.startSpace(COMMUNITY_ID, HOST_ID, 'AMA')).rejects.toThrow('must be a member');
  });

  test('throws ValidationError when the community already has a live space', async () => {
    communityVoiceSpaceRepository.findActiveByCommunity = jest.fn().mockResolvedValue(makeSpace());
    await expect(communityVoiceSpaceService.startSpace(COMMUNITY_ID, HOST_ID, 'AMA')).rejects.toThrow('already has a live voice space');
  });

  test('creates a Zoom meeting, the space, and a host participant row', async () => {
    await communityVoiceSpaceService.startSpace(COMMUNITY_ID, HOST_ID, 'AMA');

    expect(mockZoom.createInstantMeeting).toHaveBeenCalledWith('AMA');
    expect(communityVoiceSpaceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        community: { id: COMMUNITY_ID },
        host: { id: HOST_ID },
        title: 'AMA',
        status: 'live',
        zoomMeetingId: '123456789',
        joinUrl: 'https://zoom.us/j/123456789',
        hostStartUrl: 'https://zoom.us/s/123456789?zak=secret',
      })
    );
    expect(communityVoiceSpaceParticipantRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ space: { id: SPACE_ID }, user: { id: HOST_ID }, role: 'host', isActive: true })
    );
  });

  test('notifies other active members but not the host', async () => {
    communityMemberRepository.findByCommunity = jest.fn().mockResolvedValue([
      { user: { id: HOST_ID } },
      { user: { id: MEMBER_ID } },
    ]);

    await communityVoiceSpaceService.startSpace(COMMUNITY_ID, HOST_ID, 'AMA');

    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(
      MEMBER_ID,
      'notification',
      expect.stringContaining('voice space'),
      expect.any(Object),
      'community'
    );
  });
});

// ============================================================================
// getSpace
// ============================================================================

describe('getSpace', () => {
  test('throws NotFoundError when the space does not exist', async () => {
    communityVoiceSpaceRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityVoiceSpaceService.getSpace(SPACE_ID, MEMBER_ID)).rejects.toThrow('Voice space not found');
  });

  test('returns myRole/handRaised for an active participant', async () => {
    communityVoiceSpaceParticipantRepository.findActiveBySpaceAndUser = jest.fn().mockResolvedValue({ role: 'speaker', handRaised: false });
    const result = await communityVoiceSpaceService.getSpace(SPACE_ID, MEMBER_ID);
    expect(result).toMatchObject({ myRole: 'speaker', handRaised: false });
  });

  test('returns myRole=null for a non-participant', async () => {
    const result = await communityVoiceSpaceService.getSpace(SPACE_ID, MEMBER_ID);
    expect(result).toMatchObject({ myRole: null, handRaised: false });
  });
});

// ============================================================================
// endSpace
// ============================================================================

describe('endSpace', () => {
  test('throws NotFoundError when the space does not exist', async () => {
    communityVoiceSpaceRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityVoiceSpaceService.endSpace(SPACE_ID, HOST_ID)).rejects.toThrow('Voice space not found');
  });

  test('throws ForbiddenError when the caller is not the host', async () => {
    await expect(communityVoiceSpaceService.endSpace(SPACE_ID, MEMBER_ID)).rejects.toThrow('Only the host can end');
  });

  test('throws ValidationError when the space has already ended', async () => {
    communityVoiceSpaceRepository.findById = jest.fn().mockResolvedValue(makeSpace({ status: 'ended' }));
    await expect(communityVoiceSpaceService.endSpace(SPACE_ID, HOST_ID)).rejects.toThrow('already ended');
  });

  test('ends the Zoom meeting, marks the space ended, and deactivates all participants', async () => {
    await communityVoiceSpaceService.endSpace(SPACE_ID, HOST_ID);

    expect(mockZoom.endMeeting).toHaveBeenCalledWith('123456789');
    expect(communityVoiceSpaceRepository.end).toHaveBeenCalledWith(SPACE_ID);
    expect(communityVoiceSpaceParticipantRepository.deactivateAllBySpace).toHaveBeenCalledWith(SPACE_ID);
  });
});
