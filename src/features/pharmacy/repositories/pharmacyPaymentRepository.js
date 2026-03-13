const { AppDataSource } = require("../../../config/database");
const PaymentSchema = require("../entities/PharmacyPayment");

const repo = () => AppDataSource.getRepository(PaymentSchema);

const pharmacyPaymentRepository = {
  save: (data) => repo().save(data),

  findById: (id) => repo().findOne({ where: { id } }),

  findByReference: (reference) =>
    repo().findOne({ where: { reference } }),

  findByProviderReference: (providerReference) =>
    repo().findOne({ where: { providerReference } }),

  /**
   * Find the latest pending payment for an invoice — used for idempotency.
   */
  findPendingByInvoice: (invoiceId) => {
    const { PharmacyPaymentStatus } = PaymentSchema;
    return repo().findOne({
      where: { invoiceId, status: PharmacyPaymentStatus.PENDING },
      order: { createdAt: "DESC" },
    });
  },

  /**
   * Count recent payment attempts for rate limiting (5 per hour).
   */
  countRecentAttempts: async (invoiceId, since) =>
    repo()
      .createQueryBuilder("pay")
      .where("pay.invoiceId = :invoiceId", { invoiceId })
      .andWhere("pay.createdAt >= :since", { since })
      .getCount(),

  update: (id, data) => repo().update(id, data),
};

module.exports = pharmacyPaymentRepository;
