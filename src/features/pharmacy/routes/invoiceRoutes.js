const router             = require("express").Router();
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");
const invoiceController  = require("../controllers/invoiceController");

// ─── REMOVED: Invoice creation, update, send, and mark-paid ──────────────────
// The invoice-based payment flow has been replaced by the prescription cart
// session system. Patients now pay through /api/pharmacy/sessions.
//
// Disabled routes (return 410 Gone):
//   POST   /api/pharmacy/invoices
//   PATCH  /api/pharmacy/invoices/:id
//   POST   /api/pharmacy/invoices/:id/send
//   PATCH  /api/pharmacy/invoices/:id/mark-paid

const gone = (_req, res) => res.status(410).json({
    success: false,
    error:   "Invoice-based payments have been replaced by the prescription cart session system.",
    useInstead: "POST /api/pharmacy/sessions — start a session with a patient to build their cart.",
});

router.post("/",              authenticateJWT, gone);
router.patch("/:id",          authenticateJWT, gone);
router.post("/:id/send",      authenticateJWT, gone);
router.patch("/:id/mark-paid", authenticateJWT, gone);

// ─── KEPT: Read-only history access ──────────────────────────────────────────
router.get("/",   authenticateJWT, invoiceController.listInvoices);
router.get("/:id", authenticateJWT, invoiceController.getInvoice);

// ─── REMOVED: Cancel invoice (no longer valid — sessions handle cancellation) ─
router.patch("/:id/cancel", authenticateJWT, gone);

module.exports = router;
