// src/routes/pharmacy/index.js
const router = require("express").Router();
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");
const pharmacyAuthController = require("../controllers/pharmacyAuthController");

const authRoutes = require("./authRoutes");
const documentRoutes = require("./documentRoutes");
const adminRoutes = require("./adminRoutes");
const prescriptionRoutes = require("./prescriptionRoutes");

// Mount sub-routes
router.use("/auth", authRoutes);
router.use("/documents", documentRoutes);
router.use("/admin", adminRoutes);
router.use("/prescriptions", prescriptionRoutes);

// List all pharmacies — accessible to any authenticated user (?page=&limit=&verificationStatus=)
router.get("/list", authenticateJWT, pharmacyAuthController.getAllPharmacies);

module.exports = router;