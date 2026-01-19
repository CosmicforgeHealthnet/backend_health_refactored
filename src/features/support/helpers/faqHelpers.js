// src/helpers/faqHelpers.js
class FAQHelpers {

  /**
   * Generate slug from title
   */
  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }

  /**
   * Group FAQs by category
   */
  groupFAQsByCategory(faqs) {
    const grouped = {};
    
    faqs.forEach(faq => {
      const categoryName = faq.category?.name || 'General';
      const categorySlug = faq.category?.slug || 'general';
      
      if (!grouped[categorySlug]) {
        grouped[categorySlug] = {
          category: {
            name: categoryName,
            slug: categorySlug,
            icon: faq.category?.icon,
            color: faq.category?.color,
          },
          faqs: []
        };
      }
      
      grouped[categorySlug].faqs.push(faq);
    });

    return grouped;
  }

  /**
   * Validate FAQ data
   */
  validateFAQData(faqData) {
    const errors = [];

    if (!faqData.title || faqData.title.trim() === '') {
      errors.push('Title is required');
    }

    if (!faqData.content || faqData.content.trim() === '') {
      errors.push('Content is required');
    }

    if (faqData.title && faqData.title.length > 500) {
      errors.push('Title must be 500 characters or less');
    }

    if (!['patient', 'doctor', 'general', 'all'].includes(faqData.targetRole)) {
      errors.push('Invalid target role');
    }

    if (!['draft', 'published', 'archived'].includes(faqData.status)) {
      errors.push('Invalid status');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate category data
   */
  validateCategoryData(categoryData) {
    const errors = [];

    if (!categoryData.name || categoryData.name.trim() === '') {
      errors.push('Category name is required');
    }

    if (categoryData.name && categoryData.name.length > 200) {
      errors.push('Category name must be 200 characters or less');
    }

    if (!['patient', 'doctor', 'general', 'all'].includes(categoryData.targetRole)) {
      errors.push('Invalid target role');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate FAQ popularity score
   */
  calculatePopularityScore(faq) {
    const { viewCount = 0, helpfulVotes = 0, notHelpfulVotes = 0 } = faq;
    const totalVotes = helpfulVotes + notHelpfulVotes;
    
    if (totalVotes === 0) {
      return viewCount * 0.1; // Base score from views only
    }
    
    const helpfulnessRatio = helpfulVotes / totalVotes;
    const engagementScore = totalVotes * 0.5;
    const viewScore = viewCount * 0.1;
    
    return (helpfulnessRatio * 10) + engagementScore + viewScore;
  }

  /**
   * Extract keywords from FAQ content
   */
  extractKeywords(title, content) {
    const text = `${title} ${content}`.toLowerCase();
    
    // Remove common words and extract meaningful keywords
    const stopWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    ];
    
    const words = text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates
    
    return words.slice(0, 20).join(' '); // Return top 20 unique keywords
  }

  /**
   * Format FAQ for display
   */
  formatFAQForDisplay(faq) {
    return {
      id: faq.id,
      title: faq.title,
      content: faq.content,
      slug: faq.slug,
      targetRole: faq.targetRole,
      category: faq.category ? {
        name: faq.category.name,
        slug: faq.category.slug,
        icon: faq.category.icon,
        color: faq.category.color
      } : null,
      viewCount: faq.viewCount || 0,
      helpfulVotes: faq.helpfulVotes || 0,
      notHelpfulVotes: faq.notHelpfulVotes || 0,
      popularityScore: this.calculatePopularityScore(faq),
      relatedLinks: faq.relatedLinks || [],
      createdAt: faq.createdAt,
      updatedAt: faq.updatedAt,
      publishedAt: faq.publishedAt
    };
  }

  /**
   * Sanitize search query
   */
  sanitizeSearchQuery(query) {
    if (!query || typeof query !== 'string') {
      return '';
    }
    
    return query
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/[^\w\s-]/g, ' ') // Replace special chars with space
      .replace(/\s+/g, ' ') // Normalize spaces
      .slice(0, 100); // Limit length
  }
}

module.exports = new FAQHelpers();
