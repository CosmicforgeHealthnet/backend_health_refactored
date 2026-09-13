// GET /api/patient/activity/ — a unified recent-activity timeline built by
// merging events already produced by the appointments, prescriptions, lab
// and documents domains. No new activity-tracking table: each domain stays
// the source of truth for its own records, this just interleaves them by
// recency.
const AppointmentRepository = require("../../appointments/repositories/appointmentRepository");
const prescriptionService = require("../../pharmacy/services/prescriptionService");
const labOrderService = require("../../LAB/services/lab_order");
const DocumentFileService = require("../../documents/services/documentFileService");

const appointmentRepository = new AppointmentRepository();

// The LAB feature is a flag-gated "legacy" module (ENABLE_LEGACY_LAB_ROUTES)
// whose entities aren't registered in every environment's TypeORM
// DataSource — calling it can throw EntityMetadataNotFoundError there.
// Lab activity is one optional slice of the timeline, so a lookup failure
// should degrade to "no lab events" rather than take the whole feed down.
async function getPatientLabOrdersSafe(patientId, limit, offset) {
  try {
    return await labOrderService.getPatientOrders(patientId, limit, offset);
  } catch (error) {
    console.error("lab order lookup failed, treating as no results:", error.message);
    return [];
  }
}

class PatientActivityService {
  async getRecentActivity(patientId, limit = 5) {
    const [appointments, prescriptions, labOrders, documents] = await Promise.all([
      appointmentRepository.findByPatientId(patientId),
      prescriptionService.getPatientPrescriptions(patientId, { limit: 20 }),
      getPatientLabOrdersSafe(patientId, 20, 0),
      DocumentFileService.getRecentFiles(patientId, 20).catch(() => ({ files: [] })),
    ]);

    const activities = [
      ...appointments.map((a) => ({
        id: `appointment_${a.id}`,
        type: "appointment",
        title: `Appointment with Dr. ${a.doctor?.fullName || "Doctor"}`,
        description: a.reason || a.type,
        status: a.status,
        resource_id: a.id,
        created_at: a.updatedAt || a.createdAt,
      })),
      ...prescriptions.map((p) => ({
        id: `prescription_${p.id}`,
        type: "prescription",
        title: "Prescription",
        description: (p.medications || []).map((m) => m.name).join(", ") || null,
        status: p.status,
        resource_id: p.id,
        created_at: p.updatedAt || p.createdAt,
      })),
      ...labOrders.map((o) => ({
        id: `lab_result_${o.id}`,
        type: "lab_result",
        title: Array.isArray(o.testNames) ? o.testNames.join(", ") : "Lab Order",
        description: null,
        status: o.status,
        resource_id: o.id,
        created_at: o.resultsDeliveredAt || o.updatedAt || o.createdAt,
      })),
      ...(documents.files || []).map((f) => ({
        id: `medical_record_${f.id}`,
        type: "medical_record",
        title: f.originalFileName,
        description: f.documentType,
        status: "completed",
        resource_id: f.id,
        created_at: f.createdAt,
      })),
    ];

    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { activities: activities.slice(0, limit) };
  }
}

module.exports = new PatientActivityService();
