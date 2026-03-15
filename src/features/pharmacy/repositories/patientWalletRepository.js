const { AppDataSource } = require("../../../config/database");
const PatientWallet = require("../entities/PatientWallet");

const repo = () => AppDataSource.getRepository(PatientWallet);

const patientWalletRepository = {
  save: (data) => repo().save(data),

  findByPatientId: (patientId) => repo().findOne({ where: { patientId } }),

  findById: (id) => repo().findOne({ where: { id } }),

  creditBalance: async (patientId, amountUsd) => {
    await repo()
      .createQueryBuilder()
      .update()
      .set({
        balanceUsd:     () => `"balanceUsd" + ${amountUsd}`,
        totalTopUpsUsd: () => `"totalTopUpsUsd" + ${amountUsd}`,
      })
      .where("patientId = :patientId", { patientId })
      .execute();

    return repo().findOne({ where: { patientId } });
  },

  debitBalance: async (patientId, amountUsd) => {
    await repo()
      .createQueryBuilder()
      .update()
      .set({
        balanceUsd:    () => `GREATEST("balanceUsd" - ${amountUsd}, 0)`,
        totalSpentUsd: () => `"totalSpentUsd" + ${amountUsd}`,
      })
      .where("patientId = :patientId", { patientId })
      .execute();

    return repo().findOne({ where: { patientId } });
  },

  update: (id, data) => repo().update(id, data),
};

module.exports = patientWalletRepository;
