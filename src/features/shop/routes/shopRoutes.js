const router         = require("express").Router();
const shopController = require("../controllers/shopController");

// All shop browsing routes are public — no auth required to browse
router.get("/categories",                        shopController.getCategories);
router.get("/categories/:category/subcategories", shopController.getSubcategories);
router.get("/products",                          shopController.browseProducts);
router.get("/products/:id",                      shopController.getProductById);
router.get("/vendors/:vendorId",                 shopController.getVendorInfo);

module.exports = router;
