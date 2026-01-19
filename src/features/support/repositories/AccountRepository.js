// ===================================
// repositories/AccountSupportRepository.js
// ===================================
const AppDataSource = require("../../../config/database");
const AccountSupport = require("../entities/Account");

class AccountSupportRepository {
  constructor() {
    this.repository = AppDataSource.getRepository(AccountSupport);
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
      relations: ['user'],
      order: { createdAt: 'DESC' }
    });
  }

  async create(accountData) {
    const account = this.repository.create(accountData);
    return await this.repository.save(account);
  }

  async update(id, accountData) {
    await this.repository.update(id, accountData);
    return await this.findById(id);
  }

  async delete(id) {
    return await this.repository.delete(id);
  }

  async findByStatus(status) {
    return await this.repository.find({
      where: { status },
      relations: ['user'],
      order: { createdAt: 'DESC' }
    });
  }

  async findByIssueType(issueType) {
    return await this.repository.find({
      where: { issueType },
      relations: ['user'],
      order: { createdAt: 'DESC' }
    });
  }
}

module.exports = AccountSupportRepository;