const asyncHandler          = require("express-async-handler");
const pharmacyProfileRepo   = require("../repositories/pharmacyProfileRepository");
const invoiceService        = require("../services/invoiceService");

async function resolvePharmacyId(userId) {
  const profile = await pharmacyProfileRepo.findByUserId(userId);
  if (!profile) throw Object.assign(new Error("Pharmacy profile not found"), { status: 404 });
  return profile.id;
}

class InvoiceController {
  createInvoice = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await invoiceService.createInvoice(pharmacyId, req.body);
    res.status(201).json({ success: true, data });
  });

  listInvoices = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await invoiceService.listInvoices(pharmacyId, req.query);
    res.status(200).json({ success: true, ...data });
  });

  getInvoice = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await invoiceService.getInvoice(pharmacyId, req.params.id);
    res.status(200).json({ success: true, data });
  });

  updateInvoice = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await invoiceService.updateInvoice(pharmacyId, req.params.id, req.body);
    res.status(200).json({ success: true, data });
  });

  sendInvoice = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await invoiceService.sendInvoice(pharmacyId, req.params.id);
    res.status(200).json({ success: true, data });
  });

  cancelInvoice = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await invoiceService.cancelInvoice(pharmacyId, req.params.id);
    res.status(200).json({ success: true, data });
  });

  markPaid = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const data       = await invoiceService.markPaid(pharmacyId, req.params.id);
    res.status(200).json({ success: true, data });
  });
}

module.exports = new InvoiceController();
