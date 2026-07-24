const router         = require("express").Router();
const cartController = require("../controllers/cartController");
const { authenticateJWT, authorizeRoles } = require("../../auth/middlewares/authMiddleware");

// All cart routes: authenticated patients only
router.use(authenticateJWT);
router.use(authorizeRoles("patient"));

// ─── Static paths MUST come before /:cartId ──────────────────────────────────

// Patient's cart list
router.get("/",    cartController.getMyCarts);
router.get("/my",  cartController.getMyCarts);  // alias used by frontend

// Add item to cart for a specific vendor
router.post("/vendor/:vendorId/items", cartController.addItem);

// ─── Parameterized routes ─────────────────────────────────────────────────────

// Single cart detail
router.get("/:cartId", cartController.getMyCart);

// Submit / pay / cancel
router.post("/:cartId/submit", cartController.submitCart);
router.post("/:cartId/pay",    cartController.initiatePayment);
router.post("/:cartId/cancel", cartController.cancelCart);

// Remove item
router.delete("/:cartId/items/:itemId", cartController.removeItem);

module.exports = router;
