const router             = require("express").Router();
const shipmentController = require("../controllers/shipmentController");
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");

// Public — frontend uses this to populate logistics provider dropdown
router.get("/providers", shipmentController.getSupportedProviders);

router.use(authenticateJWT);

// ─── Vendor ───────────────────────────────────────────────────────────────────
// Dispatch a paid order (creates shipment)
router.post("/vendor/:orderId/dispatch",  shipmentController.dispatchOrder);
// Mark order as delivered (completes the order)
router.post("/vendor/:orderId/delivered", shipmentController.markDelivered);
// View shipment for an order
router.get("/vendor/:orderId",            shipmentController.getVendorShipment);

// ─── Patient (tracking) ───────────────────────────────────────────────────────
router.get("/my/:orderId",                shipmentController.getPatientShipment);

module.exports = router;
