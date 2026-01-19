// src/services/faqAdminService.js
const faqRepository = require('../repositories/faqRepository');
const faqCategoryRepository = require('../repositories/faqCategoryRepository');
const faqHelpers = require('../helpers/faqHelpers');
const faqAnalyticsService = require('./faqAnalyticsService');

class FAQAdminService {

  /**
   * Create FAQ (Admin)
   */
  async createFAQ(faqData, createdBy) {
    try {
      // Generate slug from title
      const slug = faqHelpers.generateSlug(faqData.title);

      // Check for duplicate slug
      const existingFAQ = await faqRepository.findBySlug(slug);
      if (existingFAQ) {
        throw new Error('FAQ with this title already exists');
      }

      const faq = await faqRepository.create({
        ...faqData,
        slug,
        createdBy,
        publishedAt: faqData.status === 'published' ? new Date() : null,
      });

      return faq;
    } catch (error) {
      console.error('Error creating FAQ:', error);
      throw error;
    }
  }

  /**
   * Update FAQ (Admin)
   */
  async updateFAQ(id, updateData, updatedBy) {
    try {
      const faq = await faqRepository.findById(id);
      if (!faq) {
        throw new Error('FAQ not found');
      }

      // Generate new slug if title changed
      if (updateData.title && updateData.title !== faq.title) {
        updateData.slug = faqHelpers.generateSlug(updateData.title);

        // Check for duplicate slug
        const existingFAQ = await faqRepository.findBySlug(updateData.slug);
        if (existingFAQ && existingFAQ.id !== id) {
          throw new Error('FAQ with this title already exists');
        }
      }

      // Set published date if status changed to published
      if (updateData.status === 'published' && faq.status !== 'published') {
        updateData.publishedAt = new Date();
      }

      updateData.updatedBy = updatedBy;

      return await faqRepository.update(id, updateData);
    } catch (error) {
      console.error('Error updating FAQ:', error);
      throw error;
    }
  }

  /**
   * Delete FAQ (Admin)
   */
  async deleteFAQ(id) {
    try {
      const faq = await faqRepository.findById(id);
      if (!faq) {
        throw new Error('FAQ not found');
      }

      if (faq.isStatic) {
        throw new Error('Cannot delete static FAQs');
      }

      return await faqRepository.delete(id);
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      throw error;
    }
  }

  /**
   * Get all FAQs with filters (Admin)
   */
  async getAllFAQs(filters = {}) {
    try {
      const [faqs, total] = await faqRepository.findAll(filters);

      return {
        faqs,
        total,
        page: filters.page || 1,
        limit: filters.limit || 50,
        totalPages: Math.ceil(total / (filters.limit || 50))
      };
    } catch (error) {
      console.error('Error getting all FAQs:', error);
      throw error;
    }
  }

  /**
   * Get FAQ analytics (Admin)
   */
  async getFAQAnalytics(startDate = null, endDate = null) {
    try {
      return await faqAnalyticsService.getComprehensiveAnalytics(startDate, endDate);
    } catch (error) {
      console.error('Error getting FAQ analytics:', error);
      throw error;
    }
  }

  /**
   * Create category (Admin)
   */
  async createCategory(categoryData) {
    try {
      const slug = faqHelpers.generateSlug(categoryData.name);

      const existingCategory = await faqCategoryRepository.findBySlug(slug);
      if (existingCategory) {
        throw new Error('Category with this name already exists');
      }

      return await faqCategoryRepository.create({
        ...categoryData,
        slug
      });
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  /**
   * Update category (Admin)
   */
  async updateCategory(id, updateData) {
    try {
      const category = await faqCategoryRepository.findById(id);
      if (!category) {
        throw new Error('Category not found');
      }

      if (updateData.name && updateData.name !== category.name) {
        updateData.slug = faqHelpers.generateSlug(updateData.name);

        const existingCategory = await faqCategoryRepository.findBySlug(updateData.slug);
        if (existingCategory && existingCategory.id !== id) {
          throw new Error('Category with this name already exists');
        }
      }

      return await faqCategoryRepository.update(id, updateData);
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }
}

module.exports = new FAQAdminService();
