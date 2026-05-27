const router = require("express").Router();

router.use("/auth",       require("./vendorAuthRoutes"));
router.use("/products",   require("./productRoutes"));
router.use("/carts",      require("./vendorCartRoutes"));
router.use("/promotions", require("./promotionRoutes"));
router.use("/analytics",  require("./analyticsRoutes"));

module.exports = router;
