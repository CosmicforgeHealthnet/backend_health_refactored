// src/services/prescription/prescriptionService.js !!!!
const prescriptionRepo = require("../repositories/prescriptionRepository");
const userRepo = require("../../auth/repositories/userRepository");
const pharmacyProfileRepo = require("../repositories/pharmacyProfileRepository");
const AppointmentRepository = require("../../appointments/repositories/appointmentRepository");
const labOrderRepo = require("../../LAB/repositories/lab_order");
const { PrescriptionStatus, PaymentStatus } = require("../entities/Prescription");

const NotificationService = require("../../notifications/services/notificationService");
const pharmacyEmailHelper = require("../../../shared/services/email/helper/pharmacy");

const appointmentRepo = new AppointmentRepository();
const notificationService = new NotificationService();

// Helper: fire-and-forget email (never throw)
function sendEmail(fn, ...args) {
  fn(...args).catch(err => console.error("Email send failed:", err.message));
}

class PrescriptionService {

  /**
   * Doctor creates a new prescription during consultation
   * @param {Object} prescriptionData - Prescription details
   * @param {string} doctorId - Authenticated doctor's ID
   */
  async createPrescription(prescriptionData, doctorId) {
    const { patientId, medications, consultationId, doctorNotes, diagnosis, doctorSignature } = prescriptionData;

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
      if (!med.name || !med.dosage || !med.frequency || !med.duration || !med.quantity || !med.route) {
        throw new Error("Each medication must have name, dosage, frequency, duration, route, and quantity");
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
      diagnosis,
      doctorSignature,
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

    // Notify patient via WebSocket
    notificationService.createNotification(
      patientId,
      "notification",
      `Dr. ${doctor.fullName} has created a prescription for you (Ref: ${reference}).`,
      { prescriptionId: savedPrescription.id, reference, type: "prescription_created" }
    ).catch(err => console.error("Notification failed:", err.message));

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

    // Verify pharmacy exists and is approved (isActive is set by approval flow going forward)
    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);
    if (!pharmacy || pharmacy.verificationStatus !== 'approved') {
      const err = new Error("Pharmacy not found or not yet approved");
      err.status = 400;
      throw err;
    }

    // Check if prescription can be assigned
    const validStatuses = [PrescriptionStatus.PENDING, PrescriptionStatus.PATIENT_UPLOADED];
    if (!validStatuses.includes(prescription.status)) {
      throw new Error("Prescription cannot be reassigned at this stage");
    }

    // Get patient info for notification
    const patient = await userRepo.findById(patientId);

    // Update prescription with pharmacy and delivery details
    await prescriptionRepo.updateFields(prescriptionId, {
      pharmacyId,
      status: PrescriptionStatus.PHARMACY_ASSIGNED,
      deliveryAddress: deliveryDetails.address,
      deliveryInstructions: deliveryDetails.instructions,
    });

    // Add to fulfillment history
    await prescriptionRepo.addFulfillmentHistory(prescriptionId, {
      status: PrescriptionStatus.PHARMACY_ASSIGNED,
      note: `Prescription assigned to ${pharmacy.pharmacyName}`
    });

    // Notify pharmacy via WebSocket + email
    if (pharmacy.userId) {
      notificationService.createNotification(
        pharmacy.userId,
        "notification",
        `New prescription request from ${patient?.fullName || "a patient"} (Ref: ${prescription.reference}).`,
        { prescriptionId, reference: prescription.reference, type: "prescription_assigned" }
      ).catch(err => console.error("Notification failed:", err.message));
    }

    if (pharmacy.email) {
      sendEmail(pharmacyEmailHelper.sendPrescriptionAssignedToPharmacyEmail, {
        to: pharmacy.email,
        pharmacyName: pharmacy.pharmacyName,
        patientName: patient?.fullName || "Patient",
        reference: prescription.reference,
        prescriptionId
      });
    }

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

    // Get pharmacy info for notification message
    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);

    // Update status and assign pharmacist
    await prescriptionRepo.updateFields(prescriptionId, {
      status: PrescriptionStatus.PHARMACY_PROCESSING,
      assignedPharmacistId: pharmacistId,
    });

    // Add to fulfillment history
    await prescriptionRepo.addFulfillmentHistory(prescriptionId, {
      status: PrescriptionStatus.PHARMACY_PROCESSING,
      note: `Processing started by ${pharmacist.fullName}`
    });

    // Notify patient via WebSocket
    notificationService.createNotification(
      prescription.patientId,
      "notification",
      `${pharmacy?.pharmacyName || "Your pharmacy"} has started processing your prescription (Ref: ${prescription.reference}).`,
      { prescriptionId, reference: prescription.reference, type: "prescription_processing" }
    ).catch(err => console.error("Notification failed:", err.message));

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

    // Get patient and pharmacy info for notifications
    const patient = await userRepo.findById(prescription.patientId);
    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);

    // Notify patient via WebSocket
    notificationService.createNotification(
      prescription.patientId,
      "notification",
      `Invoice ready for your prescription (Ref: ${prescription.reference}). Total: ₦${totalDue.toLocaleString()}.`,
      { prescriptionId, reference: prescription.reference, totalDue, type: "invoice_ready" }
    ).catch(err => console.error("Notification failed:", err.message));

    // Send email to patient
    if (patient?.email) {
      sendEmail(pharmacyEmailHelper.sendInvoiceReadyEmail, {
        to: patient.email,
        patientName: patient.fullName,
        pharmacyName: pharmacy?.pharmacyName || "Your pharmacy",
        reference: prescription.reference,
        prescriptionId,
        totalDue,
        deliveryFee,
        items
      });
    }

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

    // Notify the other party via WebSocket
    if (senderType === 'patient' && prescription.pharmacy?.userId) {
      notificationService.createNotification(
        prescription.pharmacy.userId,
        "notification",
        `New message from patient on prescription ${prescription.reference}.`,
        { prescriptionId, reference: prescription.reference, type: "new_chat_message" }
      ).catch(err => console.error("Notification failed:", err.message));
    } else if (senderType === 'pharmacy') {
      notificationService.createNotification(
        prescription.patientId,
        "notification",
        `New message from pharmacy on prescription ${prescription.reference}.`,
        { prescriptionId, reference: prescription.reference, type: "new_chat_message" }
      ).catch(err => console.error("Notification failed:", err.message));
    }

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

    await prescriptionRepo.updateFields(prescriptionId, updateData);

    // Add to fulfillment history
    await prescriptionRepo.addFulfillmentHistory(prescriptionId, {
      status: newStatus,
      note: `Prescription ready for ${readyType}`
    });

    // Get patient and pharmacy info
    const patient = await userRepo.findById(prescription.patientId);
    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);

    const readyMsg = readyType === 'delivery'
      ? `Your prescription (Ref: ${prescription.reference}) is out for delivery!`
      : `Your prescription (Ref: ${prescription.reference}) is ready for pickup at ${pharmacy?.pharmacyName || "the pharmacy"}.`;

    // Notify patient via WebSocket
    notificationService.createNotification(
      prescription.patientId,
      "notification",
      readyMsg,
      { prescriptionId, reference: prescription.reference, readyType, type: "prescription_ready" }
    ).catch(err => console.error("Notification failed:", err.message));

    // Send email to patient
    if (patient?.email) {
      sendEmail(pharmacyEmailHelper.sendPrescriptionReadyEmail, {
        to: patient.email,
        patientName: patient.fullName,
        pharmacyName: pharmacy?.pharmacyName || "Your pharmacy",
        reference: prescription.reference,
        prescriptionId,
        readyType,
        expectedDate
      });
    }

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
    await prescriptionRepo.updateFields(prescriptionId, {
      status: PrescriptionStatus.COMPLETED,
      actualDeliveryDate: new Date(),
      paymentStatus: PaymentStatus.PAID,
    });

    // Add to fulfillment history
    await prescriptionRepo.addFulfillmentHistory(prescriptionId, {
      status: PrescriptionStatus.COMPLETED,
      note: "Prescription fulfilled successfully"
    });

    // Get patient and pharmacy info
    const patient = await userRepo.findById(prescription.patientId);
    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);

    // Notify patient via WebSocket
    notificationService.createNotification(
      prescription.patientId,
      "notification",
      `Your prescription (Ref: ${prescription.reference}) has been fulfilled successfully. Feel better soon!`,
      { prescriptionId, reference: prescription.reference, type: "prescription_completed" }
    ).catch(err => console.error("Notification failed:", err.message));

    // Send email to patient
    if (patient?.email) {
      sendEmail(pharmacyEmailHelper.sendPrescriptionCompletedEmail, {
        to: patient.email,
        patientName: patient.fullName,
        pharmacyName: pharmacy?.pharmacyName || "Your pharmacy",
        reference: prescription.reference,
        prescriptionId
      });
    }

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

    // Don't allow cancellation if already completed or cancelled
    if (prescription.status === PrescriptionStatus.COMPLETED) {
      throw new Error("Cannot cancel completed prescription");
    }
    if (prescription.status === PrescriptionStatus.CANCELLED) {
      throw new Error("Prescription is already cancelled");
    }

    // Determine who is cancelling
    let cancelledBy = "patient";
    if (prescription.doctorId === userId) cancelledBy = "doctor";
    else if (prescription.pharmacyId === userId) cancelledBy = "pharmacy";

    // Update status
    await prescriptionRepo.updateFields(prescriptionId, {
      status: PrescriptionStatus.CANCELLED,
      paymentStatus: PaymentStatus.CANCELLED,
    });

    // Add to fulfillment history
    await prescriptionRepo.addFulfillmentHistory(prescriptionId, {
      status: PrescriptionStatus.CANCELLED,
      note: `Cancelled by ${cancelledBy}: ${reason}`
    });

    const cancellationMsg = `Prescription ${prescription.reference} has been cancelled by the ${cancelledBy}. Reason: ${reason || "Not specified"}.`;

    // Notify patient (if not the one cancelling)
    if (prescription.patientId !== userId) {
      notificationService.createNotification(
        prescription.patientId,
        "alert",
        cancellationMsg,
        { prescriptionId, reference: prescription.reference, cancelledBy, type: "prescription_cancelled" }
      ).catch(err => console.error("Notification failed:", err.message));

      const patient = await userRepo.findById(prescription.patientId);
      if (patient?.email) {
        sendEmail(pharmacyEmailHelper.sendPrescriptionCancelledEmail, {
          to: patient.email,
          recipientName: patient.fullName,
          reference: prescription.reference,
          prescriptionId,
          cancelledBy,
          reason
        });
      }
    }

    // Notify doctor (if not the one cancelling)
    if (prescription.doctorId && prescription.doctorId !== userId) {
      notificationService.createNotification(
        prescription.doctorId,
        "alert",
        cancellationMsg,
        { prescriptionId, reference: prescription.reference, cancelledBy, type: "prescription_cancelled" }
      ).catch(err => console.error("Notification failed:", err.message));
    }

    // Notify pharmacy (if assigned and not the one cancelling)
    if (prescription.pharmacyId && prescription.pharmacyId !== userId) {
      const pharmacy = await pharmacyProfileRepo.findById(prescription.pharmacyId);
      if (pharmacy?.userId) {
        notificationService.createNotification(
          pharmacy.userId,
          "alert",
          cancellationMsg,
          { prescriptionId, reference: prescription.reference, cancelledBy, type: "prescription_cancelled" }
        ).catch(err => console.error("Notification failed:", err.message));
      }
    }

    return this.getPrescriptionById(prescriptionId);
  }

  /**
   * Get prescription by ID with all relations
   */
  async getPrescriptionById(id, userId = null, role = null) {
    const prescription = await prescriptionRepo.findById(id);
    if (!prescription) return null;

    // Role-based access control (skipped when called internally without a user context)
    if (userId && role) {
      let hasAccess = false;
      if (role === 'doctor') {
        hasAccess = prescription.doctorId === userId;
      } else if (role === 'patient') {
        hasAccess = prescription.patientId === userId;
      } else if (role === 'pharmacy') {
        const profile = await pharmacyProfileRepo.findByUserId(userId);
        hasAccess = profile != null && prescription.pharmacyId === profile.id;
      }
      if (!hasAccess) {
        const err = new Error('Forbidden: You do not have access to this prescription');
        err.status = 403;
        throw err;
      }
    }

    // Enrich with appointment data (Patient Complaint)
    if (prescription.consultationId) {
      try {
        const appointment = await appointmentRepo.findById(prescription.consultationId);
        if (appointment) {
          prescription.patientComplaint = appointment.reason || appointment.notes;
          prescription.appointmentRef = appointment.id.slice(0, 8).toUpperCase();
          prescription.appointmentDate = appointment.appointmentDate;
        }
      } catch (err) {
        console.error("Failed to fetch appointment data for prescription:", err);
      }
    }

    // Enrich with lab orders (Ordered Tests) — silently skip if lab module not yet set up
    try {
      const labOrders = await labOrderRepo.findByPatientId(prescription.patientId, 5);
      prescription.orderedTests = labOrders
        .filter(order => Math.abs(new Date(order.createdAt) - new Date(prescription.createdAt)) < 24 * 60 * 60 * 1000)
        .flatMap(order => order.testNames || []);
    } catch (err) {
      // Lab module may not be available yet — skip enrichment silently
      prescription.orderedTests = [];
    }

    return prescription;
  }

  /**
   * Get dashboard statistics for a pharmacy
   */
  async getDashboardStats(pharmacyId) {
    const prescriptions = await prescriptionRepo.findByPharmacyId(pharmacyId);

    return {
      pendingRequests: prescriptions.filter(p => p.status === PrescriptionStatus.PHARMACY_ASSIGNED).length,
      activeOrders: prescriptions.filter(p => [
        PrescriptionStatus.PHARMACY_PROCESSING,
        PrescriptionStatus.READY_FOR_PICKUP,
        PrescriptionStatus.READY_FOR_DELIVERY
      ].includes(p.status)).length,
      completedToday: prescriptions.filter(p =>
        p.status === PrescriptionStatus.COMPLETED &&
        new Date(p.updatedAt).toDateString() === new Date().toDateString()
      ).length
    };
  }

  /**
   * Get recent activity feed for a pharmacy
   */
  async getActivityFeed(pharmacyId, limit = 10) {
    const prescriptions = await prescriptionRepo.findByPharmacyId(pharmacyId, { limit });

    // Flatten fulfillment history into a feed
    const feed = prescriptions.flatMap(p =>
      (p.fulfillmentHistory || []).map(h => ({
        id: p.id,
        reference: p.reference,
        patientName: p.patient?.fullName,
        action: h.note,
        status: h.status,
        timestamp: h.timestamp
      }))
    );

    return feed
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Pharmacy confirms availability of medications
   */
  async confirmAvailability(prescriptionId, pharmacyId) {
    const prescription = await prescriptionRepo.findById(prescriptionId);
    if (!prescription || prescription.pharmacyId !== pharmacyId) {
      throw new Error("Prescription not found or unauthorized");
    }

    await prescriptionRepo.updateFields(prescriptionId, {
      availabilityStatus: "confirmed",
    });

    await prescriptionRepo.addFulfillmentHistory(prescriptionId, {
      status: prescription.status,
      note: "Medication availability confirmed"
    });

    // Get patient and pharmacy info
    const patient = await userRepo.findById(prescription.patientId);
    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);

    // Notify patient via WebSocket
    notificationService.createNotification(
      prescription.patientId,
      "notification",
      `${pharmacy?.pharmacyName || "Your pharmacy"} has confirmed your medications are available (Ref: ${prescription.reference}). An invoice will be sent shortly.`,
      { prescriptionId, reference: prescription.reference, type: "availability_confirmed" }
    ).catch(err => console.error("Notification failed:", err.message));

    // Send email to patient
    if (patient?.email) {
      sendEmail(pharmacyEmailHelper.sendAvailabilityConfirmedEmail, {
        to: patient.email,
        patientName: patient.fullName,
        pharmacyName: pharmacy?.pharmacyName || "Your pharmacy",
        reference: prescription.reference,
        prescriptionId
      });
    }

    return this.getPrescriptionById(prescriptionId);
  }

  /**
   * Pharmacy proposes alternative medications
   * @param {string} prescriptionId
   * @param {string} pharmacyId
   * @param {Array}  alternatives - [{name, dosage, reason}]
   * @param {string} [pharmacistId]
   */
  async proposeAlternative(prescriptionId, pharmacyId, alternatives, pharmacistId = null) {
    const prescription = await prescriptionRepo.findById(prescriptionId);
    if (!prescription || prescription.pharmacyId !== pharmacyId) {
      throw new Error("Prescription not found or unauthorized");
    }

    if (!Array.isArray(alternatives) || alternatives.length === 0) {
      throw new Error("At least one alternative medication must be provided");
    }

    // Store alternatives in internalNotes with a special type marker
    const internalNotes = prescription.internalNotes || [];
    internalNotes.push({
      type: "alternative_proposal",
      alternatives,
      pharmacistId,
      timestamp: new Date().toISOString()
    });

    // Use updateFields (SQL UPDATE) to avoid TypeORM cascade issues with loaded relations
    await prescriptionRepo.updateFields(prescriptionId, {
      availabilityStatus: "alternatives_proposed",
      internalNotes
    });

    await prescriptionRepo.addFulfillmentHistory(prescriptionId, {
      status: prescription.status,
      note: `Alternative medications proposed (${alternatives.length} alternative${alternatives.length > 1 ? "s" : ""})`
    });

    // Get patient and pharmacy info
    const patient = await userRepo.findById(prescription.patientId);
    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);

    // Notify patient via WebSocket
    notificationService.createNotification(
      prescription.patientId,
      "notification",
      `${pharmacy?.pharmacyName || "Your pharmacy"} has suggested alternative medications for prescription ${prescription.reference}. Please review.`,
      { prescriptionId, reference: prescription.reference, alternatives, type: "alternatives_proposed" }
    ).catch(err => console.error("Notification failed:", err.message));

    // Send email to patient
    if (patient?.email) {
      sendEmail(pharmacyEmailHelper.sendAlternativeSuggestedEmail, {
        to: patient.email,
        patientName: patient.fullName,
        pharmacyName: pharmacy?.pharmacyName || "Your pharmacy",
        reference: prescription.reference,
        prescriptionId,
        alternatives
      });
    }

    return this.getPrescriptionById(prescriptionId);
  }

  /**
   * Pharmacy adds an internal note
   */
  async addInternalNote(prescriptionId, pharmacyId, noteData) {
    const { note, pharmacistId } = noteData;
    const prescription = await prescriptionRepo.findById(prescriptionId);

    if (!prescription || prescription.pharmacyId !== pharmacyId) {
      throw new Error("Prescription not found or unauthorized");
    }

    const internalNotes = prescription.internalNotes || [];
    internalNotes.push({
      note,
      pharmacistId,
      timestamp: new Date().toISOString()
    });

    await prescriptionRepo.updateFields(prescriptionId, { internalNotes });

    return this.getPrescriptionById(prescriptionId);
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
