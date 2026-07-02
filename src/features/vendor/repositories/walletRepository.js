const AppDataSource = require("../../../config/database");

const walletRepo = () => AppDataSource.getRepository("VendorWallet");
const txnRepo    = () => AppDataSource.getRepository("VendorWalletTransaction");

const walletRepository = {
    findByVendorId(vendorId) {
        return walletRepo().findOne({ where: { vendorId } });
    },

    createWallet(vendorId) {
        return walletRepo().save({
            vendorId,
            availableBalanceNgn: 0,
            pendingClearanceNgn: 0,
            totalEarningsNgn:    0,
        });
    },

    update(id, data) {
        return walletRepo().update(id, data);
    },

    saveTransaction(data) {
        return txnRepo().save(data);
    },

    async findTransactionsByVendor({ vendorId, category, page = 1, limit = 20 }) {
        const qb = txnRepo()
            .createQueryBuilder("t")
            .where("t.vendorId = :vendorId", { vendorId })
            .orderBy("t.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (category) qb.andWhere("t.category = :category", { category });

        const [transactions, total] = await qb.getManyAndCount();
        return { transactions, total, page, limit };
    },
};

module.exports = walletRepository;
