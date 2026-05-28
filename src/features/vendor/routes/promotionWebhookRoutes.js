const router                     = require("express").Router();
const promotionWebhookController = require("../controllers/promotionWebhookController");

// Public — verified by signature, not JWT
router.post("/paystack",     promotionWebhookController.handlePaystack);
router.post("/flutterwave",  promotionWebhookController.handleFlutterwave);

module.exports = router;
