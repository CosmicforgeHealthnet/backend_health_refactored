// src/routes/pharmacy/authRoutes.js
const router = require("express").Router();
const pharmacyAuthController = require('../controllers/pharmacyAuthController');
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");

// Public routes
router.post("/register", pharmacyAuthController.registerPharmacy);
router.post("/login", pharmacyAuthController.loginPharmacy);

// Protected routes
router.get("/profile", authenticateJWT, pharmacyAuthController.getPharmacyProfile);

module.exports = router;