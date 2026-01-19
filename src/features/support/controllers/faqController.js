// src/controllers/faqController.js
const faqService = require('../services/faqService');
const faqAdminService = require('../services/faqAdminService');
const faqStaticInitService = require('../services/faqStaticInitService');
const faqHelpers = require('../helpers/faqHelpers');
const faqVoteService = require('../services/faqVoteService');

class FAQController {

  /**
   * Get FAQs for patients
   * GET /api/faq/patient
   */
  async getPatientFAQs(req, res, next) {
    try {
      const { category } = req.query;

      const result = await faqService.getFAQsByRole('patient', category);

      res.json({
        success: true,
        message: 'Patient FAQs retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error getting patient FAQs:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get FAQs for doctors
   * GET /api/faq/doctor
   */
  async getDoctorFAQs(req, res, next) {
    try {
      const { category } = req.query;

      const result = await faqService.getFAQsByRole('doctor', category);

      res.json({
        success: true,
        message: 'Doctor FAQs retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error getting doctor FAQs:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get general FAQs
   * GET /api/faq/general
   */
  async getGeneralFAQs(req, res, next) {
    try {
      const { category } = req.query;

      const result = await faqService.getFAQsByRole('general', category);

      res.json({
        success: true,
        message: 'General FAQs retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error getting general FAQs:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Search FAQs
   * GET /api/faq/search
   */
  async searchFAQs(req, res, next) {
    try {
      const { q: query, role, limit = 20 } = req.query;

      if (!query || query.trim() === '') {
        return res.status(400).json({
          error: 'Search query is required'
        });
      }

      // Sanitize search query using helper
      const sanitizedQuery = faqHelpers.sanitizeSearchQuery(query);

      if (sanitizedQuery === '') {
        return res.status(400).json({
          error: 'Invalid search query'
        });
      }

      // Get user info for analytics
      const userId = req.user?.sub || null;
      const userRole = req.user?.role || role || null;
      const sessionId = req.sessionID || null;
      const userAgent = req.get('User-Agent') || null;
      const ipAddress = req.ip || req.connection.remoteAddress || null;

      const result = await faqService.searchFAQs(
        sanitizedQuery,
        userRole,
        parseInt(limit),
        userId,
        sessionId,
        userAgent,
        ipAddress
      );

      res.json({
        success: true,
        message: 'Search completed successfully',
        data: result
      });
    } catch (error) {
      console.error('Error searching FAQs:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get single FAQ by slug
   * GET /api/faq/:slug
   */
  async getFAQBySlug(req, res, next) {
    try {
      const { slug } = req.params;

      // Get user info for analytics
      const userId = req.user?.sub || null;
      const userRole = req.user?.role || null;
      const sessionId = req.sessionID || null;
      const userAgent = req.get('User-Agent') || null;
      const ipAddress = req.ip || req.connection.remoteAddress || null;

      const faq = await faqService.getFAQBySlug(
        slug,
        userId,
        sessionId,
        userAgent,
        ipAddress,
        userRole
      );

      // Format FAQ for display using helper
      const formattedFAQ = faqHelpers.formatFAQForDisplay(faq);

      res.json({
        success: true,
        message: 'FAQ retrieved successfully',
        data: formattedFAQ
      });
    } catch (error) {
      console.error('Error getting FAQ by slug:', error);
      if (error.message === 'FAQ not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Vote on FAQ
   * POST /api/faq/:id/vote
   */
  async voteFAQ(req, res, next) {
    try {
      const { id } = req.params;
      const { voteType, feedback } = req.body;

      if (!['helpful', 'not_helpful'].includes(voteType)) {
        return res.status(400).json({
          error: 'Invalid vote type. Must be "helpful" or "not_helpful"'
        });
      }

      const userId = req.user?.sub || null;
      const userRole = req.user?.role || null;
      const userAgent = req.get('User-Agent') || null;
      const ipAddress = req.ip || req.connection.remoteAddress || null;

      const result = await faqVoteService.processFAQVote(
        id,
        voteType,
        userId,
        ipAddress,
        userRole,
        feedback,
        userAgent
      );

      res.json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error) {
      console.error('Error voting on FAQ:', error);
      if (error.message.includes('already voted')) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get categories
   * GET /api/faq/categories
   */
  async getCategories(req, res, next) {
    try {
      const { role } = req.query;

      const categories = role
        ? await faqService.getCategoriesByRole(role)
        : await faqService.getCategoriesByRole('all');

      res.json({
        success: true,
        message: 'Categories retrieved successfully',
        data: {
          categories,
          total: categories.length,
          role: role || 'all'
        }
      });
    } catch (error) {
      console.error('Error getting categories:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get popular FAQs
   * GET /api/faq/popular
   */
  async getPopularFAQs(req, res, next) {
    try {
      const { role, limit = 10 } = req.query;

      const faqs = await faqService.getPopularFAQs(role, parseInt(limit));

      // Format FAQs for display using helper
      const formattedFAQs = faqs.map(faq => faqHelpers.formatFAQForDisplay(faq));

      res.json({
        success: true,
        message: 'Popular FAQs retrieved successfully',
        data: {
          faqs: formattedFAQs,
          total: faqs.length,
          role: role || 'all'
        }
      });
    } catch (error) {
      console.error('Error getting popular FAQs:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get most viewed FAQs
   * GET /api/faq/most-viewed
   */
  async getMostViewedFAQs(req, res, next) {
    try {
      const { role, limit = 10 } = req.query;

      const faqs = await faqService.getMostViewedFAQs(role, parseInt(limit));

      // Format FAQs for display using helper
      const formattedFAQs = faqs.map(faq => faqHelpers.formatFAQForDisplay(faq));

      res.json({
        success: true,
        message: 'Most viewed FAQs retrieved successfully',
        data: {
          faqs: formattedFAQs,
          total: faqs.length,
          role: role || 'all'
        }
      });
    } catch (error) {
      console.error('Error getting most viewed FAQs:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  // =====================================================
  // ADMIN METHODS - UPDATED TO USE SEPARATED SERVICES
  // =====================================================

  /**
   * Get all FAQs (Admin)
   * GET /api/faq/admin/faqs
   */
  async getAllFAQs(req, res, next) {
    try {
      const {
        status,
        targetRole,
        isStatic,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        status,
        targetRole,
        isStatic: isStatic !== undefined ? isStatic === 'true' : undefined,
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const result = await faqAdminService.getAllFAQs(filters);

      res.json({
        success: true,
        message: 'All FAQs retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error getting all FAQs:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Create FAQ (Admin)
   * POST /api/faq/admin/faqs
   */
  async createFAQ(req, res, next) {
    try {
      const {
        title,
        content,
        targetRole,
        categoryId,
        status = 'draft',
        priority = 0,
        searchKeywords,
        relatedLinks,
        metadata
      } = req.body;

      // Validate FAQ data using helper
      const validation = faqHelpers.validateFAQData({
        title,
        content,
        targetRole,
        status
      });

      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
      }

      const createdBy = req.user.sub;

      // Auto-generate search keywords if not provided using helper
      const finalSearchKeywords = searchKeywords ||
        faqHelpers.extractKeywords(title, content);

      const faq = await faqAdminService.createFAQ({
        title: title.trim(),
        content: content.trim(),
        targetRole,
        categoryId,
        status,
        priority: parseInt(priority),
        searchKeywords: finalSearchKeywords,
        relatedLinks,
        metadata
      }, createdBy);

      res.status(201).json({
        success: true,
        message: 'FAQ created successfully',
        data: faq
      });
    } catch (error) {
      console.error('Error creating FAQ:', error);
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Update FAQ (Admin)
   * PUT /api/faq/admin/faqs/:id
   */
  async updateFAQ(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedBy = req.user.sub;

      // Validate FAQ data if being updated using helper
      if (updateData.title || updateData.content || updateData.targetRole || updateData.status) {
        const validation = faqHelpers.validateFAQData({
          title: updateData.title,
          content: updateData.content,
          targetRole: updateData.targetRole,
          status: updateData.status
        });

        if (!validation.isValid) {
          return res.status(400).json({
            error: 'Validation failed',
            details: validation.errors
          });
        }
      }

      // Auto-update search keywords if title or content changed using helper
      if ((updateData.title || updateData.content) && !updateData.searchKeywords) {
        updateData.searchKeywords = faqHelpers.extractKeywords(
          updateData.title || '',
          updateData.content || ''
        );
      }

      const faq = await faqAdminService.updateFAQ(id, updateData, updatedBy);

      res.json({
        success: true,
        message: 'FAQ updated successfully',
        data: faq
      });
    } catch (error) {
      console.error('Error updating FAQ:', error);
      if (error.message === 'FAQ not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Delete FAQ (Admin)
   * DELETE /api/faq/admin/faqs/:id
   */
  async deleteFAQ(req, res, next) {
    try {
      const { id } = req.params;

      await faqAdminService.deleteFAQ(id);

      res.json({
        success: true,
        message: 'FAQ deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      if (error.message === 'FAQ not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('Cannot delete static')) {
        return res.status(403).json({ error: error.message });
      }
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get FAQ analytics (Admin)
   * GET /api/faq/admin/analytics
   */
  async getFAQAnalytics(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      // Validate date range
      if (start && end && start > end) {
        return res.status(400).json({
          error: 'Start date cannot be after end date'
        });
      }

      const analytics = await faqAdminService.getFAQAnalytics(start, end);

      res.json({
        success: true,
        message: 'FAQ analytics retrieved successfully',
        data: analytics
      });
    } catch (error) {
      console.error('Error getting FAQ analytics:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Create category (Admin)
   * POST /api/faq/admin/categories
   */
  async createCategory(req, res, next) {
    try {
      const {
        name,
        description,
        icon,
        color,
        targetRole = 'general',
        sortOrder = 0,
        metadata
      } = req.body;

      // Validate category data using helper
      const validation = faqHelpers.validateCategoryData({
        name,
        targetRole
      });

      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
      }

      const category = await faqAdminService.createCategory({
        name: name.trim(),
        description,
        icon,
        color,
        targetRole,
        sortOrder: parseInt(sortOrder),
        metadata
      });

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: category
      });
    } catch (error) {
      console.error('Error creating category:', error);
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Update category (Admin)
   * PUT /api/faq/admin/categories/:id
   */
  async updateCategory(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Validate category data if being updated using helper
      if (updateData.name || updateData.targetRole) {
        const validation = faqHelpers.validateCategoryData({
          name: updateData.name,
          targetRole: updateData.targetRole
        });

        if (!validation.isValid) {
          return res.status(400).json({
            error: 'Validation failed',
            details: validation.errors
          });
        }
      }

      const category = await faqAdminService.updateCategory(id, updateData);

      res.json({
        success: true,
        message: 'Category updated successfully',
        data: category
      });
    } catch (error) {
      console.error('Error updating category:', error);
      if (error.message === 'Category not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Initialize static FAQs (Admin)
   * POST /api/faq/admin/initialize-static
   */
  async initializeStaticFAQs(req, res, next) {
    try {
      const result = await faqStaticInitService.initializeStaticFAQs();

      res.json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error) {
      console.error('Error initializing static FAQs:', error);
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }
}

module.exports = new FAQController();