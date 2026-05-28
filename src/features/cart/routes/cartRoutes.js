const router         = require("express").Router();
const cartController = require("../controllers/cartController");
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");

// All cart routes require auth (patient must be logged in)
router.use(authenticateJWT);

// Patient's cart list
router.get("/", cartController.getMyCarts);

// Single cart detail
router.get("/:cartId", cartController.getMyCart);

// Submit cart to vendor
router.post("/:cartId/submit", cartController.submitCart);

// Cancel cart
router.post("/:cartId/cancel", cartController.cancelCart);

// Add item to cart for a specific vendor
router.post("/vendor/:vendorId/items", cartController.addItem);

// Update / remove item
router.put("/:cartId/items/:itemId",    cartController.updateItemQuantity);
router.delete("/:cartId/items/:itemId", cartController.removeItem);

module.exports = router;
