// src/routes/pharmacy/index.js
const router = require("express").Router();
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");
const pharmacyAuthController = require("../controllers/pharmacyAuthController");

const authRoutes            = require("./authRoutes");
const documentRoutes        = require("./documentRoutes");
const adminRoutes           = require("./adminRoutes");
const prescriptionRoutes    = require("./prescriptionRoutes");
const invoiceRoutes         = require("./invoiceRoutes");
const walletRoutes          = require("./walletRoutes");
const hybridPharmacyRoutes  = require("./hybridPharmacyRoutes");
const sessionRoutes         = require("./sessionRoutes");

// Mount sub-routes
router.use("/auth", authRoutes);
router.use("/documents", documentRoutes);
router.use("/admin", adminRoutes);
router.use("/prescriptions", prescriptionRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/wallet", walletRoutes);
router.use("/vendor-mode", hybridPharmacyRoutes);
router.use("/sessions", sessionRoutes);

// List all pharmacies — patient-facing, defaults to approved only
router.get("/list", authenticateJWT, (req, res, next) => {
  if (!req.query.verificationStatus) req.query.verificationStatus = 'approved';
  next();
}, pharmacyAuthController.getAllPharmacies);

module.exports = router;