const asyncHandler = require("express-async-handler");
const patientDashboardService = require("../services/patientDashboardService");
const doctorRecommendationService = require("../services/doctorRecommendationService");
const nearbyVendorService = require("../services/nearbyVendorService");
const patientActivityService = require("../services/patientActivityService");
const patientAlertService = require("../services/patientAlertService");
const communityService = require("../../community/services/communityService");
const { formatCommunity } = require("../../community/utils/formatters");

function getPatientId(req) {
  return req.user.sub || req.user.id;
}

function getCountryCode(req) {
  return req.location?.countryCode || req.query.countryCode || "US";
}

class PatientDashboardController {
  getUpcomingAppointments = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 1;
    const result = await patientDashboardService.getUpcomingAppointments(getPatientId(req), limit);
    res.status(200).json(result);
  });

  getCalendar = asyncHandler(async (req, res) => {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ code: "INVALID_MONTH", message: "month must be in YYYY-MM format" });
    }
    const result = await patientDashboardService.getCalendar(getPatientId(req), month);
    res.status(200).json(result);
  });

  getSummary = asyncHandler(async (req, res) => {
    const result = await patientDashboardService.getSummary(getPatientId(req), getCountryCode(req));
    res.status(200).json(result);
  });

  getLabResultsSummary = asyncHandler(async (req, res) => {
    const result = await patientDashboardService.getLabResultsSummary(getPatientId(req));
    res.status(200).json(result);
  });

  getHealthRecordsSummary = asyncHandler(async (req, res) => {
    const result = await patientDashboardService.getHealthRecordsSummary(getPatientId(req));
    res.status(200).json(result);
  });

  getRecommendedDoctors = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 3;
    const result = await doctorRecommendationService.getRecommendedDoctors(limit);
    res.status(200).json(result);
  });

  getNearbyVendors = asyncHandler(async (req, res) => {
    const { lat, lng, radius, type, limit } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ code: "LOCATION_REQUIRED", message: "lat and lng query params are required" });
    }
    const result = await nearbyVendorService.getNearbyVendors({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius: radius ? parseFloat(radius) : 10,
      type: type || "all",
      limit: limit ? parseInt(limit, 10) : 20,
    });
    res.status(200).json(result);
  });

  getRecentActivity = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 5;
    const result = await patientActivityService.getRecentActivity(getPatientId(req), limit);
    res.status(200).json(result);
  });

  // GET /api/patient/dashboard/ — initial page hydration. Each section is
  // fetched independently so one failing domain never blanks the whole page.
  getDashboard = asyncHandler(async (req, res) => {
    const patientId = getPatientId(req);
    const countryCode = getCountryCode(req);

    const settle = (promise, fallback) =>
      promise.then((v) => v).catch((err) => {
        console.error("patient dashboard section failed:", err.message);
        return fallback;
      });

    const [summary, upcoming, alerts, recommendedDoctors, recommendedCommunities, activity] = await Promise.all([
      settle(patientDashboardService.getSummary(patientId, countryCode), {}),
      settle(patientDashboardService.getUpcomingAppointments(patientId, 1), { appointments: [] }),
      settle(patientAlertService.getAlerts(patientId), { alerts: [] }),
      settle(doctorRecommendationService.getRecommendedDoctors(3), { doctors: [] }),
      settle(
        communityService.discoverCommunities(patientId, { privacyType: "public", page: 1, limit: 3 }),
        { communities: [] }
      ),
      settle(patientActivityService.getRecentActivity(patientId, 5), { activities: [] }),
    ]);

    res.status(200).json({
      patient: { id: patientId },
      summary,
      next_appointment: upcoming.appointments[0] || null,
      alerts: alerts.alerts,
      recommended_doctors: recommendedDoctors.doctors,
      recommended_communities: (recommendedCommunities.communities || []).map(formatCommunity),
      // nearby_vendors requires lat/lng — omitted from initial hydration;
      // frontend calls GET /api/patient/nearby-vendors/ once it has the
      // patient's location (browser geolocation or a saved address).
      nearby_vendors: [],
      recent_activity: activity.activities,
    });
  });
}

module.exports = new PatientDashboardController();
