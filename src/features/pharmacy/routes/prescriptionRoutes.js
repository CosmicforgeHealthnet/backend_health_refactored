const router = require("express").Router();
const { authenticateJWT, authorizeRoles } = require("../../../shared/middlewares/authMiddleware");

const {
  createPrescription,
  uploadPrescription,
  assignPharmacy,
  startProcessing,
  addChatMessage,
  markReady,
  completePrescription,
  cancelPrescription,
  updatePrescriptionStatus,
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
  approveAlternative,
  rejectAlternative,
  getPharmacyContacts,
  getPharmacyOrders,
  getDispatchItems,
  initiateDispatch,
  markDelivered,
} = require("../controllers/prescriptionController");

// ─── REMOVED: Invoice-based cost entry and patient invoice list ───────────────
// provide-costs has been replaced by the session cart system.
// Patients view their cart/costs through /api/pharmacy/sessions.
const gone = (_req, res) => res.status(410).json({
  success:    false,
  error:      "This route has been replaced by the prescription cart session system.",
  useInstead: "Use /api/pharmacy/sessions for cost management and patient invoices.",
});

const requireFeature = require("../../subscriptions/middlewares/requireFeature");

router.use(authenticateJWT);

// ── Doctor routes ─────────────────────────────────────────────────────────────
router.post("/doctor/prescriptions", authorizeRoles('doctor'), createPrescription);
router.get("/doctor/prescriptions", authorizeRoles('doctor'), getDoctorPrescriptions);

// ── Patient routes ────────────────────────────────────────────────────────────
router.post("/patient/prescriptions/:prescriptionId/upload", authorizeRoles('patient'), requireFeature("pharmacy"), uploadPrescription);
router.post("/patient/prescriptions/:prescriptionId/assign-pharmacy", authorizeRoles('patient'), requireFeature("pharmacy"), assignPharmacy);
router.get("/patient/prescriptions", authorizeRoles('patient'), getPatientPrescriptions);
router.get("/patient/invoices", authorizeRoles('patient'), gone);

// ── Pharmacy — static routes (MUST come before /:prescriptionId) ──────────────
router.get("/dashboard/stats", authorizeRoles('pharmacy'), getDashboardStats);
router.get("/dashboard/activity", authorizeRoles('pharmacy'), getActivityFeed);
router.get("/active", authorizeRoles('pharmacy'), getPharmacyOrders);
router.get("/contacts", authorizeRoles('pharmacy'), getPharmacyContacts);
router.get("/search", authorizeRoles('doctor', 'patient', 'pharmacy'), searchPrescriptions);
router.get("/dispatch", authorizeRoles('pharmacy'), getDispatchItems);
router.get("/", authorizeRoles('pharmacy'), getPharmacyPrescriptions);

// ── Pharmacy — parameterized routes ──────────────────────────────────────────
router.post("/:prescriptionId/start-processing", authorizeRoles('pharmacy'), startProcessing);
router.post("/:prescriptionId/provide-costs", authorizeRoles('pharmacy'), gone);
router.post("/:prescriptionId/mark-ready", authorizeRoles('pharmacy'), markReady);
router.post("/:prescriptionId/complete", authorizeRoles('pharmacy'), completePrescription);
router.post("/:prescriptionId/confirm-availability", authorizeRoles('pharmacy'), confirmAvailability);
router.post("/:prescriptionId/internal-notes", authorizeRoles('pharmacy'), addInternalNote);
router.post("/:prescriptionId/propose-alternative", authorizeRoles('pharmacy'), proposeAlternative);
router.post("/:prescriptionId/approve-alternative", authorizeRoles('doctor'), approveAlternative);
router.post("/:prescriptionId/reject-alternative", authorizeRoles('doctor'), rejectAlternative);
router.post("/:prescriptionId/dispatch", authorizeRoles('pharmacy'), initiateDispatch);
router.post("/:prescriptionId/delivered", authorizeRoles('pharmacy'), markDelivered);
router.patch("/:prescriptionId/status", authorizeRoles('pharmacy'), updatePrescriptionStatus);

// ── Shared routes ─────────────────────────────────────────────────────────────
router.post("/:prescriptionId/cancel", authorizeRoles('doctor', 'patient', 'pharmacy'), cancelPrescription);
router.post("/:prescriptionId/chat", authorizeRoles('patient', 'pharmacy'), addChatMessage);
router.get("/:prescriptionId", authorizeRoles('doctor', 'patient', 'pharmacy'), getPrescriptionById);

module.exports = router;
