const router                  = require("express").Router();
const patientWalletController = require("../controllers/patientWalletController");

// All routes here are mounted under /api/patient and already authenticated
// via the global authenticateJWT applied in app.js for /api/patient

// ─── REMOVED: Invoice-based patient payment flow ──────────────────────────────
// Patients no longer pay via invoices. The prescription cart session system
// (POST /api/pharmacy/sessions) replaced this flow end-to-end.
//
// Disabled routes (return 410 Gone):
//   GET    /api/patient/invoices
//   GET    /api/patient/invoices/:id
//   PATCH  /api/patient/invoices/:id/viewed
//   POST   /api/patient/invoices/:id/dispute
//   POST   /api/patient/payments/initiate
//   GET    /api/patient/payments/verify/:reference

const gone = (_req, res) => res.status(410).json({
    success:    false,
    error:      "Invoice-based payments have been replaced by the prescription cart session system.",
    useInstead: "Use /api/pharmacy/sessions for the current payment flow.",
});

router.get("/invoices",                    gone);
router.get("/invoices/:id",                gone);
router.patch("/invoices/:id/viewed",       gone);
router.post("/invoices/:id/dispute",       gone);
router.post("/payments/initiate",          gone);
router.get("/payments/verify/:reference",  gone);

// ─── KEPT: Patient Wallet ─────────────────────────────────────────────────────

router.get("/wallet/summary",      patientWalletController.getSummary);
router.get("/wallet/transactions", patientWalletController.getTransactions);
router.post("/wallet/top-up",      patientWalletController.topUp);

module.exports = router;
