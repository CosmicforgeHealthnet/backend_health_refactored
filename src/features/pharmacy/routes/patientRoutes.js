const router                    = require("express").Router();
const patientInvoiceController  = require("../controllers/patientInvoiceController");
const patientWalletController   = require("../controllers/patientWalletController");

// All routes here are mounted under /api/patient and already authenticated
// via the global authenticateJWT applied in app.js for /api/patient

/**
 * @route   GET /api/patient/invoices
 * @desc    List all invoices sent to the authenticated patient
 * @access  Patient
 */
router.get("/invoices", patientInvoiceController.listInvoices);

/**
 * @route   GET /api/patient/invoices/:id
 * @desc    Get a single invoice with full details
 * @access  Patient
 */
router.get("/invoices/:id", patientInvoiceController.getInvoice);

/**
 * @route   PATCH /api/patient/invoices/:id/viewed
 * @desc    Mark invoice as viewed by patient
 * @access  Patient
 */
router.patch("/invoices/:id/viewed", patientInvoiceController.markViewed);

/**
 * @route   POST /api/patient/invoices/:id/dispute
 * @desc    Raise a dispute on a paid invoice (within 7 days)
 * @access  Patient
 */
router.post("/invoices/:id/dispute", patientInvoiceController.raiseDispute);

/**
 * @route   POST /api/patient/payments/initiate
 * @desc    Initiate payment for an invoice — returns gateway redirect URL
 * @access  Patient
 */
router.post("/payments/initiate", patientInvoiceController.initiatePayment);

/**
 * @route   GET /api/patient/payments/verify/:reference
 * @desc    Verify payment after returning from gateway
 * @access  Patient
 */
router.get("/payments/verify/:reference", patientInvoiceController.verifyPayment);

// ─── Patient Wallet ───────────────────────────────────────────────────────────

/**
 * @route   GET /api/patient/wallet/summary
 * @desc    Get patient wallet overview (balance, total spent, total top-ups)
 * @access  Patient
 */
router.get("/wallet/summary", patientWalletController.getSummary);

/**
 * @route   GET /api/patient/wallet/transactions
 * @desc    List wallet transactions with filters (type, category, page, limit)
 * @access  Patient
 */
router.get("/wallet/transactions", patientWalletController.getTransactions);

/**
 * @route   POST /api/patient/wallet/top-up
 * @desc    Initiate a wallet top-up — returns gateway authorization URL
 * @access  Patient
 */
router.post("/wallet/top-up", patientWalletController.topUp);

module.exports = router;
