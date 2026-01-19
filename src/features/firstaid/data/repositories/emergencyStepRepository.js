const AppDataSource = require("../../../../config/database");

class EmergencyStepRepository {
  constructor() {
    this.repo = AppDataSource.getRepository("EmergencyStep");
  }

  async create(data) {
    return this.repo.create(data);
  }

  async save(step) {
    return this.repo.save(step);
  }

  async findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: ["condition", "categoryImage"],
    });
  }

  async findByConditionId(conditionId) {
    return this.repo.find({
      where: { condition_id: conditionId },
      relations: ["categoryImage"],
      order: { sortOrder: "ASC", categoryType: "ASC" },
    });
  }

  async findByConditionAndCategory(conditionId, categoryType) {
    return this.repo.findOne({
      where: {
        condition_id: conditionId,
        categoryType: categoryType,
      },
      relations: ["categoryImage"],
    });
  }

  async findAll() {
    return this.repo.find({
      relations: ["condition", "categoryImage"],
      order: { sortOrder: "ASC" },
    });
  }

  async update(id, data) {
    return this.repo.update(id, {
      ...data,
      updatedAt: new Date(),
    });
  }

  async delete(id, queryRunner = null) {
    const repo = queryRunner ? queryRunner.manager.getRepository("EmergencyStep") : this.repo;
    return repo.delete(id);
  }

  async deleteByConditionId(conditionId, queryRunner = null) {
    const repo = queryRunner ? queryRunner.manager.getRepository("EmergencyStep") : this.repo;
    return repo.delete({ condition_id: conditionId });
  }

  async updateSortOrder(id, sortOrder) {
    return this.repo.update(id, {
      sortOrder,
      updatedAt: new Date(),
    });
  }
}

module.exports = new EmergencyStepRepository();
