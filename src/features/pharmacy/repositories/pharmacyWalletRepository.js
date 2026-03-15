const AppDataSource = require("../../../config/database");
const PharmacyWallet = require("../entities/PharmacyWallet");

const repo = () => AppDataSource.getRepository(PharmacyWallet);

const pharmacyWalletRepository = {
  save: (data) => repo().save(data),

  findByPharmacyId: (pharmacyId) =>
    repo().findOne({ where: { pharmacyId } }),

  findById: (id) => repo().findOne({ where: { id } }),

  /**
   * Atomically credit pendingClearance (escrow) — used for online payments.
   * Returns updated wallet.
   */
  creditEscrow: async (pharmacyId, amountUsd) => {
    await repo()
      .createQueryBuilder()
      .update()
      .set({
        pendingClearanceUsd: () => `"pendingClearanceUsd" + ${amountUsd}`,
        totalEarningsUsd:    () => `"totalEarningsUsd" + ${amountUsd}`,
      })
      .where("pharmacyId = :pharmacyId", { pharmacyId })
      .execute();

    return repo().findOne({ where: { pharmacyId } });
  },

  /**
   * Atomically credit availableBalance directly — used for cash/POS payments.
   */
  creditAvailable: async (pharmacyId, amountUsd) => {
    await repo()
      .createQueryBuilder()
      .update()
      .set({
        availableBalanceUsd: () => `"availableBalanceUsd" + ${amountUsd}`,
        totalEarningsUsd:    () => `"totalEarningsUsd" + ${amountUsd}`,
      })
      .where("pharmacyId = :pharmacyId", { pharmacyId })
      .execute();

    return repo().findOne({ where: { pharmacyId } });
  },

  /**
   * Move amount from pendingClearance → availableBalance (clearance job).
   */
  clearEscrow: async (pharmacyId, amountUsd) => {
    await repo()
      .createQueryBuilder()
      .update()
      .set({
        pendingClearanceUsd: () => `GREATEST("pendingClearanceUsd" - ${amountUsd}, 0)`,
        availableBalanceUsd: () => `"availableBalanceUsd" + ${amountUsd}`,
      })
      .where("pharmacyId = :pharmacyId", { pharmacyId })
      .execute();

    return repo().findOne({ where: { pharmacyId } });
  },

  /**
   * Deduct from availableBalance when payout is initiated.
   */
  deductForPayout: async (pharmacyId, amountUsd) => {
    await repo()
      .createQueryBuilder()
      .update()
      .set({
        availableBalanceUsd: () => `GREATEST("availableBalanceUsd" - ${amountUsd}, 0)`,
      })
      .where("pharmacyId = :pharmacyId", { pharmacyId })
      .execute();

    return repo().findOne({ where: { pharmacyId } });
  },

  /**
   * Restore to availableBalance when payout is cancelled or failed.
   */
  restoreFromPayout: async (pharmacyId, amountUsd) => {
    await repo()
      .createQueryBuilder()
      .update()
      .set({
        availableBalanceUsd: () => `"availableBalanceUsd" + ${amountUsd}`,
      })
      .where("pharmacyId = :pharmacyId", { pharmacyId })
      .execute();

    return repo().findOne({ where: { pharmacyId } });
  },

  /**
   * Debit availableBalance (dispute resolution — patient_favour / split).
   */
  debitForDispute: async (pharmacyId, amountUsd) => {
    await repo()
      .createQueryBuilder()
      .update()
      .set({
        availableBalanceUsd: () => `GREATEST("availableBalanceUsd" - ${amountUsd}, 0)`,
        totalEarningsUsd:    () => `GREATEST("totalEarningsUsd" - ${amountUsd}, 0)`,
      })
      .where("pharmacyId = :pharmacyId", { pharmacyId })
      .execute();

    return repo().findOne({ where: { pharmacyId } });
  },

  update: (id, data) => repo().update(id, data),
};

module.exports = pharmacyWalletRepository;
