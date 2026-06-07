const router               = require("express").Router();
const vendorCartController = require("../controllers/vendorCartController");
const { authenticateJWT, authorizeRoles } = require("../../auth/middlewares/authMiddleware");

router.use(authenticateJWT);
router.use(authorizeRoles("vendor"));

router.get("/",                          vendorCartController.getVendorCarts);
router.get("/:cartId",                   vendorCartController.getVendorCartById);
router.post("/:cartId/confirm-pricing",  vendorCartController.confirmCartPricing);
router.post("/:cartId/cancel",           vendorCartController.cancelCart);

module.exports = router;
