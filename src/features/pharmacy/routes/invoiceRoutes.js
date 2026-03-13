const router             = require("express").Router();
const { authenticateJWT } = require("../../auth/middlewares/authMiddleware");
const invoiceController  = require("../controllers/invoiceController");

/**
 * @route   POST /api/pharmacy/invoices
 * @desc    Create a draft invoice for a prescription
 * @access  Pharmacy staff
 */
router.post("/", authenticateJWT, invoiceController.createInvoice);

/**
 * @route   GET /api/pharmacy/invoices
 * @desc    List all invoices for the authenticated pharmacy
 * @access  Pharmacy staff
 */
router.get("/", authenticateJWT, invoiceController.listInvoices);

/**
 * @route   GET /api/pharmacy/invoices/:id
 * @desc    Get a single invoice by ID
 * @access  Pharmacy staff
 */
router.get("/:id", authenticateJWT, invoiceController.getInvoice);

/**
 * @route   PATCH /api/pharmacy/invoices/:id
 * @desc    Update a draft invoice
 * @access  Pharmacy staff
 */
router.patch("/:id", authenticateJWT, invoiceController.updateInvoice);

/**
 * @route   POST /api/pharmacy/invoices/:id/send
 * @desc    Send invoice to patient (draft → sent)
 * @access  Pharmacy staff
 */
router.post("/:id/send", authenticateJWT, invoiceController.sendInvoice);

/**
 * @route   PATCH /api/pharmacy/invoices/:id/cancel
 * @desc    Cancel an invoice
 * @access  Pharmacy staff
 */
router.patch("/:id/cancel", authenticateJWT, invoiceController.cancelInvoice);

/**
 * @route   PATCH /api/pharmacy/invoices/:id/mark-paid
 * @desc    Manually mark a pay_on_pickup invoice as paid
 * @access  Pharmacy staff
 */
router.patch("/:id/mark-paid", authenticateJWT, invoiceController.markPaid);

module.exports = router;
