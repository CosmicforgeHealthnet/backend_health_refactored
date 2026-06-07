const router            = require("express").Router();
const sessionController = require("../controllers/pharmacySessionController");
const { authenticateJWT, authorizeRoles } = require("../../../shared/middlewares/authMiddleware");

router.use(authenticateJWT);

// ─── Patient routes ───────────────────────────────────────────────────────────

// Start a new session with a pharmacy for a prescription
router.post("/",                                  authorizeRoles("patient"), sessionController.startSession);
// List my sessions
router.get("/my",                                 authorizeRoles("patient"), sessionController.getPatientSessions);
// Get single session detail
router.get("/my/:sessionId",                      authorizeRoles("patient"), sessionController.getPatientSessionById);
// Approve cart and get payment URL
router.post("/my/:sessionId/approve",             authorizeRoles("patient"), sessionController.approveAndPay);
// Cancel a session
router.post("/my/:sessionId/cancel",              authorizeRoles("patient"), sessionController.cancelSession);

// ─── Pharmacy routes ──────────────────────────────────────────────────────────

// List incoming sessions
router.get("/pharmacy",                           authorizeRoles("pharmacy"), sessionController.getPharmacySessions);
// Get single session detail
router.get("/pharmacy/:sessionId",                authorizeRoles("pharmacy"), sessionController.getPharmacySessionById);
// Add item to prescription cart
router.post("/pharmacy/:sessionId/cart/items",    authorizeRoles("pharmacy"), sessionController.addCartItem);
// Remove item from prescription cart
router.delete("/pharmacy/:sessionId/cart/items/:itemId", authorizeRoles("pharmacy"), sessionController.removeCartItem);
// Finalise cart — notify patient to approve and pay
router.post("/pharmacy/:sessionId/cart/finalise", authorizeRoles("pharmacy"), sessionController.finaliseCart);
// Cancel a session
router.post("/pharmacy/:sessionId/cancel",        authorizeRoles("pharmacy"), sessionController.cancelSessionByPharmacy);

module.exports = router;
