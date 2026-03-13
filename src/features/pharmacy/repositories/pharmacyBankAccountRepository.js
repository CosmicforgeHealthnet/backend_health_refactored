const { AppDataSource } = require("../../../config/database");
const PharmacyBankAccount = require("../entities/PharmacyBankAccount");

const repo = () => AppDataSource.getRepository(PharmacyBankAccount);

const pharmacyBankAccountRepository = {
  save: (data) => repo().save(data),

  findById: (id) => repo().findOne({ where: { id } }),

  findByIdAndPharmacy: (id, pharmacyId) =>
    repo().findOne({ where: { id, pharmacyId, isActive: true } }),

  findByPharmacy: (pharmacyId) =>
    repo().find({ where: { pharmacyId, isActive: true }, order: { createdAt: "ASC" } }),

  findDefault: (pharmacyId) =>
    repo().findOne({ where: { pharmacyId, isDefault: true, isActive: true } }),

  countByPharmacy: (pharmacyId) =>
    repo().count({ where: { pharmacyId, isActive: true } }),

  /**
   * Set one account as default, remove default from all others.
   * Uses a transaction to keep it atomic.
   */
  setDefault: async (id, pharmacyId) => {
    const manager = AppDataSource.manager;

    await manager.transaction(async (trx) => {
      // Clear all defaults for this pharmacy
      await trx.update(PharmacyBankAccount, { pharmacyId }, { isDefault: false });
      // Set the chosen one
      await trx.update(PharmacyBankAccount, { id, pharmacyId }, { isDefault: true });
    });

    return repo().findOne({ where: { id } });
  },

  softDelete: (id) => repo().update(id, { isActive: false }),

  update: (id, data) => repo().update(id, data),
};

module.exports = pharmacyBankAccountRepository;
