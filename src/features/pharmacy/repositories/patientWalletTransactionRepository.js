const AppDataSource = require("../../../config/database");
const PatientWalletTransactionSchema = require("../entities/PatientWalletTransaction");
const { PatientTxnStatus } = PatientWalletTransactionSchema;

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

  /**
   * Atomically transitions a PENDING transaction to COMPLETED/FAILED.
   * The WHERE clause includes status = 'pending' so that two concurrent
   * calls for the same reference (e.g. a duplicate webhook delivery) can
   * never both succeed — only the first affects a row. Callers must check
   * `result.affected` before crediting/debiting the wallet.
   */
  markCompletedIfPending: (id) =>
    repo()
      .createQueryBuilder()
      .update()
      .set({ status: PatientTxnStatus.COMPLETED })
      .where("id = :id AND status = :pending", { id, pending: PatientTxnStatus.PENDING })
      .execute(),

  markFailedIfPending: (id) =>
    repo()
      .createQueryBuilder()
      .update()
      .set({ status: PatientTxnStatus.FAILED })
      .where("id = :id AND status = :pending", { id, pending: PatientTxnStatus.PENDING })
      .execute(),
};

module.exports = patientWalletTransactionRepository;
