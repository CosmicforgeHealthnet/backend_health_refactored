const router                    = require("express").Router();
const patientInvoiceController  = require("../controllers/patientInvoiceController");

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

module.exports = router;
