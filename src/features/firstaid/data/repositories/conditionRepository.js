const AppDataSource = require("../../../../config/database");

class ConditionRepository {
  constructor() {
    this.repo = AppDataSource.getRepository("Condition");
  }

  async create(data) {
    return this.repo.create(data);
  }

  async save(condition) {
    return this.repo.save(condition);
  }

  async findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: [
        "imageFile",
        "emergencySteps",
        "emergencySteps.categoryImage",
      ],
    });
  }

  async findAll(filters = {}) {
    const { contentType, isActive, severity } = filters;
    const whereConditions = {};

    if (contentType) whereConditions.contentType = contentType;
    if (typeof isActive !== "undefined") whereConditions.isActive = isActive;
    if (severity) whereConditions.severity = severity;

    return this.repo.find({
      where: whereConditions,
      relations: ["imageFile"],
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  async findAllWithSteps(filters = {}) {
    const { contentType, isActive, severity } = filters;
    const whereConditions = {};

    if (contentType) whereConditions.contentType = contentType;
    if (typeof isActive !== "undefined") whereConditions.isActive = isActive;
    if (severity) whereConditions.severity = severity;

    return this.repo.find({
      where: whereConditions,
      relations: ["imageFile", "emergencySteps", "emergencySteps.categoryImage"],
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  async findByContentType(contentType, isActiveOnly = true) {
    const whereConditions = { contentType };
    if (isActiveOnly) whereConditions.isActive = true;

    return this.repo.find({
      where: whereConditions,
      relations: ["imageFile"],
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  async update(id, data) {
    return this.repo.update(id, {
      ...data,
      updatedAt: new Date(),
    });
  }

  async delete(id, queryRunner = null) {
    const repo = queryRunner ? queryRunner.manager.getRepository("Condition") : this.repo;
    return repo.delete(id);
  }

  async toggleActive(id, isActive) {
    return this.repo.update(id, {
      isActive,
      updatedAt: new Date(),
    });
  }

  async updateSortOrder(id, sortOrder) {
    return this.repo.update(id, {
      sortOrder,
      updatedAt: new Date(),
    });
  }
}

module.exports = new ConditionRepository();
