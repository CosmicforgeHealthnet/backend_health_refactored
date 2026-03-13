const { AppDataSource } = require("../../../config/database");
const PayoutSchema = require("../entities/PharmacyPayoutRequest");

const repo = () => AppDataSource.getRepository(PayoutSchema);

const pharmacyPayoutRepository = {
  save: (data) => repo().save(data),

  findById: (id) =>
    repo().findOne({ where: { id }, relations: ["bankAccount"] }),

  findByIdAndPharmacy: (id, pharmacyId) =>
    repo().findOne({ where: { id, pharmacyId }, relations: ["bankAccount"] }),

  findByReference: (reference) =>
    repo().findOne({ where: { reference }, relations: ["bankAccount"] }),

  findByTransferCode: (transferCode) =>
    repo().findOne({ where: { transferCode } }),

  /**
   * Check if pharmacy has a payout in pending or processing state.
   */
  hasActivePayout: async (pharmacyId) => {
    const { PayoutStatus } = PayoutSchema;
    const count = await repo().count({
      where: [
        { pharmacyId, status: PayoutStatus.PENDING },
        { pharmacyId, status: PayoutStatus.PROCESSING },
      ],
    });
    return count > 0;
  },

  /**
   * Paginated list with optional status filter.
   */
  findByPharmacy: async ({ pharmacyId, status, page, limit }) => {
    const qb = repo()
      .createQueryBuilder("po")
      .leftJoinAndSelect("po.bankAccount", "ba")
      .where("po.pharmacyId = :pharmacyId", { pharmacyId });

    if (status) qb.andWhere("po.status = :status", { status });

    const total = await qb.getCount();
    const payouts = await qb
      .orderBy("po.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { payouts, total };
  },

  update: (id, data) => repo().update(id, data),
};

module.exports = pharmacyPayoutRepository;
