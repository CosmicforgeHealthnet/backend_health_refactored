// src/repositories/pharmacy/pharmacyProfileRepository.js
const AppDataSource = require("../../../config/database");

class PharmacyProfileRepository {
  get repo() {
    return AppDataSource.getRepository("PharmacyProfile");
  }

  async create(data) {
    return this.repo.create(data);
  }

  async save(pharmacyProfile) {
    return this.repo.save(pharmacyProfile);
  }

  async findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: ["user", "documents", "branches"]
    });
  }

  async findByUserId(userId) {
    try {
      return await this.repo.findOne({
        where: { userId },
        relations: ["user", "documents", "branches"]
      });
    } catch (e) {
      console.error('💥 PROFILE_REPO_ERROR:', e);
      if (e.stack) console.error('PROFILE_REPO_STACK:', e.stack);
      throw e;
    }
  }

  async findByUsername(username) {
    return this.repo.findOne({
      where: { preferredUsername: username }
    });
  }

  async findByRegistrationNumber(registrationNumber) {
    return this.repo.findOne({
      where: { registrationNumber }
    });
  }

  async updateDocumentSubmissionStatus(id, documentsSubmitted) {
    return this.repo.update(id, {
      documentsSubmitted,
      updatedAt: new Date()
    });
  }

  // Used by GET /api/patient/nearby-vendors/ — Haversine distance, no PostGIS
  // in this database, so this is plain SQL rather than an ORM query.
  async findNearby({ lat, lng, radiusKm = 10, limit = 20 }) {
    return this.repo.query(
      `
      SELECT * FROM (
        SELECT
          "id", "pharmacyName", "logoUrl", "address", "operatingHours",
          "deliveryAvailable", "pickupAvailable", "latitude", "longitude",
          6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians($1)) * cos(radians("latitude")) * cos(radians("longitude") - radians($2)) +
              sin(radians($1)) * sin(radians("latitude"))
            ))
          ) AS "distanceKm"
        FROM "pharmacy_profiles"
        WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL
          AND "isActive" = true AND "verificationStatus" = 'approved'
      ) sub
      WHERE "distanceKm" <= $3
      ORDER BY "distanceKm" ASC
      LIMIT $4
      `,
      [lat, lng, radiusKm, limit]
    );
  }

  async findAll(options = {}) {
    const { limit = 50, offset = 0, verificationStatus } = options;
    const where = verificationStatus ? { verificationStatus } : {};
    return this.repo.find({
      where,
      relations: ["user"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset
    });
  }

  async findPendingVerifications() {
    return this.repo.find({
      where: { verificationStatus: "pending" },
      relations: ["user", "documents"]
    });
  }

  async updateVerificationStatus(id, status) {
    return this.repo.update(id, {
      verificationStatus: status,
      isActive: status === "approved",
      updatedAt: new Date()
    });
  }

  async updateLogoUrl(userId, logoUrl) {
    const profile = await this.repo.findOne({ where: { userId } });
    if (!profile) throw Object.assign(new Error("Pharmacy profile not found"), { status: 404 });
    return this.repo.update(profile.id, { logoUrl, updatedAt: new Date() });
  }
}

module.exports = new PharmacyProfileRepository();
