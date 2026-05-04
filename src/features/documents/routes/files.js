const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { authenticateJWT } = require('../../../shared/middlewares/authMiddleware');
const fileController = require('../controllers/fileController');

// Accepts JWT from Authorization header OR ?token= query param.
// Used only for file viewing so direct browser URLs work.
function authenticateJWTFlexible(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;

  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = payload;
    next();
  });
}

// Mutating routes require proper Authorization header
router.post('/', authenticateJWT, fileController.uploadFile);
router.get('/', authenticateJWT, fileController.listFiles);
router.patch('/:id', authenticateJWT, fileController.updateFile);
router.delete('/:id', authenticateJWT, fileController.deleteFile);

// View route accepts token from header OR query param
router.get('/:id', authenticateJWTFlexible, fileController.getFile);

module.exports = router;
