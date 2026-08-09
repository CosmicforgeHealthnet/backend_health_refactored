const router = require("express").Router();
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");
const { requireCommunityRole } = require("../middlewares/communityRoleMiddleware");
const communityController = require("../controllers/communityController");
const communityMembershipController = require("../controllers/communityMembershipController");
const communityPostController = require("../controllers/communityPostController");

router.use(authenticateJWT);

// ─── Static routes MUST come before /:id ─────────────────────────────────────
router.get("/communities/mine", communityController.getMyCommunities);
router.get("/communities/discover", communityController.discover);
router.get("/posts/saved", communityPostController.listMySavedPosts);

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

module.exports = router;
