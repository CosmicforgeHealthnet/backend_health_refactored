/* eslint-env jest */
// Integration tests for the Community Health System Phase 1 API.
//
// These hit a REAL Express app (supertest) and a REAL Postgres database
// (whatever DB_* the current NODE_ENV's .env file points at — run this via
// `npm run test:integration`, which sets NODE_ENV=development so it targets
// the shared cosmicforge_test database, not production).
//
// Test users and every community/post/etc. they create are removed in
// afterAll — the suite is expected to leave no residue on a clean run.

const jwt = require('jsonwebtoken');
const request = require('supertest');

const AppDataSource = require('../../src/config/database');
const { app } = require('../../src/app');

// Each request here does several sequential round trips to a remote Postgres
// instance (and, for join-request endpoints, a notification fan-out on top of
// that) — Jest's 5000ms default per-test timeout is tuned for mocked unit
// tests, not real network I/O, and was getting hit under normal latency.
jest.setTimeout(30000);

const RUN_SUFFIX = Date.now().toString(36);

let userRepo;
let patientToken;
let doctorToken;
let requesterToken;
let patientId;
let doctorId;
let requesterId;

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

  const patient = await userRepo.save({
    fullName: 'Integration Test Patient',
    email: `community-it-patient-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });
  const doctor = await userRepo.save({
    fullName: 'Integration Test Doctor',
    email: `community-it-doctor-${RUN_SUFFIX}@example.test`,
    role: 'doctor',
    status: 'doctor_active',
  });
  const requester = await userRepo.save({
    fullName: 'Integration Test Requester',
    email: `community-it-requester-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });

  patientId = patient.id;
  doctorId = doctor.id;
  requesterId = requester.id;

  patientToken = mintToken(patient);
  doctorToken = mintToken(doctor);
  requesterToken = mintToken(requester);
}, 30000);

afterAll(async () => {
  if (createdCommunityIds.length) {
    // Cascades to community_members / community_posts / community_join_requests / etc.
    await AppDataSource.query(`DELETE FROM communities WHERE id = ANY($1::uuid[])`, [createdCommunityIds]);
  }
  if (userRepo) {
    await userRepo.delete([patientId, doctorId, requesterId].filter(Boolean));
  }
  await AppDataSource.destroy();
}, 30000);

// ============================================================================
// Public community: create, join, post, like, comment, save
// ============================================================================

describe('public community flow', () => {
  let communityId;
  let postId;

  test('patient creates a public community', async () => {
    const res = await request(app)
      .post('/api/community/communities')
      .set(authHeader(patientToken))
      .send({ name: `IT Public Circle ${RUN_SUFFIX}`, description: 'integration test', privacyType: 'public' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.community.privacyType).toBe('public');
    expect(res.body.community.memberCount).toBe(1);

    communityId = res.body.community.id;
    createdCommunityIds.push(communityId);
  });

  test('doctor joins the community instantly', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/join`)
      .set(authHeader(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.membership.role).toBe('member');
  });

  test('a non-owner member cannot update the community', async () => {
    const res = await request(app)
      .put(`/api/community/communities/${communityId}`)
      .set(authHeader(doctorToken))
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  test('doctor creates a post and the response never leaks sensitive user fields', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/posts`)
      .set(authHeader(doctorToken))
      .send({ content: 'Hello from the integration suite' });

    expect(res.status).toBe(201);
    postId = res.body.post.id;

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/passwordHash/);
    expect(raw).not.toMatch(/mfaSecret/);
    expect(raw).not.toMatch(/refreshTokenHash/);
    expect(res.body.post.author).toMatchObject({ id: doctorId, fullName: 'Integration Test Doctor', role: 'doctor' });
  });

  test('patient likes, comments on, and saves the post', async () => {
    const like = await request(app).post(`/api/community/posts/${postId}/like`).set(authHeader(patientToken));
    expect(like.status).toBe(200);

    const comment = await request(app)
      .post(`/api/community/posts/${postId}/comments`)
      .set(authHeader(patientToken))
      .send({ content: 'Welcome!' });
    expect(comment.status).toBe(201);

    const save = await request(app).post(`/api/community/posts/${postId}/save`).set(authHeader(patientToken));
    expect(save.status).toBe(200);
  });

  test('fetching the post reflects the counters and the viewer flags', async () => {
    const res = await request(app).get(`/api/community/posts/${postId}`).set(authHeader(patientToken));

    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({
      likeCount: 1,
      commentCount: 1,
      isLiked: true,
      isSaved: true,
    });
    expect(res.body.post.viewCount).toBeGreaterThanOrEqual(1);
  });

  test('liking the same post twice is rejected', async () => {
    const res = await request(app).post(`/api/community/posts/${postId}/like`).set(authHeader(patientToken));
    expect(res.status).toBe(400);
  });

  test('the author can delete their own post', async () => {
    const res = await request(app).delete(`/api/community/posts/${postId}`).set(authHeader(doctorToken));
    expect(res.status).toBe(200);

    const after = await request(app).get(`/api/community/posts/${postId}`).set(authHeader(doctorToken));
    expect(after.status).toBe(404);
  });

  test('the owner cannot leave without transferring ownership first', async () => {
    const res = await request(app).post(`/api/community/communities/${communityId}/leave`).set(authHeader(patientToken));
    expect(res.status).toBe(400);
  });

  test('the owner cannot remove themself via the member-removal endpoint', async () => {
    const res = await request(app)
      .delete(`/api/community/communities/${communityId}/members/${patientId}`)
      .set(authHeader(patientToken));
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// Private community: join requests (approve + reject)
// ============================================================================

describe('private community join-request flow', () => {
  let communityId;

  test('patient creates a private community', async () => {
    const res = await request(app)
      .post('/api/community/communities')
      .set(authHeader(patientToken))
      .send({ name: `IT Private Circle ${RUN_SUFFIX}`, privacyType: 'private' });

    expect(res.status).toBe(201);
    expect(res.body.community.privacyType).toBe('private');

    communityId = res.body.community.id;
    createdCommunityIds.push(communityId);
  });

  test('instant join is rejected on a private community', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/join`)
      .set(authHeader(requesterToken));

    expect(res.status).toBe(400);
  });

  test('a non-member cannot list join requests', async () => {
    const res = await request(app)
      .get(`/api/community/communities/${communityId}/join-requests`)
      .set(authHeader(requesterToken));

    expect(res.status).toBe(403);
  });

  let requestId;

  test('requester submits a join request', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/join-requests`)
      .set(authHeader(requesterToken))
      .send({ message: 'let me in' });

    expect(res.status).toBe(201);
    expect(res.body.joinRequest.status).toBe('pending');
    requestId = res.body.joinRequest.id;
  });

  test('the requester cannot post before approval', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/posts`)
      .set(authHeader(requesterToken))
      .send({ content: 'sneaky' });

    expect(res.status).toBe(403);
  });

  test('a duplicate join request is rejected', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/join-requests`)
      .set(authHeader(requesterToken))
      .send({ message: 'again' });

    expect(res.status).toBe(400);
  });

  test('the owner approves the join request', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/join-requests/${requestId}/approve`)
      .set(authHeader(patientToken));

    expect(res.status).toBe(200);
    expect(res.body.joinRequest.status).toBe('approved');
  });

  test('the requester can now post', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/posts`)
      .set(authHeader(requesterToken))
      .send({ content: 'now I can post' });

    expect(res.status).toBe(201);
  });
});

describe('private community join-request rejection', () => {
  let communityId;
  let requestId;

  test('setup: create a private community and submit a join request', async () => {
    const createRes = await request(app)
      .post('/api/community/communities')
      .set(authHeader(doctorToken))
      .send({ name: `IT Reject Circle ${RUN_SUFFIX}`, privacyType: 'private' });
    communityId = createRes.body.community.id;
    createdCommunityIds.push(communityId);

    const reqRes = await request(app)
      .post(`/api/community/communities/${communityId}/join-requests`)
      .set(authHeader(requesterToken))
      .send({ message: 'please' });
    requestId = reqRes.body.joinRequest.id;
  });

  test('the owner rejects the join request', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/join-requests/${requestId}/reject`)
      .set(authHeader(doctorToken))
      .send({ reason: 'not a fit' });

    expect(res.status).toBe(200);
    expect(res.body.joinRequest.status).toBe('rejected');
  });

  test('the rejected requester still cannot post', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/posts`)
      .set(authHeader(requesterToken))
      .send({ content: 'still sneaky' });

    expect(res.status).toBe(403);
  });

  test('the rejected requester can submit a fresh join request', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/join-requests`)
      .set(authHeader(requesterToken))
      .send({ message: 'second attempt' });

    expect(res.status).toBe(201);
  });
});

// ============================================================================
// Auth guard
// ============================================================================

describe('authentication guard', () => {
  test('rejects requests with no token', async () => {
    const res = await request(app).get('/api/community/communities/discover');
    expect(res.status).toBe(401);
  });

  test('rejects requests with an invalid token', async () => {
    const res = await request(app).get('/api/community/communities/discover').set(authHeader('not-a-real-token'));
    expect(res.status).toBe(401);
  });
});
