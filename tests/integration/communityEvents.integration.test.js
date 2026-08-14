/* eslint-env jest */
// Integration tests for the Community Health System Phase 2 Events API.
//
// Real Express app (supertest) + real Postgres (whatever NODE_ENV's .env file
// points at — run via `npm run test:integration`, which sets NODE_ENV=development
// so it targets the shared cosmicforge_test database, not production).

const jwt = require('jsonwebtoken');
const request = require('supertest');

const AppDataSource = require('../../src/config/database');
const { app } = require('../../src/app');

jest.setTimeout(30000);

const RUN_SUFFIX = Date.now().toString(36);

let userRepo;
let ownerToken;
let memberToken;
let member2Token;
let ownerId;
let memberId;
let member2Id;

const createdCommunityIds = [];

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

function mintToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, status: user.status },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

beforeAll(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  userRepo = AppDataSource.getRepository('User');

  const owner = await userRepo.save({
    fullName: 'Integration Test Event Owner',
    email: `community-events-it-owner-${RUN_SUFFIX}@example.test`,
    role: 'doctor',
    status: 'doctor_active',
  });
  const member = await userRepo.save({
    fullName: 'Integration Test Event Member',
    email: `community-events-it-member-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });
  const member2 = await userRepo.save({
    fullName: 'Integration Test Event Member Two',
    email: `community-events-it-member2-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });

  ownerId = owner.id;
  memberId = member.id;
  member2Id = member2.id;

  ownerToken = mintToken(owner);
  memberToken = mintToken(member);
  member2Token = mintToken(member2);
}, 30000);

afterAll(async () => {
  if (createdCommunityIds.length) {
    await AppDataSource.query(`DELETE FROM communities WHERE id = ANY($1::uuid[])`, [createdCommunityIds]);
  }
  if (userRepo) {
    await userRepo.delete([ownerId, memberId, member2Id].filter(Boolean));
  }
  await AppDataSource.destroy();
}, 30000);

function futureIso(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

describe('community events flow', () => {
  let communityId;
  let eventId;

  test('setup: owner creates a community, two members join', async () => {
    const createRes = await request(app)
      .post('/api/community/communities')
      .set(authHeader(ownerToken))
      .send({ name: `IT Events Circle ${RUN_SUFFIX}`, privacyType: 'public' });
    communityId = createRes.body.community.id;
    createdCommunityIds.push(communityId);

    await request(app).post(`/api/community/communities/${communityId}/join`).set(authHeader(memberToken));
    await request(app).post(`/api/community/communities/${communityId}/join`).set(authHeader(member2Token));
  });

  test('a regular member cannot create an event', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/events`)
      .set(authHeader(memberToken))
      .send({ title: 'Unauthorized Event', startAt: futureIso(24) });

    expect(res.status).toBe(403);
  });

  test('the owner creates a draft event', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/events`)
      .set(authHeader(ownerToken))
      .send({ title: 'Monthly Meetup', description: 'Come say hi', startAt: futureIso(24) });

    expect(res.status).toBe(201);
    expect(res.body.event.status).toBe('draft');
    eventId = res.body.event.id;
  });

  test('a member cannot see the draft event', async () => {
    const res = await request(app).get(`/api/community/events/${eventId}`).set(authHeader(memberToken));
    expect(res.status).toBe(403);
  });

  test('the draft event is excluded from a member\'s event list, but included for the owner', async () => {
    const asMember = await request(app)
      .get(`/api/community/communities/${communityId}/events`)
      .set(authHeader(memberToken));
    expect(asMember.body.events.find((e) => e.id === eventId)).toBeUndefined();

    const asOwner = await request(app)
      .get(`/api/community/communities/${communityId}/events`)
      .set(authHeader(ownerToken));
    expect(asOwner.body.events.find((e) => e.id === eventId)).toBeDefined();
  });

  test('a member cannot RSVP to a draft event', async () => {
    const res = await request(app).post(`/api/community/events/${eventId}/rsvp`).set(authHeader(memberToken));
    expect(res.status).toBe(400);
  });

  test('the owner publishes the event', async () => {
    const res = await request(app)
      .put(`/api/community/events/${eventId}`)
      .set(authHeader(ownerToken))
      .send({ status: 'published' });

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('published');
  });

  test('a member can now see the event and RSVP', async () => {
    const view = await request(app).get(`/api/community/events/${eventId}`).set(authHeader(memberToken));
    expect(view.status).toBe(200);
    expect(view.body.event.isGoing).toBe(false);

    const rsvp = await request(app).post(`/api/community/events/${eventId}/rsvp`).set(authHeader(memberToken));
    expect(rsvp.status).toBe(200);

    const after = await request(app).get(`/api/community/events/${eventId}`).set(authHeader(memberToken));
    expect(after.body.event.isGoing).toBe(true);
    expect(after.body.event.guestCount).toBe(1);
  });

  test('RSVPing twice is rejected', async () => {
    const res = await request(app).post(`/api/community/events/${eventId}/rsvp`).set(authHeader(memberToken));
    expect(res.status).toBe(400);
  });

  test('a non-RSVP\'d user cannot set a reminder', async () => {
    const res = await request(app)
      .put(`/api/community/events/${eventId}/reminder`)
      .set(authHeader(member2Token))
      .send({ remindMe: true });
    expect(res.status).toBe(400);
  });

  test('an RSVP\'d member can toggle their reminder', async () => {
    const res = await request(app)
      .put(`/api/community/events/${eventId}/reminder`)
      .set(authHeader(memberToken))
      .send({ remindMe: false });
    expect(res.status).toBe(200);
  });

  test('a non-manager cannot list attendees', async () => {
    const res = await request(app).get(`/api/community/events/${eventId}/attendees`).set(authHeader(memberToken));
    expect(res.status).toBe(403);
  });

  test('the owner can list attendees', async () => {
    const res = await request(app).get(`/api/community/events/${eventId}/attendees`).set(authHeader(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.attendees).toHaveLength(1);
    expect(res.body.attendees[0].user.id).toBe(memberId);
  });

  test('the member cancels their RSVP and the guest count drops', async () => {
    const cancel = await request(app).delete(`/api/community/events/${eventId}/rsvp`).set(authHeader(memberToken));
    expect(cancel.status).toBe(200);

    const after = await request(app).get(`/api/community/events/${eventId}`).set(authHeader(memberToken));
    expect(after.body.event.guestCount).toBe(0);
    expect(after.body.event.isGoing).toBe(false);
  });

  test('a non-manager cannot delete the event', async () => {
    const res = await request(app).delete(`/api/community/events/${eventId}`).set(authHeader(memberToken));
    expect(res.status).toBe(403);
  });

  test('the owner deletes the event', async () => {
    const res = await request(app).delete(`/api/community/events/${eventId}`).set(authHeader(ownerToken));
    expect(res.status).toBe(200);

    const after = await request(app).get(`/api/community/events/${eventId}`).set(authHeader(ownerToken));
    expect(after.status).toBe(404);
  });
});
