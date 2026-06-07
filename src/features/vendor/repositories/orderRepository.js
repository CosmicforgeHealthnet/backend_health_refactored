const AppDataSource = require("../../../config/database");

const orderRepo = () => AppDataSource.getRepository("VendorOrder");

const orderRepository = {
    findById(id) {
        return orderRepo().findOne({
            where: { id },
            relations: ["vendor", "patient"],
        });
    },

    findByOrderNumber(orderNumber) {
        return orderRepo().findOne({ where: { orderNumber } });
    },

    findByCartId(cartId) {
        return orderRepo().findOne({
            where: { cartId },
            relations: ["vendor", "patient"],
        });
    },

    findByPaymentReference(paymentReference) {
        return orderRepo().findOne({ where: { paymentReference } });
    },

    async findByPatientPaginated({ patientId, status, page = 1, limit = 20 }) {
        const qb = orderRepo()
            .createQueryBuilder("o")
            .leftJoinAndSelect("o.vendor", "vendor")
            .where("o.patientId = :patientId", { patientId })
            .orderBy("o.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (status) qb.andWhere("o.status = :status", { status });

        const [orders, total] = await qb.getManyAndCount();
        return { orders, total, page, limit };
    },

    async findByVendorPaginated({ vendorId, status, paymentStatus, page = 1, limit = 20 }) {
        const qb = orderRepo()
            .createQueryBuilder("o")
            .leftJoinAndSelect("o.patient", "patient")
            .where("o.vendorId = :vendorId", { vendorId })
            .orderBy("o.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (status)        qb.andWhere("o.status = :status",               { status });
        if (paymentStatus) qb.andWhere("o.paymentStatus = :paymentStatus", { paymentStatus });

        const [orders, total] = await qb.getManyAndCount();
        return { orders, total, page, limit };
    },

    save(data) {
        return orderRepo().save(data);
    },

    update(id, data) {
        return orderRepo().update(id, data);
    },
};

module.exports = orderRepository;
