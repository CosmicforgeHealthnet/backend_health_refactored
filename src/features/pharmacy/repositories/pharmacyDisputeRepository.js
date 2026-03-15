const AppDataSource = require("../../../config/database");
const DisputeSchema = require("../entities/PharmacyDispute");

const repo = () => AppDataSource.getRepository(DisputeSchema);

const pharmacyDisputeRepository = {
  save: (data) => repo().save(data),

  findById: (id) =>
    repo().findOne({ where: { id }, relations: ["invoice"] }),

  findByIdAndPharmacy: (id, pharmacyId) =>
    repo().findOne({ where: { id, pharmacyId }, relations: ["invoice"] }),

  findByInvoice: (invoiceId) =>
    repo().findOne({ where: { invoiceId }, order: { createdAt: "DESC" } }),

  /**
   * Check if an open/under_review dispute exists for an invoice.
   */
  hasOpenDispute: async (invoiceId) => {
    const { DisputeStatus } = DisputeSchema;
    const count = await repo().count({
      where: [
        { invoiceId, status: DisputeStatus.OPEN },
        { invoiceId, status: DisputeStatus.UNDER_REVIEW },
      ],
    });
    return count > 0;
  },

  /**
   * Paginated list for pharmacy.
   */
  findByPharmacy: async ({ pharmacyId, status, page, limit }) => {
    const qb = repo()
      .createQueryBuilder("d")
      .leftJoinAndSelect("d.invoice", "inv")
      .where("d.pharmacyId = :pharmacyId", { pharmacyId });

    if (status) qb.andWhere("d.status = :status", { status });

    const total = await qb.getCount();
    const disputes = await qb
      .orderBy("d.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { disputes, total };
  },

  update: (id, data) => repo().update(id, data),
};

module.exports = pharmacyDisputeRepository;
