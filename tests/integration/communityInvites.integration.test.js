/* eslint-env jest */
// Integration tests for the "Invite a friend to the community" feature.
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
let outsiderToken;
let acceptingInviteeToken;
let decliningInviteeToken;
let cancelledInviteeToken;
let ownerId;
let memberId;
let outsiderId;
let acceptingInviteeId;
let decliningInviteeId;
let cancelledInviteeId;

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
    fullName: 'Integration Test Invite Owner',
    email: `community-invites-it-owner-${RUN_SUFFIX}@example.test`,
    role: 'doctor',
    status: 'doctor_active',
  });
  const member = await userRepo.save({
    fullName: 'Integration Test Invite Member',
    email: `community-invites-it-member-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });
  const outsider = await userRepo.save({
    fullName: 'Integration Test Invite Outsider',
    email: `community-invites-it-outsider-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });
  const acceptingInvitee = await userRepo.save({
    fullName: 'Integration Test Invite Accepter',
    email: `community-invites-it-accepter-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });
  const decliningInvitee = await userRepo.save({
    fullName: 'Integration Test Invite Decliner',
    email: `community-invites-it-decliner-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });
  const cancelledInvitee = await userRepo.save({
    fullName: 'Integration Test Invite Cancelled Target',
    email: `community-invites-it-cancelled-${RUN_SUFFIX}@example.test`,
    role: 'patient',
    status: 'active',
  });

  ownerId = owner.id;
  memberId = member.id;
  outsiderId = outsider.id;
  acceptingInviteeId = acceptingInvitee.id;
  decliningInviteeId = decliningInvitee.id;
  cancelledInviteeId = cancelledInvitee.id;

  ownerToken = mintToken(owner);
  memberToken = mintToken(member);
  outsiderToken = mintToken(outsider);
  acceptingInviteeToken = mintToken(acceptingInvitee);
  decliningInviteeToken = mintToken(decliningInvitee);
  cancelledInviteeToken = mintToken(cancelledInvitee);
}, 30000);

afterAll(async () => {
  if (createdCommunityIds.length) {
    await AppDataSource.query(`DELETE FROM communities WHERE id = ANY($1::uuid[])`, [createdCommunityIds]);
  }
  if (userRepo) {
    await userRepo.delete(
      [ownerId, memberId, outsiderId, acceptingInviteeId, decliningInviteeId, cancelledInviteeId].filter(Boolean)
    );
  }
  await AppDataSource.destroy();
}, 30000);

describe('community invite friend flow', () => {
  let communityId;
  let acceptedInviteId;

  test('setup: owner creates a community, a second user joins as a member', async () => {
    const createRes = await request(app)
      .post('/api/community/communities')
      .set(authHeader(ownerToken))
      .send({ name: `IT Invite Circle ${RUN_SUFFIX}`, privacyType: 'public' });
    expect(createRes.status).toBe(201);
    communityId = createRes.body.community.id;
    createdCommunityIds.push(communityId);

    const joinRes = await request(app)
      .post(`/api/community/communities/${communityId}/join`)
      .set(authHeader(memberToken));
    expect(joinRes.status).toBe(200);
  });

  test('a non-member cannot search for invitable users', async () => {
    const res = await request(app)
      .get(`/api/community/communities/${communityId}/invites/search-users`)
      .set(authHeader(outsiderToken))
      .query({ q: 'Integration Test Invite Accepter' });
    expect(res.status).toBe(403);
  });

  test('a member can search for invitable users and finds the target', async () => {
    const res = await request(app)
      .get(`/api/community/communities/${communityId}/invites/search-users`)
      .set(authHeader(memberToken))
      .query({ q: 'Integration Test Invite Accepter' });
    expect(res.status).toBe(200);
    expect(res.body.users.some((u) => u.id === acceptingInviteeId)).toBe(true);
  });

  test('a member can list suggested users', async () => {
    const res = await request(app)
      .get(`/api/community/communities/${communityId}/invites/suggested-users`)
      .set(authHeader(memberToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  test('a member cannot invite themselves', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/invites`)
      .set(authHeader(memberToken))
      .send({ inviteeId: memberId });
    expect(res.status).toBe(400);
  });

  test('a member cannot invite someone who is already a member', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/invites`)
      .set(authHeader(memberToken))
      .send({ inviteeId: ownerId });
    expect(res.status).toBe(400);
  });

  test('a member sends an invite to the accepting invitee', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/invites`)
      .set(authHeader(memberToken))
      .send({ inviteeId: acceptingInviteeId, message: 'come join us!' });
    expect(res.status).toBe(201);
    expect(res.body.invite.status).toBe('pending');
    expect(res.body.invite.invitee.id).toBe(acceptingInviteeId);
    expect(res.body.invite.invitedBy.id).toBe(memberId);
    acceptedInviteId = res.body.invite.id;
  });

  test('sending a second invite to the same pending invitee is rejected', async () => {
    const res = await request(app)
      .post(`/api/community/communities/${communityId}/invites`)
      .set(authHeader(memberToken))
      .send({ inviteeId: acceptingInviteeId });
    expect(res.status).toBe(400);
  });

  test('the invitee sees the pending invite in their own list', async () => {
    const res = await request(app).get('/api/community/invites/mine').set(authHeader(acceptingInviteeToken));
    expect(res.status).toBe(200);
    expect(res.body.invites.some((i) => i.id === acceptedInviteId)).toBe(true);
  });

  test('a non-admin member cannot list the community\'s sent invites', async () => {
    const res = await request(app)
      .get(`/api/community/communities/${communityId}/invites`)
      .set(authHeader(memberToken));
    expect(res.status).toBe(403);
  });

  test('the owner can list the community\'s sent invites', async () => {
    const res = await request(app)
      .get(`/api/community/communities/${communityId}/invites`)
      .set(authHeader(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.invites.some((i) => i.id === acceptedInviteId)).toBe(true);
  });

  test('someone other than the invitee cannot accept the invite', async () => {
    const res = await request(app)
      .post(`/api/community/invites/${acceptedInviteId}/accept`)
      .set(authHeader(outsiderToken));
    expect(res.status).toBe(403);
  });

  test('the invitee accepts the invite and becomes a member', async () => {
    const res = await request(app)
      .post(`/api/community/invites/${acceptedInviteId}/accept`)
      .set(authHeader(acceptingInviteeToken));
    expect(res.status).toBe(200);
    expect(res.body.invite.status).toBe('accepted');

    const membersRes = await request(app)
      .get(`/api/community/communities/${communityId}/members`)
      .set(authHeader(ownerToken));
    expect(membersRes.status).toBe(200);
    const newMember = membersRes.body.members.find((m) => m.user.id === acceptingInviteeId);
    expect(newMember).toBeDefined();
    expect(newMember.role).toBe('member');
  });

  test('accepting an already-accepted invite fails', async () => {
    const res = await request(app)
      .post(`/api/community/invites/${acceptedInviteId}/accept`)
      .set(authHeader(acceptingInviteeToken));
    expect(res.status).toBe(404);
  });

  test('an invitee can decline an invite', async () => {
    const sendRes = await request(app)
      .post(`/api/community/communities/${communityId}/invites`)
      .set(authHeader(memberToken))
      .send({ inviteeId: decliningInviteeId });
    expect(sendRes.status).toBe(201);
    const declineInviteId = sendRes.body.invite.id;

    const declineRes = await request(app)
      .post(`/api/community/invites/${declineInviteId}/decline`)
      .set(authHeader(decliningInviteeToken));
    expect(declineRes.status).toBe(200);
    expect(declineRes.body.invite.status).toBe('declined');

    const membersRes = await request(app)
      .get(`/api/community/communities/${communityId}/members`)
      .set(authHeader(ownerToken));
    expect(membersRes.body.members.some((m) => m.user.id === decliningInviteeId)).toBe(false);
  });

  test('a non-sender, non-manager member cannot cancel someone else\'s invite', async () => {
    const sendRes = await request(app)
      .post(`/api/community/communities/${communityId}/invites`)
      .set(authHeader(memberToken))
      .send({ inviteeId: cancelledInviteeId });
    expect(sendRes.status).toBe(201);
    const cancelInviteId = sendRes.body.invite.id;

    const cancelAttempt = await request(app)
      .delete(`/api/community/communities/${communityId}/invites/${cancelInviteId}`)
      .set(authHeader(acceptingInviteeToken));
    expect(cancelAttempt.status).toBe(403);

    const cancelByOwner = await request(app)
      .delete(`/api/community/communities/${communityId}/invites/${cancelInviteId}`)
      .set(authHeader(ownerToken));
    expect(cancelByOwner.status).toBe(200);

    const mineRes = await request(app).get('/api/community/invites/mine').set(authHeader(cancelledInviteeToken));
    const cancelledInvite = mineRes.body.invites.find((i) => i.id === cancelInviteId);
    expect(cancelledInvite === undefined || cancelledInvite.status === 'cancelled').toBe(true);
  });
});
