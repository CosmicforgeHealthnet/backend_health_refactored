const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const logger = require('../../../config/logger');
const { authenticateJWT, authorizeRoles } = require('../../auth/middlewares/authMiddleware');

router.use(authenticateJWT);
router.use(authorizeRoles('admin', 'super_admin'));

const logDir = logger.logDir;

const LOG_FILES = {
  app: 'app.log',
  error: 'error.log',
};

/**
 * GET /api/admin/logs
 * Returns the last N lines of a log file.
 * Query params:
 *   type  — "app" (default) or "error"
 *   lines — number of lines to return (default 200, max 2000)
 *   search — optional string to filter lines
 */
router.get('/', async (req, res) => {
  try {
    const type = LOG_FILES[req.query.type] ? req.query.type : 'app';
    const lineCount = Math.min(parseInt(req.query.lines) || 200, 2000);
    const search = req.query.search ? req.query.search.toLowerCase() : null;

    const filePath = path.join(logDir, LOG_FILES[type]);

    if (!fs.existsSync(filePath)) {
      return res.json({ success: true, lines: [], message: 'Log file is empty or does not exist yet.' });
    }

    const lines = await tailFile(filePath, lineCount, search);

    res.json({
      success: true,
      type,
      file: LOG_FILES[type],
      returned: lines.length,
      lines,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/logs/download
 * Download the full log file.
 */
router.get('/download', (req, res) => {
  const type = LOG_FILES[req.query.type] ? req.query.type : 'app';
  const filePath = path.join(logDir, LOG_FILES[type]);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Log file not found.' });
  }

  res.download(filePath, LOG_FILES[type]);
});

/**
 * DELETE /api/admin/logs/clear
 * Clears a log file (truncates it). Super admin only.
 */
router.delete('/clear', authorizeRoles('super_admin'), (req, res) => {
  const type = LOG_FILES[req.query.type] ? req.query.type : 'app';
  const filePath = path.join(logDir, LOG_FILES[type]);

  fs.writeFileSync(filePath, '');
  logger.info(`Log file "${LOG_FILES[type]}" cleared by user ${req.user.sub}`);

  res.json({ success: true, message: `${LOG_FILES[type]} cleared.` });
});

// Read last N lines of a file efficiently
function tailFile(filePath, n, search = null) {
  return new Promise((resolve, reject) => {
    const results = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!search || line.toLowerCase().includes(search)) {
        results.push(line);
        if (results.length > n) results.shift(); // Keep only last N
      }
    });

    rl.on('close', () => resolve(results));
    rl.on('error', reject);
  });
}

module.exports = router;
