// Read/aggregation layer for the patient dashboard. This deliberately does
// NOT duplicate domain logic — it calls into the existing appointments,
// prescriptions, lab, documents and wallet services/repositories and
// reshapes their output into the lightweight views the dashboard needs.
const AppointmentRepository = require("../../appointments/repositories/appointmentRepository");
const prescriptionService = require("../../pharmacy/services/prescriptionService");
const { PrescriptionStatus } = require("../../pharmacy/entities/Prescription");
const labOrderService = require("../../LAB/services/lab_order");
const { ORDER_STATUS } = require("../../LAB/utils/constants");
const DocumentFileService = require("../../documents/services/documentFileService");
const patientWalletService = require("../../pharmacy/services/patientWalletService");

const appointmentRepository = new AppointmentRepository();

const NON_ACTIVE_PRESCRIPTION_STATUSES = [PrescriptionStatus.COMPLETED, PrescriptionStatus.CANCELLED];
const RESULT_AVAILABLE_STATUSES = [ORDER_STATUS.RESULTS_APPROVED, ORDER_STATUS.COMPLETED];
const NEW_RESULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — no read/unread tracking exists on lab orders

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatAppointmentCard(appointment) {
  const isOpenState = ["scheduled", "pending"].includes(appointment.status);
  const isFutureDated = new Date(appointment.appointmentDate) >= new Date(new Date().toDateString());

  return {
    id: appointment.id,
    doctor: {
      id: appointment.doctor?.id || null,
      name: appointment.doctor?.fullName || null,
      specialty: appointment.doctor?.departmentSpecialty || null,
      profile_image: appointment.doctor?.profileImageUrl || null,
    },
    date: toDateOnly(appointment.appointmentDate),
    time: appointment.appointmentTime,
    consultation_type: appointment.type,
    status: appointment.status,
    payment_status: appointment.paymentStatus,
    reason: appointment.reason || null,
    can_reschedule: isOpenState && isFutureDated,
    can_cancel: isOpenState && isFutureDated,
  };
}

class PatientDashboardService {
  // GET /api/patient/appointments/upcoming/?limit=1
  async getUpcomingAppointments(patientId, limit = 1) {
    const appointments = await appointmentRepository.findUpcomingAppointmentsForPatient(patientId);
    return { appointments: appointments.slice(0, limit).map(formatAppointmentCard) };
  }

  // GET /api/patient/appointments/calendar/?month=YYYY-MM
  async getCalendar(patientId, month) {
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
    const endDate = new Date(Date.UTC(year, monthNum, 0)); // last day of month

    const appointments = await appointmentRepository.findByPatientAndDateRange(patientId, startDate, endDate);

    const events = appointments.map((appointment) => ({
      id: appointment.id,
      date: toDateOnly(appointment.appointmentDate),
      time: appointment.appointmentTime,
      type: "appointment",
      title: `Appointment with Dr. ${appointment.doctor?.fullName || "Doctor"}`,
      status: appointment.status,
    }));

    return { month, events };
  }

  // GET /api/patient/dashboard/summary/
  async getSummary(patientId, countryCode) {
    const [upcoming, prescriptions, labOrders, fileStats, wallet] = await Promise.all([
      appointmentRepository.findUpcomingAppointmentsForPatient(patientId),
      prescriptionService.getPatientPrescriptions(patientId, { limit: 100 }),
      labOrderService.getPatientOrders(patientId, 100, 0),
      DocumentFileService.getUserFileStats(patientId).catch(() => ({ stats: { total_files: 0 } })),
      patientWalletService.getSummary(patientId, countryCode).catch(() => ({ balance: 0, currency: "USD" })),
    ]);

    const activePrescriptions = prescriptions.filter(
      (p) => !NON_ACTIVE_PRESCRIPTION_STATUSES.includes(p.status)
    ).length;

    const availableResults = labOrders.filter((o) => RESULT_AVAILABLE_STATUSES.includes(o.status));
    const newResults = availableResults.filter((o) => {
      const deliveredAt = o.resultsDeliveredAt || o.updatedAt;
      return deliveredAt && Date.now() - new Date(deliveredAt).getTime() <= NEW_RESULT_WINDOW_MS;
    });

    return {
      upcoming_appointments: upcoming.length,
      active_prescriptions: activePrescriptions,
      new_lab_results: newResults.length,
      medical_records: Number(fileStats?.stats?.total_files || 0),
      wallet_balance: wallet.balance,
      currency: wallet.currency,
    };
  }

  // GET /api/patient/lab-results/summary/
  async getLabResultsSummary(patientId) {
    const orders = await labOrderService.getPatientOrders(patientId, 100, 0);
    const available = orders.filter((o) => RESULT_AVAILABLE_STATUSES.includes(o.status));
    const newResults = available.filter((o) => {
      const deliveredAt = o.resultsDeliveredAt || o.updatedAt;
      return deliveredAt && Date.now() - new Date(deliveredAt).getTime() <= NEW_RESULT_WINDOW_MS;
    });
    const latest = available[0] || null;

    return {
      total: available.length,
      new: newResults.length,
      latest: latest && {
        id: latest.id,
        test_name: Array.isArray(latest.testNames) ? latest.testNames[0] : latest.testNames,
        status: latest.status,
        is_read: !newResults.includes(latest),
        created_at: latest.createdAt,
      },
    };
  }

  // GET /api/patient/health-records/summary/
  async getHealthRecordsSummary(patientId) {
    const [stats, recent] = await Promise.all([
      DocumentFileService.getUserFileStats(patientId),
      DocumentFileService.getRecentFiles(patientId, 1),
    ]);
    const latest = recent?.files?.[0] || null;

    return {
      total_records: Number(stats?.stats?.total_files || 0),
      latest_record: latest && {
        id: latest.id,
        title: latest.originalFileName,
        type: latest.documentType,
        created_at: latest.createdAt,
      },
    };
  }
}

module.exports = new PatientDashboardService();
