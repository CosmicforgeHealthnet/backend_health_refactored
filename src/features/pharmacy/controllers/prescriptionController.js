const PrescriptionService = require("../services/prescriptionService");
const asyncHandler = require("express-async-handler");
const pharmacyProfileRepo = require("../repositories/pharmacyProfileRepository");

/**
 * Resolve pharmacy profile ID from the authenticated user's ID.
 * Pharmacy routes receive a user JWT (sub = userId), but the prescription
 * service operates on pharmacy PROFILE IDs — so we do one lookup here.
 */
async function resolvePharmacyId(userId) {
  const profile = await pharmacyProfileRepo.findByUserId(userId);
  if (!profile) throw Object.assign(new Error("Pharmacy profile not found"), { status: 404 });
  return profile.id;
}

/**
 * Controller for handling prescription-related HTTP requests
 */
class PrescriptionController {
  /**
   * Create a new prescription
   */
  createPrescription = asyncHandler(async (req, res) => {
    const prescriptionData = req.body;
    const doctorId = req.user.sub;
    const prescription = await PrescriptionService.createPrescription(prescriptionData, doctorId);
    res.status(201).json({ success: true, data: prescription });
  });

  /**
   * Upload prescription by patient
   */
  uploadPrescription = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const patientId = req.user.sub;
    const prescription = await PrescriptionService.uploadPrescription(prescriptionId, patientId);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Assign pharmacy to prescription
   */
  assignPharmacy = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const { pharmacyId, deliveryDetails } = req.body;
    const patientId = req.user.sub;
    const prescription = await PrescriptionService.assignPharmacy(prescriptionId, pharmacyId, patientId, deliveryDetails);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Start processing prescription
   */
  startProcessing = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const { pharmacistId } = req.body;
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const prescription = await PrescriptionService.startProcessing(prescriptionId, pharmacyId, pharmacistId);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Provide medication costs
   */
  provideCosts = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const invoiceData = req.body;
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const prescription = await PrescriptionService.provideCosts(prescriptionId, pharmacyId, invoiceData);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Add chat message
   */
  addChatMessage = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const messageData = req.body;
    const { senderType } = messageData;
    const userId = req.user.sub;
    // Patients use their user ID; pharmacy uses the pharmacy profile ID
    const senderId = senderType === 'pharmacy' ? await resolvePharmacyId(userId) : userId;
    const prescription = await PrescriptionService.addChatMessage(prescriptionId, messageData, senderId);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Mark prescription as ready
   */
  markReady = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const { readyType, expectedDate } = req.body;
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const prescription = await PrescriptionService.markReady(prescriptionId, pharmacyId, readyType, expectedDate);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Complete prescription
   */
  completePrescription = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const prescription = await PrescriptionService.completePrescription(prescriptionId, pharmacyId);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Cancel prescription
   */
  cancelPrescription = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const { reason } = req.body;
    const userId = req.user.sub;
    const role = req.user.role;
    // Pharmacy users are identified by profile ID in prescriptions, not their user ID
    let cancelId = userId;
    if (role === 'pharmacy') {
      const profile = await pharmacyProfileRepo.findByUserId(userId);
      if (profile) cancelId = profile.id;
    }
    const prescription = await PrescriptionService.cancelPrescription(prescriptionId, cancelId, reason);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Get prescription by ID
   */
  getPrescriptionById = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const userId = req.user.sub;
    const role = req.user.role;
    const prescription = await PrescriptionService.getPrescriptionById(prescriptionId, userId, role);
    if (!prescription) return res.status(404).json({ success: false, message: 'Prescription not found' });
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Get doctor's prescriptions
   */
  getDoctorPrescriptions = asyncHandler(async (req, res) => {
    const doctorId = req.user.sub;
    const options = req.query;
    const prescriptions = await PrescriptionService.getDoctorPrescriptions(doctorId, options);
    res.status(200).json({ success: true, data: prescriptions });
  });

  /**
   * Get patient's prescriptions
   */
  getPatientPrescriptions = asyncHandler(async (req, res) => {
    const patientId = req.user.sub;
    const options = req.query;
    const prescriptions = await PrescriptionService.getPatientPrescriptions(patientId, options);
    res.status(200).json({ success: true, data: prescriptions });
  });

  /**
   * Get pharmacy's prescriptions
   */
  getPharmacyPrescriptions = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const options = req.query;
    const prescriptions = await PrescriptionService.getPharmacyPrescriptions(pharmacyId, options);
    res.status(200).json({ success: true, data: prescriptions });
  });

  /**
   * Get pharmacy dashboard statistics
   */
  getDashboardStats = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const stats = await PrescriptionService.getDashboardStats(pharmacyId);
    res.status(200).json({ success: true, data: stats });
  });

  /**
   * Get pharmacy activity feed
   */
  getActivityFeed = asyncHandler(async (req, res) => {
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const { limit } = req.query;
    const feed = await PrescriptionService.getActivityFeed(pharmacyId, parseInt(limit));
    res.status(200).json({ success: true, data: feed });
  });

  /**
   * Confirm medication availability
   */
  confirmAvailability = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const prescription = await PrescriptionService.confirmAvailability(prescriptionId, pharmacyId);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Add internal pharmacy note
   */
  addInternalNote = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const noteData = req.body; // {note, pharmacistId}
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const prescription = await PrescriptionService.addInternalNote(prescriptionId, pharmacyId, noteData);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Propose alternative medications
   */
  proposeAlternative = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const { alternatives, pharmacistId } = req.body;
    const pharmacyId = await resolvePharmacyId(req.user.sub);
    const prescription = await PrescriptionService.proposeAlternative(prescriptionId, pharmacyId, alternatives, pharmacistId);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Search prescriptions
   */
  searchPrescriptions = asyncHandler(async (req, res) => {
    const { query: searchTerm, page, limit } = req.query;
    const prescriptions = await PrescriptionService.searchPrescriptions(searchTerm || "", { page, limit });
    res.status(200).json({ success: true, data: prescriptions });
  });
}

module.exports = new PrescriptionController();
