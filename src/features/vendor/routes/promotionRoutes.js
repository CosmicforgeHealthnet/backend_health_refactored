const router               = require("express").Router();
const promotionController  = require("../controllers/promotionController");
const { authenticateJWT }  = require("../../auth/middlewares/authMiddleware");

// Public — pricing reference, no auth needed
router.get("/pricing", promotionController.getPricingInfo);

// All other routes require auth
router.use(authenticateJWT);

router.get("/",           promotionController.getMyPromotions);
router.post("/",          promotionController.createPromotion);
router.get("/trends",     promotionController.getTrends);
router.get("/:id",        promotionController.getMyPromotionById);
router.put("/:id",        promotionController.updatePromotion);
router.delete("/:id",     promotionController.deletePromotion);
router.post("/:id/pay",   promotionController.initiatePayment);
router.post("/:id/cancel", promotionController.cancelPromotion);

module.exports = router;
