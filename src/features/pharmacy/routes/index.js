// src/routes/pharmacy/index.js
const router = require("express").Router();

const authRoutes = require("./authRoutes");
const documentRoutes = require("./documentRoutes");
const adminRoutes = require("./adminRoutes");
const prescriptionRoutes = require("./prescriptionRoutes");

// Mount sub-routes
router.use("/auth", authRoutes);
router.use("/documents", documentRoutes);
router.use("/admin", adminRoutes);
router.use("/prescriptions", prescriptionRoutes);

module.exports = router;