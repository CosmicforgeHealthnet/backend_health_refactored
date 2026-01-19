// repositories/ReportRepository.js
const AppDataSource = require('../../../config/database');
const Report = require("../entities/Report")

class ReportRepository {
  constructor() {
    this.repository = AppDataSource.getRepository(Report);

  }

  async findAll() {
    return await this.repository.find({
      relations: ['user']
    });
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

  async create(reportData) {
    const report = this.repository.create(reportData);
    return await this.repository.save(report);
  }

  async update(id, reportData) {
    await this.repository.update(id, reportData);
    return await this.findById(id);
  }

  async delete(id) {
    return await this.repository.delete(id);
  }
}

module.exports = ReportRepository;