/* eslint-env jest */
// Unit tests for CommunityEventRSVPService

jest.mock('../../repositories/communityEventRepository');
jest.mock('../../repositories/communityEventRSVPRepository');
jest.mock('../../repositories/communityMemberRepository');

const communityEventRepository = require('../../repositories/communityEventRepository');
const communityEventRSVPRepository = require('../../repositories/communityEventRSVPRepository');
const communityMemberRepository = require('../../repositories/communityMemberRepository');

// communityEventRSVPService exports a singleton instance
const communityEventRSVPService = require('../communityEventRSVPService');

// ─── Helpers ────────────────────────────────────────────────────────────────

const OWNER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const MEMBER_ID = 'bbbb0000-0000-0000-0000-000000000002';
const COMMUNITY_ID = 'cccc0000-0000-0000-0000-000000000003';
const EVENT_ID = 'dddd0000-0000-0000-0000-000000000004';

function makeEvent(overrides = {}) {
  return { id: EVENT_ID, status: 'published', community: { id: COMMUNITY_ID }, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();

  communityEventRepository.findById = jest.fn().mockResolvedValue(makeEvent());
  communityEventRepository.incrementGuestCount = jest.fn().mockResolvedValue(undefined);
  communityEventRepository.decrementGuestCount = jest.fn().mockResolvedValue(undefined);

  communityEventRSVPRepository.findByEventAndUser = jest.fn().mockResolvedValue(null);
  communityEventRSVPRepository.create = jest.fn().mockResolvedValue(undefined);
  communityEventRSVPRepository.delete = jest.fn().mockResolvedValue(undefined);
  communityEventRSVPRepository.updateReminder = jest.fn().mockResolvedValue(undefined);
  communityEventRSVPRepository.findByEvent = jest.fn().mockResolvedValue([]);

  communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue(null);
});

// ============================================================================
// rsvp
// ============================================================================

describe('rsvp', () => {
  test('throws NotFoundError when the event does not exist', async () => {
    communityEventRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityEventRSVPService.rsvp(EVENT_ID, MEMBER_ID)).rejects.toThrow('Event not found');
  });

  test('throws ValidationError for a draft event', async () => {
    communityEventRepository.findById = jest.fn().mockResolvedValue(makeEvent({ status: 'draft' }));
    await expect(communityEventRSVPService.rsvp(EVENT_ID, MEMBER_ID)).rejects.toThrow("isn't published yet");
  });

  test('throws ValidationError when already RSVP\'d', async () => {
    communityEventRSVPRepository.findByEventAndUser = jest.fn().mockResolvedValue({ id: 'rsvp-1' });
    await expect(communityEventRSVPService.rsvp(EVENT_ID, MEMBER_ID)).rejects.toThrow("already RSVP'd");
  });

  test('creates the RSVP and increments the guest count', async () => {
    await communityEventRSVPService.rsvp(EVENT_ID, MEMBER_ID);
    expect(communityEventRSVPRepository.create).toHaveBeenCalledWith(EVENT_ID, MEMBER_ID);
    expect(communityEventRepository.incrementGuestCount).toHaveBeenCalledWith(EVENT_ID);
  });
});

// ============================================================================
// cancelRsvp
// ============================================================================

describe('cancelRsvp', () => {
  test('throws NotFoundError when there is no RSVP to cancel', async () => {
    await expect(communityEventRSVPService.cancelRsvp(EVENT_ID, MEMBER_ID)).rejects.toThrow('have not RSVP');
  });

  test('deletes the RSVP and decrements the guest count', async () => {
    communityEventRSVPRepository.findByEventAndUser = jest.fn().mockResolvedValue({ id: 'rsvp-1' });
    await communityEventRSVPService.cancelRsvp(EVENT_ID, MEMBER_ID);
    expect(communityEventRSVPRepository.delete).toHaveBeenCalledWith(EVENT_ID, MEMBER_ID);
    expect(communityEventRepository.decrementGuestCount).toHaveBeenCalledWith(EVENT_ID);
  });
});

// ============================================================================
// setReminder
// ============================================================================

describe('setReminder', () => {
  test('throws ValidationError when the caller has not RSVP\'d', async () => {
    await expect(communityEventRSVPService.setReminder(EVENT_ID, MEMBER_ID, true)).rejects.toThrow(
      'RSVP to this event before setting a reminder'
    );
  });

  test('updates the reminder flag on the existing RSVP', async () => {
    communityEventRSVPRepository.findByEventAndUser = jest.fn().mockResolvedValue({ id: 'rsvp-1' });
    await communityEventRSVPService.setReminder(EVENT_ID, MEMBER_ID, false);
    expect(communityEventRSVPRepository.updateReminder).toHaveBeenCalledWith('rsvp-1', false);
  });
});

// ============================================================================
// listAttendees
// ============================================================================

describe('listAttendees', () => {
  test('throws NotFoundError when the event does not exist', async () => {
    communityEventRepository.findById = jest.fn().mockResolvedValue(null);
    await expect(communityEventRSVPService.listAttendees(EVENT_ID, OWNER_ID)).rejects.toThrow('Event not found');
  });

  test('throws ForbiddenError for a non-manager', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'member' });
    await expect(communityEventRSVPService.listAttendees(EVENT_ID, MEMBER_ID)).rejects.toThrow(
      'Only the community owner or an admin'
    );
  });

  test('returns attendees for a manager', async () => {
    communityMemberRepository.findActiveByUserAndCommunity = jest.fn().mockResolvedValue({ role: 'owner' });
    communityEventRSVPRepository.findByEvent = jest.fn().mockResolvedValue([{ id: 'rsvp-1' }]);

    const result = await communityEventRSVPService.listAttendees(EVENT_ID, OWNER_ID);
    expect(result).toEqual([{ id: 'rsvp-1' }]);
  });
});
