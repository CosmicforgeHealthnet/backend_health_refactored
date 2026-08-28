// Patient safety alerts — currently just the drug-drug interaction (DDI)
// banner described in the dashboard API spec (section 6). The backend is
// the source of truth for interaction detection; the frontend only renders
// what this endpoint returns.
const prescriptionService = require("../../pharmacy/services/prescriptionService");
const { PrescriptionStatus } = require("../../pharmacy/entities/Prescription");
const drugInteractionService = require("./drugInteractionService");
const cache = require("../../../shared/utils/cache");

const CACHE_TTL_SECONDS = 60 * 60; // 1 hour — DDI results don't need to be real-time

class PatientAlertService {
  async getAlerts(patientId) {
    return cache.getOrSet(
      `patient:alerts:${patientId}`,
      () => this._buildAlerts(patientId),
      CACHE_TTL_SECONDS
    );
  }

  async _buildAlerts(patientId) {
    try {
      const prescriptions = await prescriptionService.getPatientPrescriptions(patientId, { limit: 50 });
      const active = prescriptions.filter((p) => p.status !== PrescriptionStatus.CANCELLED);

      // Map each distinct medication name to the most recent prescription it appears on
      const drugToPrescription = new Map();
      for (const prescription of active) {
        for (const med of prescription.medications || []) {
          const key = (med.name || "").trim().toLowerCase();
          if (key && !drugToPrescription.has(key)) {
            drugToPrescription.set(key, prescription);
          }
        }
      }

      if (drugToPrescription.size < 2) return { alerts: [] };

      const resolved = await Promise.allSettled(
        Array.from(drugToPrescription.keys()).map(async (name) => ({
          name,
          rxcui: await drugInteractionService.resolveRxcui(name),
        }))
      );

      const rxcuiToDrug = new Map();
      for (const result of resolved) {
        if (result.status === "fulfilled" && result.value.rxcui) {
          rxcuiToDrug.set(result.value.rxcui, result.value.name);
        }
      }

      if (rxcuiToDrug.size < 2) return { alerts: [] };

      const pairs = await drugInteractionService.checkInteractions(Array.from(rxcuiToDrug.keys()));

      const alerts = pairs.map((pair, index) => {
        const involvedNames = pair.drugs?.length ? pair.drugs : [];
        const sourcePrescription =
          involvedNames.map((n) => drugToPrescription.get(n.toLowerCase())).find(Boolean) ||
          active[0];

        return {
          id: `alert_ddi_${patientId}_${index}`,
          type: "drug_interaction",
          severity: pair.severity || "unspecified",
          title: "Drug Interaction Alert",
          message: pair.description || "A potential interaction was found between two of your medications.",
          resource_type: "prescription",
          resource_id: sourcePrescription?.id || null,
          is_read: false,
          requires_action: true,
          created_at: new Date().toISOString(),
        };
      });

      return { alerts };
    } catch (error) {
      // Alerts are an optional dashboard section — never let an interaction
      // lookup failure (e.g. RxNav being unreachable) break the banner.
      console.error("patientAlertService.getAlerts error:", error.message);
      return { alerts: [] };
    }
  }
}

module.exports = new PatientAlertService();
