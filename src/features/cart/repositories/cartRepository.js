const AppDataSource = require("../../../config/database");

const cartRepo     = () => AppDataSource.getRepository("Cart");
const cartItemRepo = () => AppDataSource.getRepository("CartItem");

const cartRepository = {
    findDraftByPatientAndVendor(patientId, vendorId) {
        return cartRepo().findOne({
            where: { patientId, vendorId, status: "draft" },
            relations: ["items", "items.product", "items.product.media", "vendor"],
        });
    },

    findById(id) {
        return cartRepo().findOne({
            where: { id },
            relations: ["items", "items.product", "items.product.media", "vendor", "patient"],
        });
    },

    findByIdAndPatient(id, patientId) {
        return cartRepo().findOne({
            where: { id, patientId },
            relations: ["items", "items.product", "items.product.media", "vendor"],
        });
    },

    findByIdAndVendor(id, vendorId) {
        return cartRepo().findOne({
            where: { id, vendorId },
            relations: ["items", "items.product", "items.product.media", "patient"],
        });
    },

    async findByPatientPaginated({ patientId, status, page = 1, limit = 20 }) {
        const qb = cartRepo()
            .createQueryBuilder("c")
            .leftJoinAndSelect("c.items",   "items")
            .leftJoinAndSelect("c.vendor",  "vendor")
            .where("c.patientId = :patientId", { patientId })
            .orderBy("c.updatedAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (status) qb.andWhere("c.status = :status", { status });

        const [carts, total] = await qb.getManyAndCount();
        return { carts, total, page, limit };
    },

    async findByVendorPaginated({ vendorId, status, page = 1, limit = 20 }) {
        const qb = cartRepo()
            .createQueryBuilder("c")
            .leftJoinAndSelect("c.items",   "items")
            .leftJoinAndSelect("c.patient", "patient")
            .where("c.vendorId = :vendorId", { vendorId })
            .orderBy("c.updatedAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (status) qb.andWhere("c.status = :status", { status });

        const [carts, total] = await qb.getManyAndCount();
        return { carts, total, page, limit };
    },

    saveCart(data) {
        return cartRepo().save(data);
    },

    updateCart(id, data) {
        return cartRepo().update(id, data);
    },

    findItemById(id) {
        return cartItemRepo().findOne({ where: { id }, relations: ["cart"] });
    },

    findItemByCartAndProduct(cartId, productId) {
        return cartItemRepo().findOne({ where: { cartId, productId } });
    },

    saveItem(data) {
        return cartItemRepo().save(data);
    },

    updateItem(id, data) {
        return cartItemRepo().update(id, data);
    },

    deleteItem(id) {
        return cartItemRepo().delete(id);
    },
};

module.exports = cartRepository;
