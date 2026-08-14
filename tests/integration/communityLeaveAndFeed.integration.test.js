/* eslint-env jest */
// Integration tests for:
//   1. Leaving a community as any member, including the owner, with automatic
//      ownership reassignment (or community closure if the owner was the last one).
//   2. The cross-community "my feed" endpoints for posts and events.
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
    fullName: `Integration Test Leave/Feed ${label}`,
    email: `community-leave-feed-it-${key}-${RUN_SUFFIX}@example.test`,
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

  await Promise.all([
    createUser('owner1', 'Owner One'),
    createUser('member1', 'Member One'),
    createUser('member2', 'Member Two'),
    createUser('soloOwner', 'Solo Owner'),
    createUser('feedUser', 'Feed User'),
  ]);
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

async function createCommunity(ownerKey, name) {
  const res = await request(app)
    .post('/api/community/communities')
    .set(authHeader(ownerKey))
    .send({ name: `${name} ${RUN_SUFFIX}`, privacyType: 'public' });
  expect(res.status).toBe(201);
  createdCommunityIds.push(res.body.community.id);
  return res.body.community.id;
}

describe('leaving a community — ownership reassignment', () => {
  test('when the owner leaves and another member is present, ownership transfers to them', async () => {
    const communityId = await createCommunity('owner1', 'IT Leave Circle');
    await request(app).post(`/api/community/communities/${communityId}/join`).set(authHeader('member1'));

    const leaveRes = await request(app)
      .post(`/api/community/communities/${communityId}/leave`)
      .set(authHeader('owner1'));

    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.communityDeleted).toBe(false);
    expect(leaveRes.body.newOwner.id).toBe(users.member1.id);

    const membersRes = await request(app)
      .get(`/api/community/communities/${communityId}/members`)
      .set(authHeader('member1'));
    const newOwnerMembership = membersRes.body.members.find((m) => m.user.id === users.member1.id);
    expect(newOwnerMembership.role).toBe('owner');

    const oldOwnerMembership = membersRes.body.members.find((m) => m.user.id === users.owner1.id);
    expect(oldOwnerMembership).toBeUndefined();
  });

  test('when the owner leaves as the community\'s last active member, the community is closed', async () => {
    const communityId = await createCommunity('soloOwner', 'IT Solo Owner Circle');

    const leaveRes = await request(app)
      .post(`/api/community/communities/${communityId}/leave`)
      .set(authHeader('soloOwner'));

    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.communityDeleted).toBe(true);
    expect(leaveRes.body.newOwner).toBeNull();

    const getRes = await request(app)
      .get(`/api/community/communities/${communityId}`)
      .set(authHeader('soloOwner'));
    expect(getRes.status).toBe(404);
  });

  test('a regular member leaving does not trigger any ownership reassignment', async () => {
    const communityId = await createCommunity('owner1', 'IT Regular Leave Circle');
    await request(app).post(`/api/community/communities/${communityId}/join`).set(authHeader('member2'));

    const leaveRes = await request(app)
      .post(`/api/community/communities/${communityId}/leave`)
      .set(authHeader('member2'));

    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.newOwner).toBeNull();
    expect(leaveRes.body.communityDeleted).toBe(false);

    const membersRes = await request(app)
      .get(`/api/community/communities/${communityId}/members`)
      .set(authHeader('owner1'));
    expect(membersRes.body.members.find((m) => m.user.id === users.owner1.id).role).toBe('owner');
    expect(membersRes.body.members.find((m) => m.user.id === users.member2.id)).toBeUndefined();
  });

  test('leaving a community you are not a member of returns 404', async () => {
    const communityId = await createCommunity('owner1', 'IT Not A Member Circle');
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/leave`)
      .set(authHeader('member2'));
    expect(res.status).toBe(404);
  });
});

describe('cross-community feeds — posts and events', () => {
  let communityAId;
  let communityBId;
  let postAId;
  let postBId;
  let eventAId;
  let eventBId;

  test('setup: feedUser joins two communities, each gets a post and a published upcoming event', async () => {
    communityAId = await createCommunity('owner1', 'IT Feed Circle A');
    communityBId = await createCommunity('owner1', 'IT Feed Circle B');

    await request(app).post(`/api/community/communities/${communityAId}/join`).set(authHeader('feedUser'));
    await request(app).post(`/api/community/communities/${communityBId}/join`).set(authHeader('feedUser'));

    const postA = await request(app)
      .post(`/api/community/communities/${communityAId}/posts`)
      .set(authHeader('owner1'))
      .send({ content: 'Post in circle A' });
    expect(postA.status).toBe(201);
    postAId = postA.body.post.id;

    const postB = await request(app)
      .post(`/api/community/communities/${communityBId}/posts`)
      .set(authHeader('owner1'))
      .send({ content: 'Post in circle B' });
    expect(postB.status).toBe(201);
    postBId = postB.body.post.id;

    const futureIso = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const eventA = await request(app)
      .post(`/api/community/communities/${communityAId}/events`)
      .set(authHeader('owner1'))
      .send({ title: 'Event in circle A', startAt: futureIso, status: 'published' });
    expect(eventA.status).toBe(201);
    eventAId = eventA.body.event.id;

    const eventB = await request(app)
      .post(`/api/community/communities/${communityBId}/events`)
      .set(authHeader('owner1'))
      .send({ title: 'Event in circle B', startAt: futureIso, status: 'published' });
    expect(eventB.status).toBe(201);
    eventBId = eventB.body.event.id;
  });

  test('GET /posts/feed returns posts from both joined communities, each tagged with its community', async () => {
    const res = await request(app).get('/api/community/posts/feed').set(authHeader('feedUser'));
    expect(res.status).toBe(200);

    const feedIds = res.body.posts.map((p) => p.id);
    expect(feedIds).toEqual(expect.arrayContaining([postAId, postBId]));

    const postAInFeed = res.body.posts.find((p) => p.id === postAId);
    expect(postAInFeed.community.id).toBe(communityAId);
  });

  test('GET /events/feed returns upcoming published events from both joined communities', async () => {
    const res = await request(app).get('/api/community/events/feed').set(authHeader('feedUser'));
    expect(res.status).toBe(200);

    const feedIds = res.body.events.map((e) => e.id);
    expect(feedIds).toEqual(expect.arrayContaining([eventAId, eventBId]));

    const eventBInFeed = res.body.events.find((e) => e.id === eventBId);
    expect(eventBInFeed.community.id).toBe(communityBId);
  });

  test('a user in no communities gets an empty feed, not an error', async () => {
    const postsRes = await request(app).get('/api/community/posts/feed').set(authHeader('soloOwner'));
    expect(postsRes.status).toBe(200);
    expect(postsRes.body.posts).toEqual([]);

    const eventsRes = await request(app).get('/api/community/events/feed').set(authHeader('soloOwner'));
    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body.events).toEqual([]);
  });
});
