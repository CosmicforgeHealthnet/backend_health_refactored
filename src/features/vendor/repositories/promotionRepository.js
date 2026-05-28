const AppDataSource = require("../../../config/database");

const promoRepo          = () => AppDataSource.getRepository("Promotion");
const promoProductRepo   = () => AppDataSource.getRepository("PromotionProduct");
const campaignProductRepo = () => AppDataSource.getRepository("CampaignProduct");

const promotionRepository = {
    findById(id) {
        return promoRepo().findOne({
            where: { id },
            relations: ["promotionProducts", "promotionProducts.product", "campaignProduct", "vendor"],
        });
    },

    findByIdAndVendor(id, vendorId) {
        return promoRepo().findOne({
            where: { id, vendorId },
            relations: ["promotionProducts", "promotionProducts.product", "campaignProduct"],
        });
    },

    findByReference(paymentReference) {
        return promoRepo().findOne({ where: { paymentReference } });
    },

    async findByVendorPaginated({ vendorId, type, status, page = 1, limit = 20 }) {
        const qb = promoRepo()
            .createQueryBuilder("p")
            .leftJoinAndSelect("p.promotionProducts", "promotionProducts")
            .leftJoinAndSelect("p.campaignProduct",   "campaignProduct")
            .where("p.vendorId = :vendorId", { vendorId })
            .orderBy("p.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (type)   qb.andWhere("p.type = :type",     { type });
        if (status) qb.andWhere("p.status = :status", { status });

        const [promotions, total] = await qb.getManyAndCount();
        return { promotions, total, page, limit };
    },

    async getActiveByVendor(vendorId) {
        return promoRepo().find({
            where: { vendorId, status: "active" },
            relations: ["promotionProducts", "campaignProduct"],
        });
    },

    save(data) {
        return promoRepo().save(data);
    },

    update(id, data) {
        return promoRepo().update(id, data);
    },

    delete(id) {
        return promoRepo().delete(id);
    },

    savePromotionProducts(items) {
        return promoProductRepo().save(items);
    },

    deletePromotionProducts(promotionId) {
        return promoProductRepo().delete({ promotionId });
    },

    saveCampaignProduct(data) {
        return campaignProductRepo().save(data);
    },

    updateCampaignProduct(promotionId, data) {
        return campaignProductRepo().update({ promotionId }, data);
    },

    // Trend data — counts by day for the past N days
    async getTrendsByVendor(vendorId, days = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        return promoRepo()
            .createQueryBuilder("p")
            .select("DATE(p.createdAt)", "date")
            .addSelect("COUNT(*)",        "total")
            .addSelect("SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END)", "active")
            .addSelect("SUM(p.pricePaid)", "totalSpend")
            .where("p.vendorId = :vendorId", { vendorId })
            .andWhere("p.createdAt >= :since", { since })
            .groupBy("DATE(p.createdAt)")
            .orderBy("date", "ASC")
            .getRawMany();
    },
};

module.exports = promotionRepository;
