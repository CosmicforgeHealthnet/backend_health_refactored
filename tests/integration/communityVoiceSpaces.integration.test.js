/* eslint-env jest */
// Integration tests for the Community Health System Phase 4 Voice Spaces API.
//
// Real Express app (supertest) + real Postgres + the REAL Zoom API (using the
// credentials already configured in .env.development) — start/end genuinely
// create and end a Zoom meeting each run. Kept to one full-flow suite to avoid
// creating more real meetings than necessary on the shared test Zoom account.
//
// Run via `npm run test:integration`.

const jwt = require('jsonwebtoken');
const request = require('supertest');

const AppDataSource = require('../../src/config/database');
const { app } = require('../../src/app');

jest.setTimeout(30000);

const RUN_SUFFIX = Date.now().toString(36);

let userRepo;
let hostToken;
let memberToken;
let outsiderToken;
let hostId;
let memberId;

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

  const host = await userRepo.save({
    fullName: 'Integration Test Voice Host',
    email: `community-voice-it-host-${RUN_SUFFIX}@example.test`,
    role: 'doctor',
    status: 'doctor_active',
  });
  const member = await userRepo.save({
    fullName: 'Integration Test Voice Member',
    email: `community-voice-it-member-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });
  const outsider = await userRepo.save({
    fullName: 'Integration Test Voice Outsider',
    email: `community-voice-it-outsider-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });

  hostId = host.id;
  memberId = member.id;

  hostToken = mintToken(host);
  memberToken = mintToken(member);
  outsiderToken = mintToken(outsider);

  global.__voiceSpaceOutsiderId = outsider.id;
}, 30000);

afterAll(async () => {
  if (createdCommunityIds.length) {
    await AppDataSource.query(`DELETE FROM communities WHERE id = ANY($1::uuid[])`, [createdCommunityIds]);
  }
  if (userRepo) {
    await userRepo.delete([hostId, memberId, global.__voiceSpaceOutsiderId].filter(Boolean));
  }
  await AppDataSource.destroy();
}, 30000);

describe('community voice spaces flow', () => {
  let communityId;
  let spaceId;

  test('setup: host creates a community, member joins', async () => {
    const createRes = await request(app)
      .post('/api/community/communities')
      .set(authHeader(hostToken))
      .send({ name: `IT Voice Circle ${RUN_SUFFIX}`, privacyType: 'public' });
    communityId = createRes.body.community.id;
    createdCommunityIds.push(communityId);

    const joinRes = await request(app).post(`/api/community/communities/${communityId}/join`).set(authHeader(memberToken));
    expect(joinRes.status).toBe(200);
  });

  test('a non-member cannot start a voice space', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/voice-spaces`)
      .set(authHeader(outsiderToken))
      .send({ title: 'Sneaky Space' });
    expect(res.status).toBe(403);
  });

  test('the host starts a voice space with a real Zoom meeting', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/voice-spaces`)
      .set(authHeader(hostToken))
      .send({ title: 'Community AMA' });

    expect(res.status).toBe(201);
    expect(res.body.space.status).toBe('live');
    expect(res.body.space.joinUrl).toEqual(expect.stringContaining('zoom.us'));
    expect(res.body.space.hostStartUrl).toEqual(expect.stringContaining('zoom.us'));

    spaceId = res.body.space.id;
  }, 20000);

  test('a non-host viewer never sees hostStartUrl', async () => {
    const res = await request(app).get(`/api/community/voice-spaces/${spaceId}`).set(authHeader(memberToken));
    expect(res.status).toBe(200);
    expect(res.body.space.hostStartUrl).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('zak=');
  });

  test('starting a second space while one is live is rejected', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/voice-spaces`)
      .set(authHeader(hostToken))
      .send({ title: 'Duplicate Space' });
    expect(res.status).toBe(400);
  });

  test('the community exposes the active space to members', async () => {
    const res = await request(app)
      .get(`/api/community/communities/${communityId}/voice-spaces/active`)
      .set(authHeader(memberToken));
    expect(res.status).toBe(200);
    expect(res.body.space.id).toBe(spaceId);
  });

  test('the member joins, requests to speak, and the host promotes them', async () => {
    const joinRes = await request(app).post(`/api/community/voice-spaces/${spaceId}/join`).set(authHeader(memberToken));
    expect(joinRes.status).toBe(200);

    const rtsRes = await request(app)
      .post(`/api/community/voice-spaces/${spaceId}/request-to-speak`)
      .set(authHeader(memberToken));
    expect(rtsRes.status).toBe(200);

    const promoteRes = await request(app)
      .post(`/api/community/voice-spaces/${spaceId}/participants/${memberId}/promote`)
      .set(authHeader(hostToken));
    expect(promoteRes.status).toBe(200);

    const listRes = await request(app).get(`/api/community/voice-spaces/${spaceId}/participants`).set(authHeader(hostToken));
    expect(listRes.status).toBe(200);
    const memberEntry = listRes.body.participants.find((p) => p.user.id === memberId);
    expect(memberEntry).toMatchObject({ role: 'speaker' });
  });

  test('a non-host cannot promote or demote', async () => {
    const res = await request(app)
      .post(`/api/community/voice-spaces/${spaceId}/participants/${memberId}/demote`)
      .set(authHeader(memberToken));
    expect(res.status).toBe(403);
  });

  test('the host demotes the speaker back to listener', async () => {
    const res = await request(app)
      .post(`/api/community/voice-spaces/${spaceId}/participants/${memberId}/demote`)
      .set(authHeader(hostToken));
    expect(res.status).toBe(200);
  });

  test('the member leaves the space', async () => {
    const res = await request(app).post(`/api/community/voice-spaces/${spaceId}/leave`).set(authHeader(memberToken));
    expect(res.status).toBe(200);
  });

  test('the host ends the space, which really ends the Zoom meeting', async () => {
    const res = await request(app).post(`/api/community/voice-spaces/${spaceId}/end`).set(authHeader(hostToken));
    expect(res.status).toBe(200);

    const activeRes = await request(app)
      .get(`/api/community/communities/${communityId}/voice-spaces/active`)
      .set(authHeader(hostToken));
    expect(activeRes.status).toBe(404);
  }, 20000);

  test('ending an already-ended space is rejected', async () => {
    const res = await request(app).post(`/api/community/voice-spaces/${spaceId}/end`).set(authHeader(hostToken));
    expect(res.status).toBe(400);
  });

  test('the ended space shows up in community history', async () => {
    const res = await request(app)
      .get(`/api/community/communities/${communityId}/voice-spaces`)
      .set(authHeader(hostToken));
    expect(res.status).toBe(200);
    expect(res.body.spaces.find((s) => s.id === spaceId)).toBeDefined();
  });

  test('a new space can be started now that the previous one ended', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/voice-spaces`)
      .set(authHeader(hostToken))
      .send({ title: 'Round Two' });
    expect(res.status).toBe(201);

    // Clean up the real Zoom meeting immediately — this test only needed to prove
    // starting-after-ending works, not to exercise the rest of the flow again.
    await request(app).post(`/api/community/voice-spaces/${res.body.space.id}/end`).set(authHeader(hostToken));
  }, 20000);
});
