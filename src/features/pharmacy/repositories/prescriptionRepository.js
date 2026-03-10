// src/repositories/prescription/prescriptionRepository.js
const AppDataSource = require("../../../config/database");

class PrescriptionRepository {
  get repo() {
    return AppDataSource.getRepository("Prescription");
  }

  async create(data) {
    return this.repo.create(data);
  }

  async save(prescription) {
    return this.repo.save(prescription);
  }

  // Safe partial update — uses SQL UPDATE, never cascades to related entities
  async updateFields(id, fields) {
    return this.repo.update(id, { ...fields, updatedAt: new Date() });
  }

  async findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: ["doctor", "patient", "pharmacy", "assignedPharmacist"]
    });
  }

  async findByReference(reference) {
    return this.repo.findOne({
      where: { reference },
      relations: ["doctor", "patient", "pharmacy", "assignedPharmacist"]
    });
  }

  // Find prescriptions by doctor
  async findByDoctorId(doctorId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    const query = this.repo.createQueryBuilder("prescription")
      .leftJoinAndSelect("prescription.patient", "patient")
      .leftJoinAndSelect("prescription.pharmacy", "pharmacy")
      .leftJoinAndSelect("pharmacy.user", "pharmacyUser")
      .where("prescription.doctorId = :doctorId", { doctorId })
      .orderBy("prescription.createdAt", "DESC")
      .limit(limit)
      .offset(offset);

    if (status) {
      query.andWhere("prescription.status = :status", { status });
    }

    return query.getMany();
  }

  // Find prescriptions by patient
  async findByPatientId(patientId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    const query = this.repo.createQueryBuilder("prescription")
      .leftJoinAndSelect("prescription.doctor", "doctor")
      .leftJoinAndSelect("prescription.pharmacy", "pharmacy")
      .leftJoinAndSelect("pharmacy.user", "pharmacyUser")
      .where("prescription.patientId = :patientId", { patientId })
      .orderBy("prescription.createdAt", "DESC")
      .limit(limit)
      .offset(offset);

    if (status) {
      query.andWhere("prescription.status = :status", { status });
    }

    return query.getMany();
  }

  // Find prescriptions by pharmacy
  async findByPharmacyId(pharmacyId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    const query = this.repo.createQueryBuilder("prescription")
      .leftJoinAndSelect("prescription.doctor", "doctor")
      .leftJoinAndSelect("prescription.patient", "patient")
      .leftJoinAndSelect("prescription.assignedPharmacist", "assignedPharmacist")
      .where("prescription.pharmacyId = :pharmacyId", { pharmacyId })
      .orderBy("prescription.createdAt", "DESC")
      .limit(limit)
      .offset(offset);

    if (status) {
      query.andWhere("prescription.status = :status", { status });
    }

    return query.getMany();
  }

  // Update prescription status
  async updateStatus(id, status) {
    return this.repo.update(id, {
      status,
      updatedAt: new Date()
    });
  }

  // Assign pharmacy to prescription
  async assignPharmacy(id, pharmacyId) {
    return this.repo.update(id, {
      pharmacyId,
      status: "pharmacy_assigned",
      updatedAt: new Date()
    });
  }

  // Update payment information
  async updatePayment(id, paymentData) {
    const { invoiceItems, deliveryFee, totalDue, paymentMethod, paymentStatus } = paymentData;

    return this.repo.update(id, {
      invoiceItems,
      deliveryFee,
      totalDue,
      paymentMethod,
      paymentStatus,
      updatedAt: new Date()
    });
  }

  // Add chat message
  async addChatMessage(id, message) {
    const prescription = await this.findById(id);
    if (!prescription) {
      throw new Error("Prescription not found");
    }

    const chatMessages = prescription.chatMessages || [];
    chatMessages.push({
      ...message,
      timestamp: new Date().toISOString()
    });

    return this.repo.update(id, {
      chatMessages,
      updatedAt: new Date()
    });
  }

  // Add fulfillment history entry
  async addFulfillmentHistory(id, historyEntry) {
    const prescription = await this.findById(id);
    if (!prescription) {
      throw new Error("Prescription not found");
    }

    const fulfillmentHistory = prescription.fulfillmentHistory || [];
    fulfillmentHistory.push({
      ...historyEntry,
      timestamp: new Date().toISOString()
    });

    return this.repo.update(id, {
      fulfillmentHistory,
      updatedAt: new Date()
    });
  }

  // Generate unique reference number using timestamp + random component
  async generateReference() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    // Use base36-encoded timestamp (last 6 chars) + 2 random chars for uniqueness
    const tsPart = Date.now().toString(36).toUpperCase().slice(-6);
    const randPart = Math.random().toString(36).substring(2, 4).toUpperCase();
    return `RX-${dateStr}-${tsPart}${randPart}`;
  }

  // Get unique patients and doctors associated with a pharmacy
  async findContactsByPharmacyId(pharmacyId) {
    const prescriptions = await this.repo.createQueryBuilder("prescription")
      .leftJoinAndSelect("prescription.patient", "patient")
      .leftJoinAndSelect("prescription.doctor", "doctor")
      .where("prescription.pharmacyId = :pharmacyId", { pharmacyId })
      .getMany();

    const patientsMap = new Map();
    const doctorsMap = new Map();
    for (const p of prescriptions) {
      if (p.patient) patientsMap.set(p.patient.id, p.patient);
      if (p.doctor) doctorsMap.set(p.doctor.id, p.doctor);
    }
    return {
      patients: Array.from(patientsMap.values()),
      doctors: Array.from(doctorsMap.values()),
    };
  }

  // Active orders for a pharmacy (processing / ready stages)
  async findActiveOrdersByPharmacyId(pharmacyId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    const activeStatuses = ["pharmacy_processing", "ready_for_delivery", "ready_for_pickup"];
    return this.repo.createQueryBuilder("prescription")
      .leftJoinAndSelect("prescription.patient", "patient")
      .leftJoinAndSelect("prescription.doctor", "doctor")
      .leftJoinAndSelect("prescription.assignedPharmacist", "assignedPharmacist")
      .where("prescription.pharmacyId = :pharmacyId", { pharmacyId })
      .andWhere("prescription.status IN (:...activeStatuses)", { activeStatuses })
      .orderBy("prescription.updatedAt", "DESC")
      .limit(limit)
      .offset(offset)
      .getMany();
  }

  // Prescriptions with invoice data for a patient
  async findInvoicesByPatientId(patientId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    return this.repo.createQueryBuilder("prescription")
      .leftJoinAndSelect("prescription.doctor", "doctor")
      .leftJoinAndSelect("prescription.pharmacy", "pharmacy")
      .where("prescription.patientId = :patientId", { patientId })
      .andWhere("prescription.totalDue IS NOT NULL")
      .orderBy("prescription.updatedAt", "DESC")
      .limit(limit)
      .offset(offset)
      .getMany();
  }

  // Search prescriptions
  async searchPrescriptions(query, options = {}) {
    const { limit = 50, offset = 0 } = options;

    return this.repo.createQueryBuilder("prescription")
      .leftJoinAndSelect("prescription.doctor", "doctor")
      .leftJoinAndSelect("prescription.patient", "patient")
      .leftJoinAndSelect("prescription.pharmacy", "pharmacy")
      .where("prescription.reference ILIKE :query", { query: `%${query}%` })
      .orWhere("doctor.fullName ILIKE :query", { query: `%${query}%` })
      .orWhere("patient.fullName ILIKE :query", { query: `%${query}%` })
      .orderBy("prescription.createdAt", "DESC")
      .limit(limit)
      .offset(offset)
      .getMany();
  }
}

module.exports = new PrescriptionRepository();