// src/routes/pharmacy/authRoutes.js
const router = require("express").Router();
const pharmacyAuthController = require('../controllers/pharmacyAuthController');
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");

// Public routes
router.post("/register", pharmacyAuthController.registerPharmacy);
router.post("/login", pharmacyAuthController.loginPharmacy);

// Protected routes
router.get("/profile", authenticateJWT, pharmacyAuthController.getPharmacyProfile);
router.put("/profile", authenticateJWT, pharmacyAuthController.updatePharmacyProfile);
router.get("/pricing", authenticateJWT, pharmacyAuthController.getPricing);
router.post("/pricing", authenticateJWT, pharmacyAuthController.setPricing);

// Staff management
router.post("/staff", authenticateJWT, pharmacyAuthController.addStaff);
router.get("/staff", authenticateJWT, pharmacyAuthController.getStaff);
router.delete("/staff/:id", authenticateJWT, pharmacyAuthController.removeStaff);

module.exports = router;