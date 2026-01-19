// src/routes/mfa/mfaRoutes.js - NEW FILE
// =============================================================================
const router = require('express').Router();
const {
  setupMFA,
  enableMFA,
  disableMFA,
  getMFAStatus
} = require('../controllers/mfa/mfaController');
const { authenticateJWT } = require('../../../shared/middlewares/authMiddleware');

// All MFA routes require authentication
router.use(authenticateJWT);

// MFA management routes
router.get('/status', getMFAStatus);
router.post('/setup', setupMFA);
router.post('/enable', enableMFA);
router.post('/disable', disableMFA);

module.exports = router;
