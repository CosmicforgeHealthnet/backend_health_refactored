// src/routes/faqRoutes.js
const router = require("express").Router();
const { authenticateJWT, authorizeRoles } = require("../../../shared/middlewares/authMiddleware");
const {
  getPatientFAQs,
  getDoctorFAQs,
  getGeneralFAQs,
  searchFAQs,
  getFAQBySlug,
  voteFAQ,
  getCategories,
  getPopularFAQs,
  getMostViewedFAQs,
  getAllFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getFAQAnalytics,
  createCategory,
  updateCategory,
  initializeStaticFAQs
} = require("../controllers/faqController");

// =====================================================
// PUBLIC ROUTES (No authentication required)
// =====================================================

// General FAQ routes - accessible to everyone
router.get("/general", getGeneralFAQs);
router.get("/categories", getCategories);
router.get("/popular", getPopularFAQs);
router.get("/most-viewed", getMostViewedFAQs);
router.get("/search", searchFAQs);

// =====================================================
// AUTHENTICATED USER ROUTES
// =====================================================

// Apply authentication for protected routes
router.use(authenticateJWT);

// Vote on FAQs (authenticated users only)
router.post("/:id/vote", voteFAQ)

// =====================================================
// ROLE-SPECIFIC ROUTES
// =====================================================

// Patient-specific FAQs (MOVED ABOVE /:slug TO AVOID CONFLICTS)
router.get("/patient", authorizeRoles('patient'), getPatientFAQs);

// Doctor-specific FAQs (MOVED ABOVE /:slug TO AVOID CONFLICTS)
router.get("/doctor", authorizeRoles('doctor'), getDoctorFAQs);

// =====================================================
// ADMIN ROUTES
// =====================================================

// Admin FAQ management
router.get("/admin/faqs",
  authorizeRoles('admin', 'super_admin'),
  getAllFAQs
);

router.post("/admin/faqs",
  authorizeRoles('admin', 'super_admin'),
  createFAQ
);

router.put("/admin/faqs/:id",
  authorizeRoles('admin', 'super_admin'),
  updateFAQ
);

router.delete("/admin/faqs/:id",
  authorizeRoles('admin', 'super_admin'),
  deleteFAQ
);

// Admin analytics
router.get("/admin/analytics",
  authorizeRoles('admin', 'super_admin'),
  getFAQAnalytics
);

// Admin category management
router.post("/admin/categories",
  authorizeRoles('admin', 'super_admin'),
  createCategory
);

router.put("/admin/categories/:id",
  authorizeRoles('admin', 'super_admin'),
  updateCategory
);

// Initialize static FAQs (one-time setup)
router.post("/admin/initialize-static",
  authorizeRoles('super_admin'),
  initializeStaticFAQs
);

// =====================================================
// DYNAMIC SLUG ROUTE (MUST BE LAST!)
// =====================================================

// Get single FAQ by slug - MOVED TO END TO AVOID ROUTE CONFLICTS
router.get("/:slug", getFAQBySlug);

module.exports = router;