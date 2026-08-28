// GET /api/patient/nearby-vendors/ — unified pharmacy + shop-vendor
// discovery, ranked by real distance (Haversine) from the patient's
// coordinates. Both repositories own the distance calculation; this just
// merges and re-ranks their results.
const pharmacyProfileRepository = require("../../pharmacy/repositories/pharmacyProfileRepository");
const vendorRepository = require("../../vendor/repositories/vendorRepository");

function mapPharmacy(row) {
  return {
    id: row.id,
    name: row.pharmacyName,
    type: "pharmacy",
    logo: row.logoUrl || null,
    distance_km: Math.round(parseFloat(row.distanceKm) * 10) / 10,
    address: row.address,
    // operatingHours has no fixed schema in this codebase (free-text or
    // arbitrary JSON depending on how the pharmacy filled it in), so open/
    // closed state can't be reliably derived here — surfaced as-is instead
    // of guessing.
    is_open: null,
    closes_at: null,
    operating_hours: row.operatingHours || null,
    delivery_available: row.deliveryAvailable,
    pickup_available: row.pickupAvailable,
  };
}

function mapVendor(row) {
  return {
    id: row.id,
    name: row.businessName,
    type: "store",
    logo: row.logoUrl || null,
    distance_km: Math.round(parseFloat(row.distanceKm) * 10) / 10,
    address: row.fullAddress,
    is_open: null,
    closes_at: null,
    operating_hours: null,
    delivery_available: row.deliveryAvailable,
    pickup_available: row.pickupAvailable,
  };
}

class NearbyVendorService {
  async getNearbyVendors({ lat, lng, radius = 10, type = "all", limit = 20 }) {
    const wantPharmacy = type === "all" || type === "pharmacy";
    const wantStore = type === "all" || type === "store";

    const [pharmacies, vendors] = await Promise.all([
      wantPharmacy
        ? pharmacyProfileRepository.findNearby({ lat, lng, radiusKm: radius, limit })
        : [],
      wantStore
        ? vendorRepository.findNearby({ lat, lng, radiusKm: radius, limit })
        : [],
    ]);

    const merged = [...pharmacies.map(mapPharmacy), ...vendors.map(mapVendor)]
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);

    return { vendors: merged };
  }
}

module.exports = new NearbyVendorService();
