const AppDataSource = require("../../../config/database");
const PatientWalletTransactionSchema = require("../entities/PatientWalletTransaction");

const repo = () => AppDataSource.getRepository(PatientWalletTransactionSchema);

const patientWalletTransactionRepository = {
  save: (data) => repo().save(data),

  findById: (id) => repo().findOne({ where: { id } }),

  findByReference: (reference) => repo().findOne({ where: { reference } }),

  findByWallet: async ({ walletId, type, category, page = 1, limit = 20 }) => {
    const qb = repo()
      .createQueryBuilder("txn")
      .where("txn.walletId = :walletId", { walletId });

    if (type)     qb.andWhere("txn.type = :type", { type });
    if (category) qb.andWhere("txn.category = :category", { category });

    const total = await qb.getCount();
    const transactions = await qb
      .orderBy("txn.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { transactions, total };
  },

  update: (id, data) => repo().update(id, data),
};

module.exports = patientWalletTransactionRepository;
