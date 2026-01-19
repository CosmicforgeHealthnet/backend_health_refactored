// src/repositories/transactionSplitRepository.js
const AppDataSource = require('../../../config/database');
const TransactionSplit = require('../entities/TransactionSplit');

class TransactionSplitRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(TransactionSplit);
  }

  create(data) {
    return this.repo.create(data);
  }

  save(split) {
    return this.repo.save(split);
  }

  saveMultiple(splits) {
    return this.repo.save(splits);
  }

  findByTransactionId(transactionId) {
    return this.repo.find({
      where: { transactionId }
    });
  }

  findByRecipientType(recipientType) {
    return this.repo.find({
      where: { recipientType },
      order: { createdAt: 'DESC' }
    });
  }

  findPendingForDoctor(doctorId) {
    return this.repo.find({
      where: {
        recipientType: 'doctor_wallet',
        recipientId: doctorId,
        status: 'pending'
      }
    });
  }

  releasePendingFunds(transactionId) {
    return this.repo.update(
      { transactionId, status: 'pending' },
      { status: 'released', releasedAt: new Date() }
    );
  }

  updateStatus(id, status) {
    return this.repo.update(id, { status });
  }
}

module.exports = new TransactionSplitRepository();