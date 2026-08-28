const AppDataSource = require("../../../config/database");

const vendorRepo             = () => AppDataSource.getRepository("VendorProfile");
const vendorDocumentRepo     = () => AppDataSource.getRepository("VendorDocument");
const vendorVerificationRepo = () => AppDataSource.getRepository("VendorVerificationRequest");

const vendorRepository = {
    findByUserId(userId) {
        return vendorRepo().findOne({
            where: { userId },
            relations: ["documents", "verificationRequests"],
        });
    },

    findById(id) {
        return vendorRepo().findOne({
            where: { id },
            relations: ["documents", "verificationRequests"],
        });
    },

    findByBusinessEmail(businessEmail) {
        return vendorRepo().findOne({ where: { businessEmail } });
    },

    // Used by GET /api/patient/nearby-vendors/ — Haversine distance, no PostGIS
    // in this database, so this is plain SQL rather than an ORM query.
    async findNearby({ lat, lng, radiusKm = 10, limit = 20 }) {
        return vendorRepo().query(
            `
            SELECT * FROM (
                SELECT
                    "id", "businessName", "logoUrl", "fullAddress",
                    "deliveryAvailable", "pickupAvailable", "latitude", "longitude",
                    6371 * acos(
                        LEAST(1, GREATEST(-1,
                            cos(radians($1)) * cos(radians("latitude")) * cos(radians("longitude") - radians($2)) +
                            sin(radians($1)) * sin(radians("latitude"))
                        ))
                    ) AS "distanceKm"
                FROM "vendor_profiles"
                WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL
                    AND "isActive" = true AND "verificationStatus" = 'approved'
            ) sub
            WHERE "distanceKm" <= $3
            ORDER BY "distanceKm" ASC
            LIMIT $4
            `,
            [lat, lng, radiusKm, limit]
        );
    },

    async findAllPaginated({ page = 1, limit = 20, verificationStatus } = {}) {
        const qb = vendorRepo()
            .createQueryBuilder("v")
            .leftJoinAndSelect("v.documents", "documents")
            .orderBy("v.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (verificationStatus) {
            qb.where("v.verificationStatus = :verificationStatus", { verificationStatus });
        }

        const [vendors, total] = await qb.getManyAndCount();
        return { vendors, total, page, limit };
    },

    saveDocument(documentData) {
        return vendorDocumentRepo().save(documentData);
    },

    saveVerificationRequest(requestData) {
        return vendorVerificationRepo().save(requestData);
    },
};

module.exports = vendorRepository;
