const AppDataSource = require("../../../config/database");

const repo = () => AppDataSource.getRepository("Shipment");

const shipmentRepository = {
    findByOrderId(orderId) {
        return repo().findOne({ where: { orderId } });
    },

    findByTrackingNumber(trackingNumber) {
        return repo().findOne({ where: { trackingNumber } });
    },

    save(data) {
        return repo().save(data);
    },

    update(id, data) {
        return repo().update(id, data);
    },
};

module.exports = shipmentRepository;
