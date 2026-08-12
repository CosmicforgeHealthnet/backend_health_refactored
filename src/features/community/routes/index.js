const router = require("express").Router();
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");
const { requireCommunityRole } = require("../middlewares/communityRoleMiddleware");
const communityController = require("../controllers/communityController");
const communityMembershipController = require("../controllers/communityMembershipController");
const communityPostController = require("../controllers/communityPostController");
const communityEventController = require("../controllers/communityEventController");
const communityEventRSVPController = require("../controllers/communityEventRSVPController");
const communityVoiceSpaceController = require("../controllers/communityVoiceSpaceController");
const communityVoiceSpaceParticipantController = require("../controllers/communityVoiceSpaceParticipantController");
const communityInviteController = require("../controllers/communityInviteController");

router.use(authenticateJWT);

// ─── Static routes MUST come before /:id ─────────────────────────────────────
router.get("/communities/mine", communityController.getMyCommunities);
router.get("/communities/discover", communityController.discover);
router.get("/posts/saved", communityPostController.listMySavedPosts);
router.get("/invites/mine", communityInviteController.listMine);

// ─── Communities ──────────────────────────────────────────────────────────────
router.post("/communities", communityController.create);
router.get("/communities/:id", communityController.getById);
router.put("/communities/:id", requireCommunityRole("owner"), communityController.update);
router.delete("/communities/:id", requireCommunityRole("owner"), communityController.delete);

// ─── Membership / Join Requests ───────────────────────────────────────────────
router.post("/communities/:id/join", communityMembershipController.join);
router.post("/communities/:id/join-requests", communityMembershipController.requestToJoin);
router.get("/communities/:id/join-requests", requireCommunityRole("owner", "admin"), communityMembershipController.listJoinRequests);
router.post("/communities/:id/join-requests/:requestId/approve", requireCommunityRole("owner", "admin"), communityMembershipController.approveJoinRequest);
router.post("/communities/:id/join-requests/:requestId/reject", requireCommunityRole("owner", "admin"), communityMembershipController.rejectJoinRequest);
router.post("/communities/:id/leave", communityMembershipController.leave);
router.get("/communities/:id/members", requireCommunityRole("owner", "admin", "moderator", "member"), communityMembershipController.listMembers);
router.delete("/communities/:id/members/:userId", requireCommunityRole("owner", "admin"), communityMembershipController.removeMember);
router.put("/communities/:id/members/:userId/role", requireCommunityRole("owner"), communityMembershipController.promoteMember);

// ─── Posts ─────────────────────────────────────────────────────────────────────
router.post(
    "/communities/:communityId/posts",
    requireCommunityRole("owner", "admin", "moderator", "member"),
    communityPostController.create
);
router.get(
    "/communities/:communityId/posts",
    requireCommunityRole("owner", "admin", "moderator", "member"),
    communityPostController.listByCommunity
);
router.get("/posts/:id", communityPostController.getById);
router.delete("/posts/:id", communityPostController.delete);
router.post("/posts/:id/like", communityPostController.like);
router.delete("/posts/:id/like", communityPostController.unlike);
router.post("/posts/:id/comments", communityPostController.addComment);
router.get("/posts/:id/comments", communityPostController.listComments);
router.delete("/posts/:id/comments/:commentId", communityPostController.deleteComment);
router.post("/posts/:id/save", communityPostController.save);
router.delete("/posts/:id/save", communityPostController.unsave);

// ─── Events ─────────────────────────────────────────────────────────────────────
router.post(
    "/communities/:communityId/events",
    requireCommunityRole("owner", "admin"),
    communityEventController.create
);
router.get(
    "/communities/:communityId/events",
    requireCommunityRole("owner", "admin", "moderator", "member"),
    communityEventController.listByCommunity
);
router.get("/events/:id", communityEventController.getById);
router.put("/events/:id", communityEventController.update);
router.delete("/events/:id", communityEventController.delete);
router.get("/events/:id/attendees", communityEventRSVPController.listAttendees);
router.post("/events/:id/rsvp", communityEventRSVPController.rsvp);
router.delete("/events/:id/rsvp", communityEventRSVPController.cancelRsvp);
router.put("/events/:id/reminder", communityEventRSVPController.setReminder);

// ─── Voice Spaces ───────────────────────────────────────────────────────────────
router.post(
    "/communities/:communityId/voice-spaces",
    requireCommunityRole("owner", "admin", "moderator", "member"),
    communityVoiceSpaceController.start
);
router.get(
    "/communities/:communityId/voice-spaces/active",
    requireCommunityRole("owner", "admin", "moderator", "member"),
    communityVoiceSpaceController.getActive
);
router.get(
    "/communities/:communityId/voice-spaces",
    requireCommunityRole("owner", "admin", "moderator", "member"),
    communityVoiceSpaceController.listHistory
);
router.get("/voice-spaces/:id", communityVoiceSpaceController.getById);
router.post("/voice-spaces/:id/end", communityVoiceSpaceController.end);
router.post("/voice-spaces/:id/join", communityVoiceSpaceParticipantController.join);
router.post("/voice-spaces/:id/leave", communityVoiceSpaceParticipantController.leave);
router.post("/voice-spaces/:id/request-to-speak", communityVoiceSpaceParticipantController.requestToSpeak);
router.get("/voice-spaces/:id/participants", communityVoiceSpaceParticipantController.listParticipants);
router.post("/voice-spaces/:id/participants/:userId/promote", communityVoiceSpaceParticipantController.promote);
router.post("/voice-spaces/:id/participants/:userId/demote", communityVoiceSpaceParticipantController.demote);

// ─── Invites ────────────────────────────────────────────────────────────────────
router.get(
    "/communities/:id/invites/search-users",
    requireCommunityRole("owner", "admin", "moderator", "member"),
    communityInviteController.searchUsers
);
router.get(
    "/communities/:id/invites/suggested-users",
    requireCommunityRole("owner", "admin", "moderator", "member"),
    communityInviteController.suggestedUsers
);
router.post(
    "/communities/:id/invites",
    requireCommunityRole("owner", "admin", "moderator", "member"),
    communityInviteController.send
);
router.get(
    "/communities/:id/invites",
    requireCommunityRole("owner", "admin"),
    communityInviteController.listSent
);
router.delete("/communities/:id/invites/:inviteId", communityInviteController.cancel);
router.post("/invites/:id/accept", communityInviteController.accept);
router.post("/invites/:id/decline", communityInviteController.decline);

module.exports = router;
