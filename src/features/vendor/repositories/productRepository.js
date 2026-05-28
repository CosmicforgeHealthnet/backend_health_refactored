const AppDataSource = require("../../../config/database");

const productRepo      = () => AppDataSource.getRepository("Product");
const productMediaRepo = () => AppDataSource.getRepository("ProductMedia");

const productRepository = {
    findById(id) {
        return productRepo().findOne({
            where: { id },
            relations: ["media", "vendor"],
        });
    },

    findByIdAndVendor(id, vendorId) {
        return productRepo().findOne({
            where: { id, vendorId },
            relations: ["media"],
        });
    },

    async findByVendorPaginated({ vendorId, status, page = 1, limit = 20 }) {
        const qb = productRepo()
            .createQueryBuilder("p")
            .leftJoinAndSelect("p.media", "media")
            .where("p.vendorId = :vendorId", { vendorId })
            .orderBy("p.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (status) qb.andWhere("p.status = :status", { status });

        const [products, total] = await qb.getManyAndCount();
        return { products, total, page, limit };
    },

    async findApprovedPaginated({ category, subcategory, vendorId, minPrice, maxPrice, search, sortBy, page = 1, limit = 20 }) {
        const qb = productRepo()
            .createQueryBuilder("p")
            .leftJoinAndSelect("p.media", "media")
            .leftJoinAndSelect("p.vendor", "vendor")
            .where("p.status = :status", { status: "approved" })
            .andWhere("p.isActive = true")
            .skip((page - 1) * limit)
            .take(limit);

        if (category)    qb.andWhere("p.category = :category",       { category });
        if (subcategory) qb.andWhere("p.subcategory = :subcategory", { subcategory });
        if (vendorId)    qb.andWhere("p.vendorId = :vendorId",       { vendorId });
        if (minPrice)    qb.andWhere("p.price >= :minPrice",         { minPrice: Number(minPrice) });
        if (maxPrice)    qb.andWhere("p.price <= :maxPrice",         { maxPrice: Number(maxPrice) });
        if (search) {
            qb.andWhere("(LOWER(p.title) LIKE :search OR LOWER(p.description) LIKE :search)", {
                search: `%${search.toLowerCase()}%`,
            });
        }

        const sortMap = {
            price_asc:  ["p.price",     "ASC"],
            price_desc: ["p.price",     "DESC"],
            newest:     ["p.createdAt", "DESC"],
        };
        const [col, dir] = sortMap[sortBy] || sortMap.newest;
        qb.orderBy(col, dir);

        const [products, total] = await qb.getManyAndCount();
        return { products, total, page, limit };
    },

    async findAllForAdminPaginated({ status, category, page = 1, limit = 20 }) {
        const qb = productRepo()
            .createQueryBuilder("p")
            .leftJoinAndSelect("p.media",   "media")
            .leftJoinAndSelect("p.vendor",  "vendor")
            .orderBy("p.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (status)   qb.andWhere("p.status = :status",     { status });
        if (category) qb.andWhere("p.category = :category", { category });

        const [products, total] = await qb.getManyAndCount();
        return { products, total, page, limit };
    },

    save(product) {
        return productRepo().save(product);
    },

    update(id, data) {
        return productRepo().update(id, data);
    },

    delete(id) {
        return productRepo().delete(id);
    },

    saveMedia(mediaData) {
        return productMediaRepo().save(mediaData);
    },

    deleteMedia(productId) {
        return productMediaRepo().delete({ productId });
    },
};

module.exports = productRepository;
