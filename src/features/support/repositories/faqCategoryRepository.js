// src/repositories/faqCategoryRepository.js
const AppDataSource = require('../../../config/database');
const FAQCategory = require('../entities/FAQCategory');

class FAQCategoryRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(FAQCategory);
  }

  async findById(id) {
    return this.repo.findOne({ where: { id } });
  }

  async findBySlug(slug) {
    return this.repo.findOne({ where: { slug } });
  }

  async findByRole(targetRole) {
    return this.repo.find({
      where: [
        { targetRole, isActive: true },
        { targetRole: 'all', isActive: true }
      ],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findAll() {
    return this.repo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async create(categoryData) {
    const category = this.repo.create(categoryData);
    return this.repo.save(category);
  }

  async update(id, updateData) {
    updateData.updatedAt = new Date();
    await this.repo.update(id, updateData);
    return this.findById(id);
  }

  async delete(id) {
    return this.repo.update(id, { isActive: false });
  }
}

module.exports = new FAQCategoryRepository();
