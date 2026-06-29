const router = require("express").Router();

router.use("/auth",          require("./vendorAuthRoutes"));
router.use("/products",      require("./productRoutes"));
router.use("/carts",         require("./vendorCartRoutes"));
router.use("/orders",        require("./orderRoutes"));
router.use("/shipments",     require("./shipmentRoutes"));
router.use("/wallet",        require("./walletRoutes"));
router.use("/promotions",    require("./promotionRoutes"));
router.use("/analytics",     require("./analyticsRoutes"));
router.use("/notifications", require("../../notifications/routes/index"));

module.exports = router;
