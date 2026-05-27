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
