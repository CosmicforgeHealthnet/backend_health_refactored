/* eslint-env jest */
// Integration tests for:
//   1. POST /posts/:id/view — lightweight view-count ping.
//   2. isLiked/isSaved flags now returned on post-list endpoints (community posts
//      list and the cross-community feed), not just GET /posts/:id.
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
    fullName: `Integration Test Post Feed ${label}`,
    email: `community-post-feed-it-${key}-${RUN_SUFFIX}@example.test`,
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

  await Promise.all([createUser('owner', 'Owner'), createUser('viewer', 'Viewer')]);
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

describe('post view endpoint and list-level like/save flags', () => {
  let communityId;
  let likedPostId;
  let plainPostId;

  test('setup: owner creates a community, viewer joins, owner posts twice', async () => {
    const createRes = await request(app)
      .post('/api/community/communities')
      .set(authHeader('owner'))
      .send({ name: `IT Post Feed Circle ${RUN_SUFFIX}`, privacyType: 'public' });
    expect(createRes.status).toBe(201);
    communityId = createRes.body.community.id;
    createdCommunityIds.push(communityId);

    await request(app).post(`/api/community/communities/${communityId}/join`).set(authHeader('viewer'));

    const postA = await request(app)
      .post(`/api/community/communities/${communityId}/posts`)
      .set(authHeader('owner'))
      .send({ content: 'Post the viewer will like and save' });
    expect(postA.status).toBe(201);
    likedPostId = postA.body.post.id;

    const postB = await request(app)
      .post(`/api/community/communities/${communityId}/posts`)
      .set(authHeader('owner'))
      .send({ content: 'Post the viewer leaves alone' });
    expect(postB.status).toBe(201);
    plainPostId = postB.body.post.id;

    const likeRes = await request(app).post(`/api/community/posts/${likedPostId}/like`).set(authHeader('viewer'));
    expect(likeRes.status).toBe(200);
    const saveRes = await request(app).post(`/api/community/posts/${likedPostId}/save`).set(authHeader('viewer'));
    expect(saveRes.status).toBe(200);
  });

  test('GET /communities/:id/posts returns correct isLiked/isSaved per post for the viewer', async () => {
    const res = await request(app)
      .get(`/api/community/communities/${communityId}/posts`)
      .set(authHeader('viewer'));
    expect(res.status).toBe(200);

    const liked = res.body.posts.find((p) => p.id === likedPostId);
    const plain = res.body.posts.find((p) => p.id === plainPostId);
    expect(liked).toMatchObject({ isLiked: true, isSaved: true });
    expect(plain).toMatchObject({ isLiked: false, isSaved: false });
  });

  test('the same list, viewed by a user who has not liked/saved anything, shows false for both', async () => {
    const res = await request(app)
      .get(`/api/community/communities/${communityId}/posts`)
      .set(authHeader('owner'));
    const liked = res.body.posts.find((p) => p.id === likedPostId);
    expect(liked).toMatchObject({ isLiked: false, isSaved: false });
  });

  test('GET /posts/feed also returns correct isLiked/isSaved per post', async () => {
    const res = await request(app).get('/api/community/posts/feed').set(authHeader('viewer'));
    expect(res.status).toBe(200);

    const liked = res.body.posts.find((p) => p.id === likedPostId);
    const plain = res.body.posts.find((p) => p.id === plainPostId);
    expect(liked).toMatchObject({ isLiked: true, isSaved: true });
    expect(plain).toMatchObject({ isLiked: false, isSaved: false });
  });

  test('POST /posts/:id/view increments the view count without needing the full post payload', async () => {
    const before = await request(app).get(`/api/community/posts/${plainPostId}`).set(authHeader('viewer'));
    const viewCountAfterFirstOpen = before.body.post.viewCount;

    const viewRes = await request(app).post(`/api/community/posts/${plainPostId}/view`).set(authHeader('viewer'));
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.viewCount).toBe(viewCountAfterFirstOpen + 1);

    const after = await request(app).get(`/api/community/posts/${plainPostId}`).set(authHeader('viewer'));
    expect(after.body.post.viewCount).toBe(viewCountAfterFirstOpen + 2);
  });

  test('POST /posts/:id/view returns 404 for a non-existent post', async () => {
    const res = await request(app)
      .post('/api/community/posts/00000000-0000-0000-0000-000000000000/view')
      .set(authHeader('viewer'));
    expect(res.status).toBe(404);
  });
});
