// src/services/prescription/prescriptionService.js
const prescriptionRepo = require("../repositories/prescriptionRepository");
const userRepo = require("../../auth/repositories/userRepository");
const pharmacyProfileRepo = require("../repositories/pharmacyProfileRepository");
const { PrescriptionStatus, PaymentStatus } = require("../entities/Prescription");

class PrescriptionService {

  /**
   * Doctor creates a new prescription during consultation
   * @param {Object} prescriptionData - Prescription details
   * @param {string} doctorId - Authenticated doctor's ID
   */
  async createPrescription(prescriptionData, doctorId) {
    const { patientId, medications, consultationId, doctorNotes } = prescriptionData;

    // Validation
    if (!patientId || !medications || !Array.isArray(medications) || medications.length === 0) {
      throw new Error("Patient ID and medications are required");
    }

    // Verify doctor exists and has proper role
    const doctor = await userRepo.findById(doctorId);
    if (!doctor || doctor.role !== "doctor") {
      throw new Error("Invalid doctor");
    }

    // Verify patient exists
    const patient = await userRepo.findById(patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    // Validate medications structure
    for (const med of medications) {
      if (!med.name || !med.dosage || !med.frequency || !med.duration || !med.quantity) {
        throw new Error("Each medication must have name, dosage, frequency, duration, and quantity");
      }
    }

    // Generate unique reference
    const reference = await prescriptionRepo.generateReference();

    // Create prescription object
    const newPrescription = {
      reference,
      doctorId,
      patientId,
      consultationId,
      medications,
      doctorNotes,
      status: PrescriptionStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
      fulfillmentHistory: [{
        status: PrescriptionStatus.PENDING,
        timestamp: new Date().toISOString(),
        note: "Prescription created by doctor"
      }]
    };

    const savedPrescription = await prescriptionRepo.save(newPrescription);

    // Return prescription with populated relations
    return this.getPrescriptionById(savedPrescription.id);
  }

  /**
   * Patient uploads prescription to platform (if not created during consultation)
   * @param {string} prescriptionId - Prescription ID
   * @param {string} patientId - Patient ID for verification
   */
  async uploadPrescription(prescriptionId, patientId) {
    const prescription = await prescriptionRepo.findById(prescriptionId);
    if (!prescription) {
      throw new Error("Prescription not found");
    }

    if (prescription.patientId !== patientId) {
      throw new Error("Unauthorized: Not your prescription");
    }

    if (prescription.status !== PrescriptionStatus.PENDING) {
      throw new Error("Prescription has already been uploaded");
    }

    // Update status
    await prescriptionRepo.updateStatus(prescriptionId, PrescriptionStatus.PATIENT_UPLOADED);

    // Add to fulfillment history
    await prescriptionRepo.addFulfillmentHistory(prescriptionId, {
      status: PrescriptionStatus.PATIENT_UPLOADED,
      note: "Prescription uploaded by patient"
    });

    return this.getPrescriptionById(prescriptionId);
  }

  /**
   * Patient selects pharmacy to fulfill prescription
   * @param {string} prescriptionId - Prescription ID
   * @param {string} pharmacyId - Selected pharmacy ID
   * @param {string} patientId - Patient ID for verification
   * @param {Object} deliveryDetails - Delivery preferences
   */
  async assignPharmacy(prescriptionId, pharmacyId, patientId, deliveryDetails = {}) {
    const prescription = await prescriptionRepo.findById(prescriptionId);
    if (!prescription) {
      throw new Error("Prescription not found");
    }

    if (prescription.patientId !== patientId) {
      throw new Error("Unauthorized: Not your prescription");
    }

    // Verify pharmacy exists and is active
    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);
    if (!pharmacy || !pharmacy.isActive) {
      throw new Error("Pharmacy not available");
    }

    // Check if prescription can be assigned
    const validStatuses = [PrescriptionStatus.PENDING, PrescriptionStatus.PATIENT_UPLOADED];
    if (!validStatuses.includes(prescription.status)) {
      throw new Error("Prescription cannot be reassigned at this stage");
    }

    // Update prescription with pharmacy and delivery details
    const updateData = {
      pharmacyId,
      status: PrescriptionStatus.PHARMACY_ASSIGNED,
      deliveryAddress: deliveryDetails.address,
      deliveryInstructions: deliveryDetails.instructions,
      updatedAt: new Date()
    };

    await prescriptionRepo.save({ ...prescription, ...updateData });

    // Add to fulfillment history
    await prescriptionRepo.addFulfillmentHistory(prescriptionId, {
      status: PrescriptionStatus.PHARMACY_ASSIGNED,
      note: `Prescription assigned to ${pharmacy.pharmacyName}`
    });

    return this.getPrescriptionById(prescriptionId);
  }

  /**
   * Pharmacy starts processing prescription
   * @param {string} prescriptionId - Prescription ID
   * @param {string} pharmacyId - Pharmacy ID for verification
   * @param {string} pharmacistId - Assigned pharmacist ID
   */
  async startProcessing(prescriptionId, pharmacyId, pharmacistId) {
    const prescription = await prescriptionRepo.findById(prescriptionId);
    if (!prescription) {
      throw new Error("Prescription not found");
    }

    if (prescription.pharmacyId !== pharmacyId) {
      throw new Error("Unauthorized: Not assigned to your pharmacy");
    }

    if (prescription.status !== PrescriptionStatus.PHARMACY_ASSIGNED) {
      throw new Error("Prescription is not ready for processing");
    }

    // Verify pharmacist exists
    const pharmacist = await userRepo.findById(pharmacistId);
    if (!pharmacist) {
      throw new Error("Pharmacist not found");
    }

    // Update status and assign pharmacist
    await prescriptionRepo.save({
      ...prescription,
      status: PrescriptionStatus.PHARMACY_PROCESSING,
      assignedPharmacistId: pharmacistId,
      updatedAt: new Date()
    });

    // Add to fulfillment history
    await prescriptionRepo.addFulfillmentHistory(prescriptionId, {
      status: PrescriptionStatus.PHARMACY_PROCESSING,
      note: `Processing started by ${pharmacist.fullName}`
    });

    return this.getPrescriptionById(prescriptionId);
  }

  /**
   * Pharmacy provides medication costs and invoice
   * @param {string} prescriptionId - Prescription ID
   * @param {string} pharmacyId - Pharmacy ID for verification
   * @param {Object} invoiceData - Invoice details
   */
  async provideCosts(prescriptionId, pharmacyId, invoiceData) {
    const { items, deliveryFee = 0, paymentMethod } = invoiceData;

    const prescription = await prescriptionRepo.findById(prescriptionId);
    if (!prescription) {
      throw new Error("Prescription not found");
    }

    if (prescription.pharmacyId !== pharmacyId) {
      throw new Error("Unauthorized: Not assigned to your pharmacy");
    }

    // Calculate total
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalDue = subtotal + deliveryFee;

    // Update payment information
    await prescriptionRepo.updatePayment(prescriptionId, {
      invoiceItems: items,
      deliveryFee,
      totalDue,
      paymentMethod,
      paymentStatus: PaymentStatus.UNPAID
    });

    return this.getPrescriptionById(prescriptionId);
  }

  /**
   * Add chat message between patient and pharmacy
   * @param {string} prescriptionId - Prescription ID
   * @param {Object} messageData - Message details
   * @param {string} senderId - Sender's user ID
   */
  async addChatMessage(prescriptionId, messageData, senderId) {
    const { message, senderType } = messageData; // senderType: 'patient' or 'pharmacy'

    const prescription = await prescriptionRepo.findById(prescriptionId);
    if (!prescription) {
      throw new Error("Prescription not found");
    }

    // Verify sender has access to this prescription
    if (senderType === 'patient' && prescription.patientId !== senderId) {
      throw new Error("Unauthorized: Not your prescription");
    }
    if (senderType === 'pharmacy' && prescription.pharmacyId !== senderId) {
      throw new Error("Unauthorized: Not assigned to your pharmacy");
    }

    const chatMessage = {
      senderId,
      senderType,
      message,
      timestamp: new Date().toISOString()
    };

    await prescriptionRepo.addChatMessage(prescriptionId, chatMessage);
    return this.getPrescriptionById(prescriptionId);
  }

  /**
   * Mark prescription as ready for delivery/pickup
   * @param {string} prescriptionId - Prescription ID
   * @param {string} pharmacyId - Pharmacy ID for verification
   * @param {string} readyType - 'delivery' or 'pickup'
   */
  async markReady(prescriptionId, pharmacyId, readyType, expectedDate = null) {
    const prescription = await prescriptionRepo.findById(prescriptionId);
    if (!prescription) {
      throw new Error("Prescription not found");
    }

    if (prescription.pharmacyId !== pharmacyId) {
      throw new Error("Unauthorized: Not assigned to your pharmacy");
    }

    if (prescription.status !== PrescriptionStatus.PHARMACY_PROCESSING) {
      throw new Error("Prescription is not being processed");
    }

    const newStatus = readyType === 'delivery'
      ? PrescriptionStatus.READY_FOR_DELIVERY
      : PrescriptionStatus.READY_FOR_PICKUP;

    // Update status
    const updateData = {
      status: newStatus,
      updatedAt: new Date()
    };

    if (expectedDate) {
      updateData.expectedDeliveryDate = expectedDate;
    }

    await prescriptionRepo.save({ ...prescription, ...updateData });

    // Add to fulfillment history
    await prescriptionRepo.addFulfillmentHistory(prescriptionId, {
      status: newStatus,
      note: `Prescription ready for ${readyType}`
    });

    return this.getPrescriptionById(prescriptionId);
  }

  /**
   * Complete prescription fulfillment
   * @param {string} prescriptionId - Prescription ID
   * @param {string} pharmacyId - Pharmacy ID for verification
   */
  async completePrescription(prescriptionId, pharmacyId) {
    const prescription = await prescriptionRepo.findById(prescriptionId);
    if (!prescription) {
      throw new Error("Prescription not found");
    }

    if (prescription.pharmacyId !== pharmacyId) {
      throw new Error("Unauthorized: Not assigned to your pharmacy");
    }

    const validStatuses = [PrescriptionStatus.READY_FOR_DELIVERY, PrescriptionStatus.READY_FOR_PICKUP];
    if (!validStatuses.includes(prescription.status)) {
      throw new Error("Prescription is not ready for completion");
    }

    // Update status and completion date
    await prescriptionRepo.save({
      ...prescription,
      status: PrescriptionStatus.COMPLETED,
      actualDeliveryDate: new Date(),
      paymentStatus: PaymentStatus.PAID,
      updatedAt: new Date()
    });

    // Add to fulfillment history
    await prescriptionRepo.addFulfillmentHistory(prescriptionId, {
      status: PrescriptionStatus.COMPLETED,
      note: "Prescription fulfilled successfully"
    });

    return this.getPrescriptionById(prescriptionId);
  }

  /**
   * Cancel prescription
   * @param {string} prescriptionId - Prescription ID
   * @param {string} userId - User ID (patient, doctor, or pharmacy)
   * @param {string} reason - Cancellation reason
   */
  async cancelPrescription(prescriptionId, userId, reason) {
    const prescription = await prescriptionRepo.findById(prescriptionId);
    if (!prescription) {
      throw new Error("Prescription not found");
    }

    // Verify user has permission to cancel
    const canCancel = prescription.patientId === userId ||
      prescription.doctorId === userId ||
      prescription.pharmacyId === userId;

    if (!canCancel) {
      throw new Error("Unauthorized: Cannot cancel this prescription");
    }

    // Don't allow cancellation if already completed
    if (prescription.status === PrescriptionStatus.COMPLETED) {
      throw new Error("Cannot cancel completed prescription");
    }

    // Update status
    await prescriptionRepo.save({
      ...prescription,
      status: PrescriptionStatus.CANCELLED,
      paymentStatus: PaymentStatus.CANCELLED,
      updatedAt: new Date()
    });

    // Add to fulfillment history
    await prescriptionRepo.addFulfillmentHistory(prescriptionId, {
      status: PrescriptionStatus.CANCELLED,
      note: `Cancelled: ${reason}`
    });

    return this.getPrescriptionById(prescriptionId);
  }

  /**
   * Get prescription by ID with all relations
   */
  async getPrescriptionById(id) {
    return prescriptionRepo.findById(id);
  }

  /**
   * Get prescriptions for doctor
   */
  async getDoctorPrescriptions(doctorId, options = {}) {
    return prescriptionRepo.findByDoctorId(doctorId, options);
  }

  /**
   * Get prescriptions for patient
   */
  async getPatientPrescriptions(patientId, options = {}) {
    return prescriptionRepo.findByPatientId(patientId, options);
  }

  /**
   * Get prescriptions for pharmacy
   */
  async getPharmacyPrescriptions(pharmacyId, options = {}) {
    return prescriptionRepo.findByPharmacyId(pharmacyId, options);
  }

  /**
   * Search prescriptions
   */
  async searchPrescriptions(query, options = {}) {
    return prescriptionRepo.searchPrescriptions(query, options);
  }
}

module.exports = new PrescriptionService();