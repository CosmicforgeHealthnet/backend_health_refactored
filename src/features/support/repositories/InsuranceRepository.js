// repositories/InsuranceRepository.js
const AppDataSource = require('../../../config/database');
const InsuranceSupport = require("../entities/Insurance")


class InsuranceSupportRepository {
  constructor() {
    this.repository = AppDataSource.getRepository(InsuranceSupport);
  }

  async findAll() {
    return await this.repository.find({ relations: ['user'] });
  }

  async findById(id) {
    return await this.repository.findOne({
      where: { id },
      relations: ['user']
    });
  }

  async findByUserId(userId) {
    return await this.repository.find({
      where: { userId },
      relations: ['user']
    });
  }

  async create(insuranceData) {
    const insurance = this.repository.create(insuranceData);
    return await this.repository.save(insurance);
  }

  async update(id, insuranceData) {
    await this.repository.update(id, insuranceData);
    return await this.findById(id);
  }

  async delete(id) {
    return await this.repository.delete(id);
  }
}

module.exports = InsuranceSupportRepository;