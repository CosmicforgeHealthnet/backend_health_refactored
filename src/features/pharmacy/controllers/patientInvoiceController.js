const asyncHandler            = require("express-async-handler");
const pharmacyPaymentService  = require("../services/pharmacyPaymentService");
const pharmacyDisputeService  = require("../services/pharmacyDisputeService");

class PatientInvoiceController {
  listInvoices = asyncHandler(async (req, res) => {
    const patientId = req.user.sub;
    const data      = await pharmacyPaymentService.listPatientInvoices(patientId, req.query);
    res.status(200).json({ success: true, ...data });
  });

  getInvoice = asyncHandler(async (req, res) => {
    const patientId = req.user.sub;
    const data      = await pharmacyPaymentService.getPatientInvoice(patientId, req.params.id);
    res.status(200).json({ success: true, data });
  });

  markViewed = asyncHandler(async (req, res) => {
    const patientId = req.user.sub;
    const data      = await pharmacyPaymentService.markViewed(patientId, req.params.id);
    res.status(200).json({ success: true, data });
  });

  initiatePayment = asyncHandler(async (req, res) => {
    const patientId       = req.user.sub;
    const countryCode     = req.location?.countryCode || req.query.countryCode || "NG";
    const data            = await pharmacyPaymentService.initiatePayment(patientId, req.body, countryCode);
    res.status(200).json({ success: true, data });
  });

  verifyPayment = asyncHandler(async (req, res) => {
    const patientId = req.user.sub;
    const data      = await pharmacyPaymentService.verifyPayment(patientId, req.params.reference);
    res.status(200).json({ success: true, data });
  });

  raiseDispute = asyncHandler(async (req, res) => {
    const patientId = req.user.sub;
    const data      = await pharmacyDisputeService.raiseDispute(patientId, req.params.id, req.body);
    res.status(201).json({ success: true, data });
  });
}

module.exports = new PatientInvoiceController();
