const router                   = require("express").Router();
const { authenticateJWT }      = require("../../auth/middlewares/authMiddleware");
const pharmacyWalletController = require("../controllers/pharmacyWalletController");

// ─── Wallet summary & transactions ──────────────────────────────────────────

/**
 * @route   GET /api/pharmacy/wallet/summary
 * @desc    Get wallet overview (balances, earnings, last payout)
 * @access  Pharmacy staff
 */
router.get("/summary", authenticateJWT, pharmacyWalletController.getSummary);

/**
 * @route   GET /api/pharmacy/wallet/transactions
 * @desc    List wallet transactions with filters
 * @access  Pharmacy staff
 */
router.get("/transactions", authenticateJWT, pharmacyWalletController.getTransactions);

/**
 * @route   GET /api/pharmacy/wallet/earnings
 * @desc    Get earnings summary and period breakdown
 * @access  Pharmacy staff
 */
router.get("/earnings", authenticateJWT, pharmacyWalletController.getEarnings);

// ─── Payouts ─────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/pharmacy/wallet/payouts
 * @desc    List payout requests
 * @access  Pharmacy staff (admin/owner)
 */
router.get("/payouts", authenticateJWT, pharmacyWalletController.getPayouts);

/**
 * @route   POST /api/pharmacy/wallet/payouts
 * @desc    Request a payout to a saved bank account
 * @access  Pharmacy staff (admin/owner)
 */
router.post("/payouts", authenticateJWT, pharmacyWalletController.requestPayout);

/**
 * @route   PATCH /api/pharmacy/wallet/payouts/:payoutId/cancel
 * @desc    Cancel a pending payout
 * @access  Pharmacy staff (admin/owner)
 */
router.patch("/payouts/:payoutId/cancel", authenticateJWT, pharmacyWalletController.cancelPayout);

// ─── Bank accounts ────────────────────────────────────────────────────────────

/**
 * @route   GET /api/pharmacy/wallet/bank-accounts
 * @desc    List all saved bank accounts for this pharmacy
 * @access  Pharmacy staff
 */
router.get("/bank-accounts", authenticateJWT, pharmacyWalletController.getBankAccounts);

/**
 * @route   POST /api/pharmacy/wallet/bank-accounts
 * @desc    Add and verify a new bank account
 * @access  Pharmacy staff (admin/owner)
 */
router.post("/bank-accounts", authenticateJWT, pharmacyWalletController.addBankAccount);

/**
 * @route   PATCH /api/pharmacy/wallet/bank-accounts/:accountId/set-default
 * @desc    Set a bank account as default payout destination
 * @access  Pharmacy staff (admin/owner)
 */
router.patch("/bank-accounts/:accountId/set-default", authenticateJWT, pharmacyWalletController.setDefaultBankAccount);

/**
 * @route   DELETE /api/pharmacy/wallet/bank-accounts/:accountId
 * @desc    Remove a bank account
 * @access  Pharmacy staff (admin/owner)
 */
router.delete("/bank-accounts/:accountId", authenticateJWT, pharmacyWalletController.deleteBankAccount);

// ─── Disputes ─────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/pharmacy/wallet/disputes
 * @desc    List disputes involving this pharmacy
 * @access  Pharmacy staff
 */
router.get("/disputes", authenticateJWT, pharmacyWalletController.getDisputes);

/**
 * @route   POST /api/pharmacy/wallet/disputes/:disputeId/respond
 * @desc    Submit a pharmacy response to an open dispute
 * @access  Pharmacy staff
 */
router.post("/disputes/:disputeId/respond", authenticateJWT, pharmacyWalletController.respondToDispute);

module.exports = router;
