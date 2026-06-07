const AppDataSource = require("../../../config/database");

const sessionRepo = () => AppDataSource.getRepository("PharmacySession");

const sessionRepository = {
    findById(id) {
        return sessionRepo().findOne({
            where: { id },
            relations: ["cart", "cart.items"],
        });
    },

    findByIdAndPharmacy(id, pharmacyId) {
        return sessionRepo().findOne({
            where: { id, pharmacyId },
            relations: ["cart", "cart.items"],
        });
    },

    findByIdAndPatient(id, patientId) {
        return sessionRepo().findOne({
            where: { id, patientId },
            relations: ["cart", "cart.items"],
        });
    },

    // All active sessions for a prescription (across all pharmacies)
    findActiveByPrescription(prescriptionId) {
        return sessionRepo().find({
            where: { prescriptionId, status: "active" },
            relations: ["cart", "cart.items"],
        });
    },

    // All sessions started by a patient
    async findByPatientPaginated({ patientId, status, page = 1, limit = 20 }) {
        const qb = sessionRepo()
            .createQueryBuilder("s")
            .leftJoinAndSelect("s.cart", "cart")
            .leftJoinAndSelect("cart.items", "items")
            .where("s.patientId = :patientId", { patientId })
            .orderBy("s.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (status) qb.andWhere("s.status = :status", { status });

        const [sessions, total] = await qb.getManyAndCount();
        return { sessions, total, page, limit };
    },

    // All sessions for a pharmacy
    async findByPharmacyPaginated({ pharmacyId, status, page = 1, limit = 20 }) {
        const qb = sessionRepo()
            .createQueryBuilder("s")
            .leftJoinAndSelect("s.cart", "cart")
            .leftJoinAndSelect("cart.items", "items")
            .where("s.pharmacyId = :pharmacyId", { pharmacyId })
            .orderBy("s.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (status) qb.andWhere("s.status = :status", { status });

        const [sessions, total] = await qb.getManyAndCount();
        return { sessions, total, page, limit };
    },

    // Existing active session for this patient+pharmacy+prescription combo
    findExisting(prescriptionId, pharmacyId, patientId) {
        return sessionRepo().findOne({
            where: { prescriptionId, pharmacyId, patientId, status: "active" },
        });
    },

    save(data) {
        return sessionRepo().save(data);
    },

    update(id, data) {
        return sessionRepo().update(id, data);
    },
};

module.exports = sessionRepository;
