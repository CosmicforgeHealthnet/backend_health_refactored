// src/repositories/disputeRepository.js
const AppDataSource = require('../../../config/database');
const Dispute = require('../entities/Dispute');

class DisputeRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(Dispute);
  }

  create(data) {
    return this.repo.create(data);
  }

  save(dispute) {
    return this.repo.save(dispute);
  }

  findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: ['transaction', 'patient', 'doctor']
    });
  }

  findByTransactionId(transactionId) {
    return this.repo.find({
      where: { transactionId },
      order: { createdAt: 'DESC' }
    });
  }

  findByDoctorId(doctorId) {
    return this.repo.find({
      where: { doctorId },
      order: { createdAt: 'DESC' },
      relations: ['transaction', 'patient']
    });
  }

  findByPatientId(patientId) {
    return this.repo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      relations: ['transaction', 'doctor']
    });
  }

  findPendingDisputes() {
    return this.repo.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
      relations: ['transaction', 'patient', 'doctor']
    });
  }

  updateStatus(id, status, additionalData = {}) {
    return this.repo.update(id, {
      status,
      ...additionalData,
      resolvedAt: status === 'resolved' ? new Date() : undefined
    });
  }

  addDoctorResponse(id, response) {
    return this.repo.update(id, {
      doctorResponse: response,
      respondedAt: new Date()
    });
  }

  escalateToAdmin(id, adminNotes = null) {
    return this.repo.update(id, {
      status: 'escalated',
      escalatedAt: new Date(),
      adminNotes
    });
  }
}

module.exports = new DisputeRepository();