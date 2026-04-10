// src/repositories/transactionRepository.js
const AppDataSource = require('../../../config/database');
const Transaction = require('../entities/Transaction');

class TransactionRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(Transaction);
  }

  create(data) {
    return this.repo.create(data);
  }

  save(transaction) {
    return this.repo.save(transaction);
  }

  findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: ['splits', 'disputes', 'paymentMethod', 'patient', 'doctor']
    });
  }

  findByPatientId(patientId) {
    return this.repo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      relations: ['splits', 'doctor']
    });
  }

  findByDoctorId(doctorId) {
    return this.repo.find({
      where: { doctorId },
      order: { createdAt: 'DESC' },
      relations: ['splits', 'patient']
    });
  }

  // Add these methods to your TransactionRepository

  /**
   * Find transactions by status
   */
  findByStatus(status) {
    return this.repo.find({
      where: { status },
      order: { createdAt: 'DESC' }
    });
  }

  // Add this method to transactionRepository
  async findByProviderReference(providerReference) {
    try {
      return await this.repo.findOne({
        where: { providerReference: providerReference }
      });
    } catch (error) {
      console.error('Error finding transaction by provider reference:', error);
      return null;
    }
  }

  /**
 * Find transactions by patient ID and service type
 */
  async findByPatientIdAndServiceType(patientId, serviceType) {
    return await this.repo.find({
      where: {
        patientId,
        serviceType
      },
      order: {
        appointmentDate: 'DESC'
      },
      relations: ['patient', 'doctor']
    });
  }

  /**
   * Find transactions by doctor ID and service type
   */
  async findByDoctorIdAndServiceType(doctorId, serviceType) {
    return await this.repo.find({
      where: {
        doctorId,
        serviceType
      },
      order: {
        appointmentDate: 'DESC'
      },
      relations: ['patient', 'doctor']
    });
  }

  /**
   * Find appointment transactions with date range
   */
  findAppointmentsByDateRange(startDate, endDate) {
    return this.repo.find({
      where: {
        serviceType: 'appointment',
        appointmentDate: AppDataSource.createQueryBuilder()
          .where('appointmentDate >= :startDate', { startDate })
          .andWhere('appointmentDate <= :endDate', { endDate })
      },
      order: { appointmentDate: 'ASC' }
    });
  }

  /**
   * Update appointment date
   */
  async updateAppointmentDate(transactionId, newDate) {
    const now = new Date();
    let disputeWindowStartsAt, disputeWindowEndsAt, fundsStatus;

    if (newDate <= now) {
      disputeWindowStartsAt = now;
      disputeWindowEndsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      fundsStatus = 'pending_dispute';
    } else {
      disputeWindowStartsAt = newDate;
      disputeWindowEndsAt = new Date(newDate.getTime() + 3 * 24 * 60 * 60 * 1000);
      fundsStatus = 'pending_appointment';
    }

    return this.repo.update(transactionId, {
      appointmentDate: newDate,
      disputeWindowStartsAt,
      disputeWindowEndsAt,
      fundsStatus,
      lastRescheduledAt: now
    });
  }

  /**
   * Get transactions requiring funds release
   */
  findTransactionsForFundsRelease() {
    return this.repo.find({
      where: {
        fundsStatus: 'pending_dispute',
        disputeWindowEndsAt: AppDataSource.createQueryBuilder()
          .where('disputeWindowEndsAt <= NOW()')
      }
    });
  }

  /**
   * Get appointment transactions awaiting date
   */
  findAppointmentsPendingDate() {
    return this.repo.find({
      where: {
        serviceType: 'appointment',
        fundsStatus: 'pending_appointment',
        appointmentDate: AppDataSource.createQueryBuilder()
          .where('appointmentDate <= NOW()')
      }
    });
  }

  /**
   * Search transactions
   */
  searchTransactions(filters) {
    const query = this.repo.createQueryBuilder('transaction');

    if (filters.serviceType) {
      query.andWhere('transaction.serviceType = :serviceType', { serviceType: filters.serviceType });
    }

    if (filters.status) {
      query.andWhere('transaction.status = :status', { status: filters.status });
    }

    if (filters.minAmount) {
      query.andWhere('transaction.originalAmount >= :minAmount', { minAmount: filters.minAmount });
    }

    if (filters.maxAmount) {
      query.andWhere('transaction.originalAmount <= :maxAmount', { maxAmount: filters.maxAmount });
    }

    if (filters.startDate) {
      query.andWhere('transaction.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      query.andWhere('transaction.createdAt <= :endDate', { endDate: filters.endDate });
    }

    return query
      .orderBy('transaction.createdAt', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit)
      .getMany();
  }

  /**
   * Get payment analytics by date range
   */
  getPaymentAnalytics(startDate, endDate) {
    return this.repo.createQueryBuilder('transaction')
      .select([
        'serviceType',
        'originalCurrency',
        'COUNT(*) as count',
        'SUM(CASE WHEN status = "completed" THEN originalAmount ELSE 0 END) as revenue',
        'AVG(CASE WHEN status = "completed" THEN originalAmount END) as avgAmount'
      ])
      .where('transaction.createdAt >= :startDate', { startDate })
      .andWhere('transaction.createdAt <= :endDate', { endDate })
      .groupBy('serviceType, originalCurrency')
      .getRawMany();
  }

  findByProviderTransactionId(providerTransactionId) {
    return this.repo.findOne({
      where: { providerTransactionId }
    });
  }

  findByServiceType(serviceType) {
    return this.repo.find({
      where: { serviceType },
      order: { createdAt: 'DESC' }
    });
  }

  findByServiceId(serviceType, serviceId) {
    return this.repo.find({
      where: { serviceType, serviceId },
      order: { createdAt: 'DESC' }
    });
  }

  findPendingDisputes() {
    return this.repo.find({
      where: {
        status: 'completed',
        disputeWindowEndsAt: AppDataSource.createQueryBuilder()
          .select('NOW()')
          .getQuery() + ' < dispute_window_ends_at'
      }
    });
  }

  /**
 * Find auto-billing transactions
 */
  findAutoBillingTransactions(userId = null) {
    const where = { isAutoBilling: true };
    if (userId) {
      where.patientId = userId;
    }

    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['splits', 'paymentMethod']
    });
  }

  /**
   * Create auto-billing transaction
   */
  createAutoBillingTransaction(data) {
    return this.repo.create({
      ...data,
      isAutoBilling: true
    });
  }

  /**
   * Get auto-billing statistics
   */
  async getAutoBillingStats() {
    return this.repo.createQueryBuilder('transaction')
      .select([
        'COUNT(*) as totalAutoBilling',
        'COUNT(CASE WHEN status = \'completed\' THEN 1 END) as successfulAutoBilling',
        'COUNT(CASE WHEN status = \'failed\' THEN 1 END) as failedAutoBilling'
      ])
      .where('transaction.isAutoBilling = :isAutoBilling', { isAutoBilling: true })
      .getRawOne();
  }

  updateStatus(id, status, additionalData = {}) {
    return this.repo.update(id, { status, ...additionalData });
  }
}

module.exports = new TransactionRepository();
