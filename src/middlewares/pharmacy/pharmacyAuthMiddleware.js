// src/middlewares/pharmacy/pharmacyAuthMiddleware.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function authenticatePharmacyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  const token = authHeader.slice(7);

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Check if user has pharmacy role
    if (payload.role !== 'pharmacy') {
      return res.status(403).json({ error: 'Access denied: Pharmacy access required' });
    }
    
    req.user = payload;
    next();
  });
}

function requirePharmacyVerification(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // You can add additional verification status checks here
  // For now, we'll allow all pharmacy users
  next();
}

module.exports = { 
  authenticatePharmacyJWT,
  requirePharmacyVerification
};