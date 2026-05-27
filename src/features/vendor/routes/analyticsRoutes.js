const router               = require("express").Router();
const analyticsController  = require("../controllers/analyticsController");
const { authenticateJWT }  = require("../../auth/middlewares/authMiddleware");

router.use(authenticateJWT);

router.get("/overview",    analyticsController.getOverview);
router.get("/sales",       analyticsController.getSalesPerformance);
router.get("/products",    analyticsController.getProductPerformance);
router.get("/promotions",  analyticsController.getPromotionPerformance);

module.exports = router;
