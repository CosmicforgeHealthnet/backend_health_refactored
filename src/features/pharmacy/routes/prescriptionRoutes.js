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
  getDashboardStats,
  getActivityFeed,
  confirmAvailability,
  addInternalNote,
  proposeAlternative,
  getPharmacyContacts,
  getPharmacyOrders,
  getPatientInvoices,
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
router.get("/patient/invoices", authorizeRoles('patient'), getPatientInvoices);

// Pharmacy-specific routes
router.post("/pharmacy/prescriptions/:prescriptionId/start-processing", authorizeRoles('pharmacy'), startProcessing);
router.post("/pharmacy/prescriptions/:prescriptionId/provide-costs", authorizeRoles('pharmacy'), provideCosts);
router.post("/pharmacy/prescriptions/:prescriptionId/mark-ready", authorizeRoles('pharmacy'), markReady);
router.post("/pharmacy/prescriptions/:prescriptionId/complete", authorizeRoles('pharmacy'), completePrescription);
router.get("/pharmacy/prescriptions", authorizeRoles('pharmacy'), getPharmacyPrescriptions);
router.get("/pharmacy/orders", authorizeRoles('pharmacy'), getPharmacyOrders);
router.get("/pharmacy/contacts", authorizeRoles('pharmacy'), getPharmacyContacts);
router.get("/pharmacy/dashboard/stats", authorizeRoles('pharmacy'), getDashboardStats);
router.get("/pharmacy/dashboard/activity", authorizeRoles('pharmacy'), getActivityFeed);
router.post("/pharmacy/prescriptions/:prescriptionId/confirm-availability", authorizeRoles('pharmacy'), confirmAvailability);
router.post("/pharmacy/prescriptions/:prescriptionId/internal-notes", authorizeRoles('pharmacy'), addInternalNote);
router.post("/pharmacy/prescriptions/:prescriptionId/propose-alternative", authorizeRoles('pharmacy'), proposeAlternative);

// Shared routes accessible by multiple roles
router.get("/search", authorizeRoles('doctor', 'patient', 'pharmacy'), searchPrescriptions);
router.post("/:prescriptionId/cancel", authorizeRoles('doctor', 'patient', 'pharmacy'), cancelPrescription);
router.post("/:prescriptionId/chat", authorizeRoles('patient', 'pharmacy'), addChatMessage);
router.get("/:prescriptionId", authorizeRoles('doctor', 'patient', 'pharmacy'), getPrescriptionById);

module.exports = router;