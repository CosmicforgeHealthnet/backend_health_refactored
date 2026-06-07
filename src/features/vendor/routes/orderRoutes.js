const router          = require("express").Router();
const orderController = require("../controllers/orderController");
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");

router.use(authenticateJWT);

// ─── Patient order routes ─────────────────────────────────────────────────────
// Checkout a confirmed cart → creates order
router.post("/checkout/:cartId",          orderController.initiateCheckout);
// Initiate Paystack payment for an order
router.post("/:orderId/pay",              orderController.initiatePayment);
// Patient views their orders
router.get("/my",                         orderController.getMyOrders);
router.get("/my/:orderId",                orderController.getMyOrderById);
// Patient cancels (only pending, unpaid orders)
router.post("/my/:orderId/cancel",        orderController.cancelMyOrder);

// ─── Vendor order routes ──────────────────────────────────────────────────────
router.get("/vendor",                     orderController.getVendorOrders);
router.get("/vendor/:orderId",            orderController.getVendorOrderById);
// Vendor marks order as completed after fulfilment
router.post("/vendor/:orderId/complete",  orderController.completeOrder);
// Vendor cancels (only pending, unpaid orders)
router.post("/vendor/:orderId/cancel",    orderController.cancelVendorOrder);

module.exports = router;
