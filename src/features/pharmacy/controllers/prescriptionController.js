const PrescriptionService = require("../services/prescriptionService");
const asyncHandler = require("express-async-handler");

/**
 * Controller for handling prescription-related HTTP requests
 */
class PrescriptionController {
  /**
   * Create a new prescription
   */
  createPrescription = asyncHandler(async (req, res) => {
    const prescriptionData = req.body;
    const doctorId = req.user.sub; // Assuming authenticated user ID
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
    const patientId = req.user.id;
    const prescription = await PrescriptionService.assignPharmacy(prescriptionId, pharmacyId, patientId, deliveryDetails);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Start processing prescription
   */
  startProcessing = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const { pharmacistId } = req.body;
    const pharmacyId = req.user.id; // Assuming authenticated pharmacy user
    const prescription = await PrescriptionService.startProcessing(prescriptionId, pharmacyId, pharmacistId);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Provide medication costs
   */
  provideCosts = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const invoiceData = req.body;
    const pharmacyId = req.user.id;
    const prescription = await PrescriptionService.provideCosts(prescriptionId, pharmacyId, invoiceData);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Add chat message
   */
  addChatMessage = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const messageData = req.body;
    const senderId = req.user.id;
    const prescription = await PrescriptionService.addChatMessage(prescriptionId, messageData, senderId);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Mark prescription as ready
   */
  markReady = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const { readyType, expectedDate } = req.body;
    const pharmacyId = req.user.id;
    const prescription = await PrescriptionService.markReady(prescriptionId, pharmacyId, readyType, expectedDate);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Complete prescription
   */
  completePrescription = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const pharmacyId = req.user.id;
    const prescription = await PrescriptionService.completePrescription(prescriptionId, pharmacyId);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Cancel prescription
   */
  cancelPrescription = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const prescription = await PrescriptionService.cancelPrescription(prescriptionId, userId, reason);
    res.status(200).json({ success: true, data: prescription });
  });

  /**
   * Get prescription by ID
   */
  getPrescriptionById = asyncHandler(async (req, res) => {
    const { prescriptionId } = req.params;
    const prescription = await PrescriptionService.getPrescriptionById(prescriptionId);
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
    const pharmacyId = req.user.id;
    const options = req.query;
    const prescriptions = await PrescriptionService.getPharmacyPrescriptions(pharmacyId, options);
    res.status(200).json({ success: true, data: prescriptions });
  });

  /**
   * Search prescriptions
   */
  searchPrescriptions = asyncHandler(async (req, res) => {
    const query = req.query;
    const prescriptions = await PrescriptionService.searchPrescriptions(query);
    res.status(200).json({ success: true, data: prescriptions });
  });
}

module.exports = new PrescriptionController();