// repositories/DisputeRepository.js
const AppDataSource = require('../../../config/database');
const Dispute = require("../entities/Disputes");

class DisputeRepository {
  constructor() {
    this.repository = AppDataSource.getRepository(Dispute);
  }

  async findAll() {
    return await this.repository.find({
      relations: [
        "user"
        // 'transaction'
      ],
    });
  }

  async findById(id) {
    return await this.repository.findOne({
      where: { id },
      relations: [
        "user"
        // 'transaction'
      ],
    });
  }

  async findByUserId(userId) {
    return await this.repository.find({
      where: { userId },
      relations: [
        "user"
        // 'transaction'
      ],
    });
  }

  async create(disputeData) {
    const dispute = this.repository.create(disputeData);
    return await this.repository.save(dispute);
  }

  async update(id, disputeData) {
    await this.repository.update(id, disputeData);
    return await this.findById(id);
  }

  async delete(id) {
    return await this.repository.delete(id);
  }
}

module.exports = DisputeRepository;
