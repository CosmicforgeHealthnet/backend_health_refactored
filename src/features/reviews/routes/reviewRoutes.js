const router           = require("express").Router();
const reviewController = require("../controllers/reviewController");
const appFeedbackController = require("../controllers/appFeedbackController");
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");

// Both patients and doctors can submit/list reviews — direction is derived
// server-side from the appointment, so no role restriction here.
router.use(authenticateJWT);

router.post("/feedback", appFeedbackController.submit);
router.get("/feedback/mine", appFeedbackController.getMine);

router.post("/",        reviewController.submitReview);
router.get("/pending",  reviewController.getPendingReviews);
router.get("/mine",     reviewController.getMyReviews);

module.exports = router;
