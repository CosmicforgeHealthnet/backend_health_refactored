// ===================================
// src/routes/referralRoutes.js
// ===================================
const express = require("express");
const router = express.Router();
const ReferralController = require("../controllers/referralController");
const ReferralDrawController = require("../controllers/referralDrawController");

const referralController = new ReferralController();
const drawController = new ReferralDrawController();

const { authorizeRoles, authenticateJWT } = require("../../../shared/middlewares/authMiddleware");
const { USER_ROLES } = require("../../../shared/utils/constants");

const accepted_roles = [
  USER_ROLES.ADMIN,
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.MARKETER,

  //remove later
  // USER_ROLES.PATIENT,
  // USER_ROLES.DOCTOR
];


// Apply authentication to all routes
router.use(authenticateJWT);

// User referral routes
router.get(
  "/my-stats",
  referralController.getUserReferralInfo.bind(referralController)
);

router.get(
  "/my-referrals",
  referralController.getUserReferrals.bind(referralController)
);

router.get(
  "/leaderboard",
  referralController.getLeaderboard.bind(referralController)
);


// New routes for draw browsing
router.get('/draws-user',
  referralController.getAllDrawsForUsers.bind(referralController)
);

router.get('/draws/:drawId/leaderboard',
  referralController.getDrawLeaderboard.bind(referralController)
);

router.get('/draws/:drawId/my-stats',
  referralController.getUserDrawStats.bind(referralController)
);


router.post(
  "/process",
  referralController.processReferral.bind(referralController)
);

router.post(
  "/verify",
  referralController.verifyReferral.bind(referralController)
);

module.exports = router;

// ===================================
// src/routes/referralDrawRoutes.js
// ===================================

// Admin/Marketing routes
router.post(
  "/draws",
  authorizeRoles(...accepted_roles),
  drawController.createDraw.bind(drawController)
);

router.post(
  "/draws/:drawId/start",
  authorizeRoles(...accepted_roles),
  drawController.startDraw.bind(drawController)
);

router.post(
  "/draws/:drawId/end",
  authorizeRoles(...accepted_roles),
  drawController.endDraw.bind(drawController)
);

router.get(
  "/draws",
  authorizeRoles(...accepted_roles),
  drawController.getAllDraws.bind(drawController)
);

router.get(
  "/draws/:drawId/stats",
  authorizeRoles(...accepted_roles),
  drawController.getDrawStats.bind(drawController)
);

module.exports = router;
