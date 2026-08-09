/* eslint-env jest */
// Unit tests for CommunityEventService

jest.mock('../../repositories/communityEventRepository');
jest.mock('../../repositories/communityMemberRepository');
jest.mock('../../repositories/communityEventRSVPRepository');
jest.mock('../../../notifications/services/notificationService');

const communityEventRepository = require('../../repositories/communityEventRepository');
const communityMemberRepository = require('../../repositories/communityMemberRepository');
const communityEventRSVPRepository = require('../../repositories/communityEventRSVPRepository');
const NotificationService = require('../../../notifications/services/notificationService');

// communityEventService exports a singleton instance
const communityEventService = require('../communityEventService');

// ─── Helpers ────────────────────────────────────────────────────────────────

const OWNER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const MEMBER_ID = 'bbbb0000-0000-0000-0000-000000000002';
const COMMUNITY_ID = 'cccc0000-0000-0000-0000-000000000003';
const EVENT_ID = 'dddd0000-0000-0000-0000-000000000004';

function makeEvent(overrides = {}) {
  return {
    id: EVENT_ID,
    title: 'Community Meetup',
    status: 'draft',
    guestCount: 0,
    community: { id: COMMUNITY_ID },
    createdBy: { id: OWNER_ID },
    ...overrides,
  };
}

// The service constructs `new NotificationService()` once at module-load time, so the
// mock instance must be captured now — jest.clearAllMocks() in beforeEach wipes
// NotificationService.mock.instances, and no further instances are ever created.
const mockNotify = NotificationService.mock.instances[0].createNotification;

beforeEach(() => {
  jest.clearAllMocks();

  communityEventRepository.create = jest.fn().mockImplementation((data) => Promise.resolve(makeEvent(data)));
  communityEventRepository.findById = jest.fn().mockResolvedValue(makeEvent());
  communityEventRepository.findByCommunity = jest.fn().mockResolvedValue({ events: [], total: 0, page: 1, limit: 20 });
  communityEventRepository.update = jest.fn().mockResolvedValue(undefined);
  communityEventRepository.softDelete = jest.fn().mockResolvedValue(undefined);

  communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(null);
  communityMemberRepository.findByCommunity = jest.fn().mockResolvedValue([]);

  communityEventRSVPRepository.findByEventAndUser = jest.fn().mockResolvedValue(null);

  mockNotify.mockReset().mockResolvedValue(null);
});

// ============================================================================
// createEvent
// ============================================================================

describe('createEvent', () => {
  test('throws ValidationError when title is missing', async () => {
    await expect(
      communityEventService.createEvent(COMMUNITY_ID, OWNER_ID, { startAt: '2026-09-01T10:00:00Z' })
    ).rejects.toThrow('title is required');
  });

  test('throws ValidationError when startAt is missing or invalid', async () => {
    await expect(
      communityEventService.createEvent(COMMUNITY_ID, OWNER_ID, { title: 'X' })
    ).rejects.toThrow('startAt must be a valid date/time');

    await expect(
      communityEventService.createEvent(COMMUNITY_ID, OWNER_ID, { title: 'X', startAt: 'not-a-date' })
    ).rejects.toThrow('startAt must be a valid date/time');
  });

  test('defaults to draft status and does not notify anyone', async () => {
    await communityEventService.createEvent(COMMUNITY_ID, OWNER_ID, { title: 'Meetup', startAt: '2026-09-01T10:00:00Z' });

    expect(communityEventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft', title: 'Meetup' })
    );
    expect(mockNotify).not.toHaveBeenCalled();
  });

  test('publishes immediately when status is "published" and notifies other active members', async () => {
    communityEventRepository.create = jest.fn().mockResolvedValue(makeEvent({ status: 'published' }));
    communityMemberRepository.findByCommunity = jest.fn().mockResolvedValue([
      { user: { id: OWNER_ID } },
      { user: { id: MEMBER_ID } },
    ]);

    await communityEventService.createEvent(COMMUNITY_ID, OWNER_ID, {
      title: 'Meetup', startAt: '2026-09-01T10:00:00Z', status: 'published',
    });

    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(
      MEMBER_ID,
      'notification',
      expect.stringContaining('Meetup'),
      expect.any(Object),
      'community'
    );
  });
});

// ============================================================================
// getEvent
// ============================================================================

describe('getEvent', () => {
  test('throws NotFoundError when the event does not exist', async () => {
    communityEventRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityEventService.getEvent(EVENT_ID, MEMBER_ID)).rejects.toThrow('Event not found');
  });

  test('throws ForbiddenError when a non-manager views a draft', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'member' });
    await expect(communityEventService.getEvent(EVENT_ID, MEMBER_ID)).rejects.toThrow('not published yet');
  });

  test.each(['owner', 'admin'])('allows a %s to view a draft', async (role) => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role });
    await expect(communityEventService.getEvent(EVENT_ID, OWNER_ID)).resolves.toBeDefined();
  });

  test('returns isGoing/remindMe flags based on the viewer\'s RSVP', async () => {
    communityEventRepository.findById = jest.fn().mockResolvedValue(makeEvent({ status: 'published' }));
    communityEventRSVPRepository.findByEventAndUser = jest.fn().mockResolvedValue({ remindMe: true });

    const result = await communityEventService.getEvent(EVENT_ID, MEMBER_ID);
    expect(result).toMatchObject({ isGoing: true, remindMe: true });
  });

  test('returns isGoing=false for a viewer with no RSVP', async () => {
    communityEventRepository.findById = jest.fn().mockResolvedValue(makeEvent({ status: 'published' }));
    const result = await communityEventService.getEvent(EVENT_ID, MEMBER_ID);
    expect(result).toMatchObject({ isGoing: false, remindMe: false });
  });
});

// ============================================================================
// listCommunityEvents
// ============================================================================

describe('listCommunityEvents', () => {
  test('includes drafts for a manager', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'admin' });
    await communityEventService.listCommunityEvents(COMMUNITY_ID, OWNER_ID, { page: 1, limit: 20 });
    expect(communityEventRepository.findByCommunity).toHaveBeenCalledWith(
      COMMUNITY_ID, expect.objectContaining({ includeDrafts: true })
    );
  });

  test('excludes drafts for a regular member', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'member' });
    await communityEventService.listCommunityEvents(COMMUNITY_ID, MEMBER_ID, { page: 1, limit: 20 });
    expect(communityEventRepository.findByCommunity).toHaveBeenCalledWith(
      COMMUNITY_ID, expect.objectContaining({ includeDrafts: false })
    );
  });
});

// ============================================================================
// updateEvent
// ============================================================================

describe('updateEvent', () => {
  test('throws NotFoundError when the event does not exist', async () => {
    communityEventRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityEventService.updateEvent(EVENT_ID, OWNER_ID, { title: 'X' })).rejects.toThrow('Event not found');
  });

  test('throws ForbiddenError for a non-manager', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'member' });
    await expect(communityEventService.updateEvent(EVENT_ID, MEMBER_ID, { title: 'X' })).rejects.toThrow(
      'Only the community owner or an admin'
    );
  });

  test('only forwards allowed fields', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'owner' });

    await communityEventService.updateEvent(EVENT_ID, OWNER_ID, { title: 'New title', guestCount: 999 });

    expect(communityEventRepository.update).toHaveBeenCalledWith(EVENT_ID, { title: 'New title' });
  });

  test('rejects an invalid status value', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'owner' });
    await expect(
      communityEventService.updateEvent(EVENT_ID, OWNER_ID, { status: 'cancelled' })
    ).rejects.toThrow('status must be draft or published');
  });

  test('notifies members when a draft transitions to published', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'owner' });
    communityMemberRepository.findByCommunity = jest.fn().mockResolvedValue([{ user: { id: MEMBER_ID } }]);
    communityEventRepository.findById = jest
      .fn()
      .mockResolvedValueOnce(makeEvent({ status: 'draft' }))          // _requireManagerAccess lookup
      .mockResolvedValueOnce(makeEvent({ status: 'published' }));     // re-fetch after update

    await communityEventService.updateEvent(EVENT_ID, OWNER_ID, { status: 'published' });

    expect(mockNotify).toHaveBeenCalledTimes(1);
  });

  test('does not re-notify when an already-published event is updated', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'owner' });
    communityEventRepository.findById = jest.fn().mockResolvedValue(makeEvent({ status: 'published' }));

    await communityEventService.updateEvent(EVENT_ID, OWNER_ID, { title: 'Updated' });

    expect(mockNotify).not.toHaveBeenCalled();
  });
});

// ============================================================================
// deleteEvent
// ============================================================================

describe('deleteEvent', () => {
  test('throws ForbiddenError for a non-manager', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'moderator' });
    await expect(communityEventService.deleteEvent(EVENT_ID, MEMBER_ID)).rejects.toThrow(
      'Only the community owner or an admin'
    );
  });

  test('soft-deletes the event for a manager', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'admin' });
    await communityEventService.deleteEvent(EVENT_ID, OWNER_ID);
    expect(communityEventRepository.softDelete).toHaveBeenCalledWith(EVENT_ID);
  });
});
