const { Router } = require('express');
const { authorizeRoles } = require('../../auth/middlewares/authMiddleware');
const { USER_ROLES } = require('../../../shared/utils/constants');
const {
  getQueue,
  claimSession,
  sendAgentMessage,
  getSessionMessages,
  closeSession
} = require('../controllers/aiSupportAdminController');

const router = Router();
const adminOnly = authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN);

// GET  /api/admin/ai-support/queue                        — all escalated sessions waiting for an agent
router.get('/queue', adminOnly, getQueue);

// PATCH /api/admin/ai-support/sessions/:sessionId/claim   — agent claims a session
router.patch('/sessions/:sessionId/claim', adminOnly, claimSession);

// POST  /api/admin/ai-support/sessions/:sessionId/messages — agent sends a message to the user
router.post('/sessions/:sessionId/messages', adminOnly, sendAgentMessage);

// GET   /api/admin/ai-support/sessions/:sessionId/messages — read full conversation history
router.get('/sessions/:sessionId/messages', adminOnly, getSessionMessages);

// PATCH /api/admin/ai-support/sessions/:sessionId/close   — agent closes the session
router.patch('/sessions/:sessionId/close', adminOnly, closeSession);

module.exports = router;
