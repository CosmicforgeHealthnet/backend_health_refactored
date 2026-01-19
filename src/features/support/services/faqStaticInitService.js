// src/services/faqStaticInitService.js
const faqRepository = require('../repositories/faqRepository');
const staticFAQData = require('../../../data/staticFAQData');

class FAQStaticInitService {

  /**
   * Initialize static FAQs (run once on system setup)
   */
  async initializeStaticFAQs() {
    try {
      const staticFAQs = staticFAQData.getStaticFAQsData();

      let createdCount = 0;
      let existingCount = 0;

      for (const faqData of staticFAQs) {
        const existingFAQ = await faqRepository.findBySlug(faqData.slug);
        if (!existingFAQ) {
          await faqRepository.create({
            ...faqData,
            isStatic: true,
            status: 'published',
            publishedAt: new Date(),
          });
          createdCount++;
        } else {
          existingCount++;
        }
      }

      const result = {
        total: staticFAQs.length,
        created: createdCount,
        existing: existingCount,
        message: `Static FAQs initialized: ${createdCount} created, ${existingCount} already existed`
      };

      console.log(result.message);
      return result;
    } catch (error) {
      console.error('Error initializing static FAQs:', error);
      throw error;
    }
  }

  /**
   * Update existing static FAQs (if needed)
   */
  async updateStaticFAQs() {
    try {
      const staticFAQs = staticFAQData.getStaticFAQsData();

      let updatedCount = 0;
      let notFoundCount = 0;

      for (const faqData of staticFAQs) {
        const existingFAQ = await faqRepository.findBySlug(faqData.slug);
        if (existingFAQ && existingFAQ.isStatic) {
          await faqRepository.update(existingFAQ.id, {
            title: faqData.title,
            content: faqData.content,
            searchKeywords: faqData.searchKeywords,
            relatedLinks: faqData.relatedLinks,
            priority: faqData.priority,
            updatedAt: new Date(),
          });
          updatedCount++;
        } else {
          notFoundCount++;
        }
      }

      const result = {
        total: staticFAQs.length,
        updated: updatedCount,
        notFound: notFoundCount,
        message: `Static FAQs updated: ${updatedCount} updated, ${notFoundCount} not found`
      };

      console.log(result.message);
      return result;
    } catch (error) {
      console.error('Error updating static FAQs:', error);
      throw error;
    }
  }

  /**
   * Reset static FAQs (delete and recreate)
   */
  async resetStaticFAQs() {
    try {
      // Find all static FAQs
      const staticFAQs = await faqRepository.findAll({ isStatic: true });

      // Delete existing static FAQs
      for (const faq of staticFAQs[0]) { // staticFAQs returns [faqs, count]
        await faqRepository.delete(faq.id);
      }

      // Recreate static FAQs
      const result = await this.initializeStaticFAQs();

      return {
        ...result,
        deleted: staticFAQs[1], // count of deleted FAQs
        message: `Static FAQs reset: ${staticFAQs[1]} deleted, ${result.created} recreated`
      };
    } catch (error) {
      console.error('Error resetting static FAQs:', error);
      throw error;
    }
  }
}

module.exports = new FAQStaticInitService();
