const { Router } = require('express');
const { startSession, sendMessage, getMessages, closeSession } = require('../controllers/aiLiveSupportController');

const router = Router();

// POST /api/ai-support/sessions              — start or resume a support session
router.post('/sessions', startSession);

// POST /api/ai-support/sessions/:sessionId/messages  — send a message (AI responds or agent if joined)
router.post('/sessions/:sessionId/messages', sendMessage);

// GET  /api/ai-support/sessions/:sessionId/messages  — fetch full conversation history
router.get('/sessions/:sessionId/messages', getMessages);

// PATCH /api/ai-support/sessions/:sessionId/close    — user closes the session
router.patch('/sessions/:sessionId/close', closeSession);

module.exports = router;
