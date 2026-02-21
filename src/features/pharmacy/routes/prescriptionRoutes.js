const router = require("express").Router();
const { authenticateJWT, authorizeRoles } = require("../../../shared/middlewares/authMiddleware");

const {
  createPrescription,
  uploadPrescription,
  assignPharmacy,
  startProcessing,
  provideCosts,
  addChatMessage,
  markReady,
  completePrescription,
  cancelPrescription,
  getPrescriptionById,
  getDoctorPrescriptions,
  getPatientPrescriptions,
  getPharmacyPrescriptions,
  searchPrescriptions,
} = require("../controllers/prescriptionController");

// Subscription middlewares
const requireFeature = require("../../subscriptions/middlewares/requireFeature");

// Apply authentication to all routes
router.use(authenticateJWT);

// Doctor-specific routes
router.post("/doctor/prescriptions", authorizeRoles('doctor'), createPrescription);
router.get("/doctor/prescriptions", authorizeRoles('doctor'), getDoctorPrescriptions);

// Patient-specific routes - require pharmacy feature
router.post("/patient/prescriptions/:prescriptionId/upload", authorizeRoles('patient'), requireFeature("pharmacy"), uploadPrescription);
router.post("/patient/prescriptions/:prescriptionId/assign-pharmacy", authorizeRoles('patient'), requireFeature("pharmacy"), assignPharmacy);
router.get("/patient/prescriptions", authorizeRoles('patient'), getPatientPrescriptions);

// Pharmacy-specific routes
router.post("/pharmacy/prescriptions/:prescriptionId/start-processing", authorizeRoles('pharmacy'), startProcessing);
router.post("/pharmacy/prescriptions/:prescriptionId/provide-costs", authorizeRoles('pharmacy'), provideCosts);
router.post("/pharmacy/prescriptions/:prescriptionId/mark-ready", authorizeRoles('pharmacy'), markReady);
router.post("/pharmacy/prescriptions/:prescriptionId/complete", authorizeRoles('pharmacy'), completePrescription);
router.get("/pharmacy/prescriptions", authorizeRoles('pharmacy'), getPharmacyPrescriptions);

// Shared routes accessible by multiple roles
router.post("/:prescriptionId/cancel", authorizeRoles('doctor', 'patient', 'pharmacy'), cancelPrescription);
router.post("/:prescriptionId/chat", authorizeRoles('patient', 'pharmacy'), addChatMessage);
router.get("/:prescriptionId", authorizeRoles('doctor', 'patient', 'pharmacy'), getPrescriptionById);
router.get("/search", authorizeRoles('doctor', 'patient', 'pharmacy'), searchPrescriptions);

module.exports = router;