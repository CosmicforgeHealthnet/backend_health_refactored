const { AppDataSource } = require("../../../config/database");
const InvoiceSchema = require("../entities/Invoice");

const repo = () => AppDataSource.getRepository(InvoiceSchema);

const invoiceRepository = {
  save: (data) => repo().save(data),

  findById: (id) =>
    repo().findOne({
      where: { id },
      relations: ["lineItems", "prescription", "pharmacy", "patient"],
    }),

  findByIdAndPharmacy: (id, pharmacyId) =>
    repo().findOne({
      where: { id, pharmacyId },
      relations: ["lineItems", "prescription"],
    }),

  findByIdAndPatient: (id, patientId) =>
    repo().findOne({
      where: { id, patientId },
      relations: ["lineItems", "prescription"],
    }),

  findByReference: (reference, pharmacyId) =>
    repo().findOne({ where: { reference, pharmacyId } }),

  /**
   * Paginated list for pharmacy with optional filters.
   */
  findByPharmacy: async ({ pharmacyId, status, search, prescriptionId, dateFrom, dateTo, page, limit }) => {
    const qb = repo()
      .createQueryBuilder("inv")
      .leftJoinAndSelect("inv.lineItems", "li")
      .leftJoinAndSelect("inv.prescription", "prx")
      .leftJoinAndSelect("inv.patient", "pat")
      .where("inv.pharmacyId = :pharmacyId", { pharmacyId });

    if (status)         qb.andWhere("inv.status = :status", { status });
    if (prescriptionId) qb.andWhere("inv.prescriptionId = :prescriptionId", { prescriptionId });
    if (dateFrom)       qb.andWhere("inv.createdAt >= :dateFrom", { dateFrom });
    if (dateTo)         qb.andWhere("inv.createdAt <= :dateTo", { dateTo });

    if (search) {
      qb.andWhere(
        "(pat.firstName ILIKE :q OR pat.lastName ILIKE :q OR inv.reference ILIKE :q OR prx.reference ILIKE :q)",
        { q: `%${search}%` }
      );
    }

    const total = await qb.getCount();
    const invoices = await qb
      .orderBy("inv.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { invoices, total };
  },

  /**
   * Paginated list for patient.
   */
  findByPatient: async ({ patientId, status, page, limit }) => {
    const qb = repo()
      .createQueryBuilder("inv")
      .leftJoinAndSelect("inv.lineItems", "li")
      .leftJoinAndSelect("inv.pharmacy", "pha")
      .where("inv.patientId = :patientId", { patientId });

    if (status) qb.andWhere("inv.status = :status", { status });

    const total = await qb.getCount();
    const invoices = await qb
      .orderBy("inv.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { invoices, total };
  },

  /**
   * Get the next sequential invoice number for a pharmacy.
   * Returns a zero-padded 6-digit string like "000042".
   */
  getNextSequence: async (pharmacyId) => {
    const count = await repo().count({ where: { pharmacyId } });
    return String(count + 1).padStart(6, "0");
  },

  /**
   * Find invoices that are past their dueAt and not yet overdue/paid/cancelled.
   */
  findOverdue: () =>
    repo()
      .createQueryBuilder("inv")
      .where("inv.dueAt < NOW()")
      .andWhere("inv.status NOT IN (:...excluded)", {
        excluded: ["paid", "overdue", "cancelled"],
      })
      .getMany(),

  update: (id, data) => repo().update(id, data),
};

module.exports = invoiceRepository;
