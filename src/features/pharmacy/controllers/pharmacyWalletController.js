const asyncHandler          = require("express-async-handler");
const pharmacyProfileRepo   = require("../repositories/pharmacyProfileRepository");
const pharmacyWalletService = require("../services/pharmacyWalletService");
const pharmacyDisputeService = require("../services/pharmacyDisputeService");

async function resolvePharmacyId(userId) {
  const profile = await pharmacyProfileRepo.findByUserId(userId);
  if (!profile) throw Object.assign(new Error("Pharmacy profile not found"), { status: 404 });
  return profile.id;
}

class PharmacyWalletController {
  // ─── Wallet ──────────────────────────────────────────────────────────────

  getSummary = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await pharmacyWalletService.getSummary(pharmacyId);
    res.status(200).json({ success: true, data });
  });

  getTransactions = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await pharmacyWalletService.getTransactions(pharmacyId, req.query);
    res.status(200).json({ success: true, ...data });
  });

  getEarnings = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await pharmacyWalletService.getEarnings(pharmacyId, req.query);
    res.status(200).json({ success: true, data });
  });

  // ─── Payouts ─────────────────────────────────────────────────────────────

  getPayouts = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await pharmacyWalletService.getPayouts(pharmacyId, req.query);
    res.status(200).json({ success: true, ...data });
  });

  requestPayout = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await pharmacyWalletService.requestPayout(pharmacyId, req.body);
    res.status(201).json({ success: true, data });
  });

  cancelPayout = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await pharmacyWalletService.cancelPayout(pharmacyId, req.params.payoutId);
    res.status(200).json({ success: true, data });
  });

  // ─── Bank accounts ────────────────────────────────────────────────────────

  getBankAccounts = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await pharmacyWalletService.getBankAccounts(pharmacyId);
    res.status(200).json({ success: true, data });
  });

  addBankAccount = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await pharmacyWalletService.addBankAccount(pharmacyId, req.body);
    res.status(201).json({ success: true, data });
  });

  setDefaultBankAccount = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await pharmacyWalletService.setDefaultBankAccount(pharmacyId, req.params.accountId);
    res.status(200).json({ success: true, data });
  });

  deleteBankAccount = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    await pharmacyWalletService.deleteBankAccount(pharmacyId, req.params.accountId);
    res.status(204).send();
  });

  // ─── Disputes ─────────────────────────────────────────────────────────────

  getDisputes = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await pharmacyDisputeService.listDisputes(pharmacyId, req.query);
    res.status(200).json({ success: true, ...data });
  });

  respondToDispute = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await pharmacyDisputeService.respondToDispute(pharmacyId, req.params.disputeId, req.body);
    res.status(200).json({ success: true, data });
  });
}

module.exports = new PharmacyWalletController();
