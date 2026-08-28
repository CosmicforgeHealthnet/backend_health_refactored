// GET /api/patient/doctors/recommended/ — reuses the existing verified-doctor
// discovery query (doctorService.getAllVerifiedDoctors) rather than building
// a parallel search/ranking engine. "Recommended" here means: verified,
// bookable (has pricing + availability set up), ranked by rating.
const doctorService = require("../../doctor/services/doctorService");
const DoctorAvailabilityService = require("../../doctor/services/doctorAvailabilityService");
const cache = require("../../../shared/utils/cache");

const doctorAvailabilityService = new DoctorAvailabilityService();
const NEXT_AVAILABLE_SEARCH_DAYS = 14;

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

async function findNextAvailableSlot(doctorId) {
  for (let offset = 0; offset < NEXT_AVAILABLE_SEARCH_DAYS; offset++) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const dateStr = toDateString(date);

    try {
      const { availableSlots } = await doctorAvailabilityService.getAvailableSlots(doctorId, dateStr);
      if (availableSlots?.length) {
        return `${dateStr}T${availableSlots[0]}`;
      }
    } catch {
      // Skip a day the availability lookup can't resolve rather than failing the whole card
    }
  }
  return null;
}

class DoctorRecommendationService {
  async getRecommendedDoctors(limit = 3) {
    return cache.getOrSet(
      `patient:doctors:recommended:${limit}`,
      () => this._buildRecommendations(limit),
      300 // 5 minutes — matches doctorService's own verified-doctor cache TTL
    );
  }

  async _buildRecommendations(limit) {
    // Over-fetch a page since not every verified doctor is bookable yet
    const { data } = await doctorService.getAllVerifiedDoctors({ page: 1, limit: Math.max(limit * 4, 12) });

    const bookable = data
      .filter((d) => d.isBookable)
      .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
      .slice(0, limit);

    const doctors = await Promise.all(
      bookable.map(async (doctor) => ({
        id: doctor.id,
        name: doctor.fullName,
        specialty: doctor.departmentSpecialty || null,
        profile_image: doctor.profileImageUrl || null,
        rating: doctor.averageRating || null,
        review_count: doctor.totalRatings || 0,
        next_available: await findNextAvailableSlot(doctor.id),
      }))
    );

    return { doctors };
  }
}

module.exports = new DoctorRecommendationService();
