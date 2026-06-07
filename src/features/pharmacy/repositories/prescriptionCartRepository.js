const AppDataSource = require("../../../config/database");

const cartRepo = () => AppDataSource.getRepository("PrescriptionCart");
const itemRepo = () => AppDataSource.getRepository("PrescriptionCartItem");

const prescriptionCartRepository = {
    findBySessionId(sessionId) {
        return cartRepo().findOne({
            where: { sessionId },
            relations: ["items"],
        });
    },

    findByPaymentReference(paymentReference) {
        return cartRepo().findOne({ where: { paymentReference } });
    },

    save(data) {
        return cartRepo().save(data);
    },

    update(id, data) {
        return cartRepo().update(id, data);
    },

    saveItem(data) {
        return itemRepo().save(data);
    },

    findItemById(id) {
        return itemRepo().findOne({ where: { id } });
    },

    deleteItem(id) {
        return itemRepo().delete(id);
    },

    deleteAllItems(cartId) {
        return itemRepo().delete({ cartId });
    },
};

module.exports = prescriptionCartRepository;
