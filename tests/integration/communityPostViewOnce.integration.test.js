/* eslint-env jest */
// Integration test for the view-count-only-once-per-viewer fix reported by the
// frontend: viewCount was incrementing on every call to GET /posts/:id and
// POST /posts/:id/view, instead of once per (post, viewer).
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
const users = {};
const createdCommunityIds = [];

function authHeader(userKey) {
  return { Authorization: `Bearer ${users[userKey].token}` };
}

function mintToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, status: user.status },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function createUser(key, label) {
  const user = await userRepo.save({
    fullName: `Integration Test View Once ${label}`,
    email: `community-post-view-once-it-${key}-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });
  users[key] = { id: user.id, token: mintToken(user) };
}

beforeAll(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  userRepo = AppDataSource.getRepository('User');

  await Promise.all([createUser('owner', 'Owner'), createUser('viewerA', 'Viewer A'), createUser('viewerB', 'Viewer B')]);
}, 30000);

afterAll(async () => {
  if (createdCommunityIds.length) {
    await AppDataSource.query(`DELETE FROM communities WHERE id = ANY($1::uuid[])`, [createdCommunityIds]);
  }
  if (userRepo) {
    await userRepo.delete(Object.values(users).map((u) => u.id));
  }
  await AppDataSource.destroy();
}, 30000);

describe('view count increments at most once per (post, viewer)', () => {
  let communityId;
  let postId;

  test('setup: owner creates a community and a post; two viewers join', async () => {
    const createRes = await request(app)
      .post('/api/community/communities')
      .set(authHeader('owner'))
      .send({ name: `IT View Once Circle ${RUN_SUFFIX}`, privacyType: 'public' });
    expect(createRes.status).toBe(201);
    communityId = createRes.body.community.id;
    createdCommunityIds.push(communityId);

    await request(app).post(`/api/community/communities/${communityId}/join`).set(authHeader('viewerA'));
    await request(app).post(`/api/community/communities/${communityId}/join`).set(authHeader('viewerB'));

    const postRes = await request(app)
      .post(`/api/community/communities/${communityId}/posts`)
      .set(authHeader('owner'))
      .send({ content: 'A post several people will view repeatedly' });
    expect(postRes.status).toBe(201);
    postId = postRes.body.post.id;
    expect(postRes.body.post.viewCount).toBe(0);
  });

  test('repeated GET /posts/:id calls from the same viewer only count once', async () => {
    const first = await request(app).get(`/api/community/posts/${postId}`).set(authHeader('viewerA'));
    expect(first.body.post.viewCount).toBe(1);

    const second = await request(app).get(`/api/community/posts/${postId}`).set(authHeader('viewerA'));
    expect(second.body.post.viewCount).toBe(1);

    const third = await request(app).get(`/api/community/posts/${postId}`).set(authHeader('viewerA'));
    expect(third.body.post.viewCount).toBe(1);
  });

  test('calling POST /posts/:id/view after GET /posts/:id (same viewer) does not double-count', async () => {
    const viewPing = await request(app).post(`/api/community/posts/${postId}/view`).set(authHeader('viewerA'));
    expect(viewPing.status).toBe(200);
    expect(viewPing.body.viewCount).toBe(1);

    const after = await request(app).get(`/api/community/posts/${postId}`).set(authHeader('viewerA'));
    expect(after.body.post.viewCount).toBe(1);
  });

  test('a second, distinct viewer still adds exactly one more view', async () => {
    const ping1 = await request(app).post(`/api/community/posts/${postId}/view`).set(authHeader('viewerB'));
    expect(ping1.body.viewCount).toBe(2);

    const ping2 = await request(app).post(`/api/community/posts/${postId}/view`).set(authHeader('viewerB'));
    expect(ping2.body.viewCount).toBe(2);

    const finalGet = await request(app).get(`/api/community/posts/${postId}`).set(authHeader('viewerB'));
    expect(finalGet.body.post.viewCount).toBe(2);
  });
});
