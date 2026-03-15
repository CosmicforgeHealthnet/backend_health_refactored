const asyncHandler        = require("express-async-handler");
const patientWalletService = require("../services/patientWalletService");

class PatientWalletController {
  getSummary = asyncHandler(async (req, res) => {
    const patientId   = req.user.sub;
    const countryCode = req.location?.countryCode || req.query.countryCode || "US";
    const data        = await patientWalletService.getSummary(patientId, countryCode);
    res.status(200).json({ success: true, data });
  });

  getTransactions = asyncHandler(async (req, res) => {
    const patientId   = req.user.sub;
    const countryCode = req.location?.countryCode || req.query.countryCode || "US";
    const data        = await patientWalletService.getTransactions(patientId, req.query, countryCode);
    res.status(200).json({ success: true, ...data });
  });

  topUp = asyncHandler(async (req, res) => {
    const patientId   = req.user.sub;
    const countryCode = req.location?.countryCode || req.query.countryCode || "US";
    const data        = await patientWalletService.initiateTopUp(patientId, req.body, countryCode);
    res.status(200).json({ success: true, data });
  });
}

module.exports = new PatientWalletController();
