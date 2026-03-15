const AppDataSource = require("../../../config/database");
const WalletTransactionSchema = require("../entities/PharmacyWalletTransaction");

const repo = () => AppDataSource.getRepository(WalletTransactionSchema);

const pharmacyWalletTransactionRepository = {
  save: (data) => repo().save(data),

  findById: (id) => repo().findOne({ where: { id } }),

  /**
   * Paginated list with optional filters.
   */
  findByWallet: async ({ walletId, type, status, category, dateFrom, dateTo, page, limit }) => {
    const qb = repo()
      .createQueryBuilder("txn")
      .where("txn.walletId = :walletId", { walletId });

    if (type)     qb.andWhere("txn.type = :type", { type });
    if (status)   qb.andWhere("txn.status = :status", { status });
    if (category) qb.andWhere("txn.category = :category", { category });
    if (dateFrom) qb.andWhere("txn.createdAt >= :dateFrom", { dateFrom });
    if (dateTo)   qb.andWhere("txn.createdAt <= :dateTo", { dateTo });

    const total = await qb.getCount();
    const transactions = await qb
      .orderBy("txn.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { transactions, total };
  },

  /**
   * Earnings summary for a period range.
   */
  getEarningsSummary: async (pharmacyId, dateFrom, dateTo) => {
    const { WalletTransactionType, WalletTransactionStatus, WalletTransactionCategory } = WalletTransactionSchema;

    return repo()
      .createQueryBuilder("txn")
      .select("SUM(txn.amountUsd)", "totalUsd")
      .addSelect("COUNT(*)", "count")
      .where("txn.pharmacyId = :pharmacyId", { pharmacyId })
      .andWhere("txn.type = :type", { type: WalletTransactionType.CREDIT })
      .andWhere("txn.status IN (:...statuses)", {
        statuses: [WalletTransactionStatus.COMPLETED, WalletTransactionStatus.PENDING],
      })
      .andWhere("txn.category = :category", { category: WalletTransactionCategory.INVOICE_PAYMENT })
      .andWhere("txn.createdAt BETWEEN :dateFrom AND :dateTo", { dateFrom, dateTo })
      .getRawOne();
  },

  /**
   * Find pending escrow transactions older than N business days — used by clearance cron.
   */
  findPendingForClearance: (cutoffDate) => {
    const { WalletTransactionStatus, WalletTransactionCategory } = WalletTransactionSchema;

    return repo()
      .createQueryBuilder("txn")
      .where("txn.status = :status", { status: WalletTransactionStatus.PENDING })
      .andWhere("txn.category = :category", { category: WalletTransactionCategory.INVOICE_PAYMENT })
      .andWhere("txn.createdAt <= :cutoffDate", { cutoffDate })
      .getMany();
  },

  /**
   * Mark a list of transactions as completed and set settledAt.
   */
  markCleared: (ids) =>
    repo()
      .createQueryBuilder()
      .update()
      .set({ status: WalletTransactionSchema.WalletTransactionStatus.COMPLETED, settledAt: new Date() })
      .whereInIds(ids)
      .execute(),

  update: (id, data) => repo().update(id, data),
};

module.exports = pharmacyWalletTransactionRepository;
