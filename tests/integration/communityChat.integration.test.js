/* eslint-env jest */
// Integration tests for the Community Health System Phase 3 chat-access sync:
// each community gets a group ChatRoom, and ChatParticipant rows are kept in
// sync with CommunityMember rows on join/approve/leave/remove/promote.
//
// Real Express app (supertest) + real Postgres (whatever NODE_ENV's .env file
// points at — run via `npm run test:integration`).

const jwt = require('jsonwebtoken');
const request = require('supertest');

const AppDataSource = require('../../src/config/database');
const { app } = require('../../src/app');

jest.setTimeout(30000);

const RUN_SUFFIX = Date.now().toString(36);

let userRepo;
let ownerToken;
let memberToken;
let requesterToken;
let ownerId;
let memberId;
let requesterId;

const createdCommunityIds = [];
const createdChatRoomIds = [];

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

async function getParticipant(roomId, userId) {
  const rows = await AppDataSource.query(
    `SELECT "role", "isActive" FROM "chat_participants" WHERE "roomId" = $1 AND "userId" = $2`,
    [roomId, userId]
  );
  return rows[0] || null;
}

beforeAll(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  userRepo = AppDataSource.getRepository('User');

  const owner = await userRepo.save({
    fullName: 'Integration Test Chat Owner',
    email: `community-chat-it-owner-${RUN_SUFFIX}@example.test`,
    role: 'doctor',
    status: 'doctor_active',
  });
  const member = await userRepo.save({
    fullName: 'Integration Test Chat Member',
    email: `community-chat-it-member-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });
  const requester = await userRepo.save({
    fullName: 'Integration Test Chat Requester',
    email: `community-chat-it-requester-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });

  ownerId = owner.id;
  memberId = member.id;
  requesterId = requester.id;

  ownerToken = mintToken(owner);
  memberToken = mintToken(member);
  requesterToken = mintToken(requester);
}, 30000);

afterAll(async () => {
  if (createdCommunityIds.length) {
    await AppDataSource.query(`DELETE FROM communities WHERE id = ANY($1::uuid[])`, [createdCommunityIds]);
  }
  if (createdChatRoomIds.length) {
    await AppDataSource.query(`DELETE FROM chat_rooms WHERE id = ANY($1::uuid[])`, [createdChatRoomIds]);
  }
  if (userRepo) {
    await userRepo.delete([ownerId, memberId, requesterId].filter(Boolean));
  }
  await AppDataSource.destroy();
}, 30000);

describe('community chat access sync', () => {
  let communityId;
  let chatRoomId;
  let messageId;

  test('creating a community auto-creates a group chat room and makes the owner a chat admin', async () => {
    const res = await request(app)
      .post('/api/community/communities')
      .set(authHeader(ownerToken))
      .send({ name: `IT Chat Circle ${RUN_SUFFIX}`, privacyType: 'private' });

    expect(res.status).toBe(201);
    expect(res.body.community.chatRoomId).toEqual(expect.any(String));

    communityId = res.body.community.id;
    chatRoomId = res.body.community.chatRoomId;
    createdCommunityIds.push(communityId);
    createdChatRoomIds.push(chatRoomId);

    const [room] = await AppDataSource.query(`SELECT "type", "isPrivate" FROM "chat_rooms" WHERE "id" = $1`, [chatRoomId]);
    expect(room).toMatchObject({ type: 'group', isPrivate: true });

    const ownerParticipant = await getParticipant(chatRoomId, ownerId);
    expect(ownerParticipant).toMatchObject({ role: 'admin', isActive: true });
  });

  test('approving a private join request grants chat access as a chat member', async () => {
    const reqRes = await request(app)
      .post(`/api/community/communities/${communityId}/join-requests`)
      .set(authHeader(requesterToken))
      .send({ message: 'let me in' });
    expect(reqRes.status).toBe(201);

    // Not a chat participant yet — still pending.
    expect(await getParticipant(chatRoomId, requesterId)).toBeNull();

    const requestId = reqRes.body.joinRequest.id;
    const approveRes = await request(app)
      .post(`/api/community/communities/${communityId}/join-requests/${requestId}/approve`)
      .set(authHeader(ownerToken));
    expect(approveRes.status).toBe(200);

    const participant = await getParticipant(chatRoomId, requesterId);
    expect(participant).toMatchObject({ role: 'member', isActive: true });
  });

  test('promoting a member to admin syncs their chat role', async () => {
    const promoteRes = await request(app)
      .put(`/api/community/communities/${communityId}/members/${requesterId}/role`)
      .set(authHeader(ownerToken))
      .send({ role: 'admin' });
    expect(promoteRes.status).toBe(200);

    const participant = await getParticipant(chatRoomId, requesterId);
    expect(participant).toMatchObject({ role: 'admin', isActive: true });
  });

  test('removing a member revokes their chat access', async () => {
    const removeRes = await request(app)
      .delete(`/api/community/communities/${communityId}/members/${requesterId}`)
      .set(authHeader(ownerToken));
    expect(removeRes.status).toBe(200);

    const participant = await getParticipant(chatRoomId, requesterId);
    expect(participant).toMatchObject({ isActive: false });
  });

  test('joining a public community grants instant chat access, and leaving revokes it', async () => {
    const publicRes = await request(app)
      .post('/api/community/communities')
      .set(authHeader(ownerToken))
      .send({ name: `IT Chat Public Circle ${RUN_SUFFIX}`, privacyType: 'public' });
    const publicCommunityId = publicRes.body.community.id;
    const publicChatRoomId = publicRes.body.community.chatRoomId;
    createdCommunityIds.push(publicCommunityId);
    createdChatRoomIds.push(publicChatRoomId);

    const joinRes = await request(app)
      .post(`/api/community/communities/${publicCommunityId}/join`)
      .set(authHeader(memberToken));
    expect(joinRes.status).toBe(200);

    expect(await getParticipant(publicChatRoomId, memberId)).toMatchObject({ role: 'member', isActive: true });

    const leaveRes = await request(app)
      .post(`/api/community/communities/${publicCommunityId}/leave`)
      .set(authHeader(memberToken));
    expect(leaveRes.status).toBe(200);

    expect(await getParticipant(publicChatRoomId, memberId)).toMatchObject({ isActive: false });
  });

  test('the room details endpoint returns the room and its active participants', async () => {
    const res = await request(app).get(`/api/chat/rooms/${chatRoomId}`).set(authHeader(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: chatRoomId, type: 'group' });
    expect(res.body.data.participants.some((p) => p.user.id === ownerId)).toBe(true);
  });

  test('a non-participant cannot fetch room details', async () => {
    const res = await request(app).get(`/api/chat/rooms/${chatRoomId}`).set(authHeader(requesterToken));
    expect(res.status).toBe(403);
  });

  test('sending and reading a message', async () => {
    const sendRes = await request(app)
      .post(`/api/chat/rooms/${chatRoomId}/messages`)
      .set(authHeader(ownerToken))
      .send({ content: 'Welcome to the community chat!' });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.data.content).toBe('Welcome to the community chat!');
    messageId = sendRes.body.data.id;

    const historyRes = await request(app)
      .get(`/api/chat/rooms/${chatRoomId}/messages`)
      .set(authHeader(ownerToken));

    expect(historyRes.status).toBe(200);
    expect(JSON.stringify(historyRes.body)).toContain('Welcome to the community chat!');
  });

  test('editing the message (author only)', async () => {
    const res = await request(app)
      .put(`/api/chat/messages/${messageId}`)
      .set(authHeader(ownerToken))
      .send({ content: 'Welcome to the community chat (edited)!' });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('Welcome to the community chat (edited)!');
  });

  test('searching for the edited message', async () => {
    const res = await request(app)
      .get(`/api/chat/rooms/${chatRoomId}/search`)
      .query({ q: 'edited' })
      .set(authHeader(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data.some((m) => m.id === messageId)).toBe(true);
  });

  test('marking the room as read', async () => {
    const res = await request(app)
      .post(`/api/chat/rooms/${chatRoomId}/read`)
      .set(authHeader(ownerToken))
      .send({ messageId });

    expect(res.status).toBe(200);
  });

  test('deleting the message (soft delete)', async () => {
    const res = await request(app).delete(`/api/chat/messages/${messageId}`).set(authHeader(ownerToken));
    expect(res.status).toBe(200);

    // findByRoomId filters `deleted = false` by default, so a soft-deleted
    // message correctly disappears from the default history view.
    const historyRes = await request(app)
      .get(`/api/chat/rooms/${chatRoomId}/messages`)
      .set(authHeader(ownerToken));
    expect(historyRes.body.data.find((m) => m.id === messageId)).toBeUndefined();
  });
});
