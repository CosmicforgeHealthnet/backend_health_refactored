// src/features/auth/middlewares/authMiddleware.js
// JWT authentication and role authorization middleware

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment');
}

/**
 * Verify JWT and attach payload to req.user
 */
function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header missing or malformed' });
    }

    const token = authHeader.slice(7); // "Bearer ".length === 7

    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.user = payload; // contains sub, email, role, status, etc.
        req.user.id = payload.sub; // alias so controllers can use req.user.id
        next();
    });
}

/**
 * Restrict to one or more roles
 * @param  {...string} allowedRoles
 */
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

/**
 * Optional authentication - works with or without token
 * If token is present and valid, attaches user to req.user
 * If no token or invalid token, continues without req.user
 * Useful for public routes that behave differently for authenticated users
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    // No auth header - continue without user
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }

    const token = authHeader.slice(7);

    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) {
            // Invalid token - continue without user
            req.user = null;
        } else {
            // Valid token - attach user
            req.user = payload;
            req.user.id = payload.sub;
        }
        next();
    });
}

module.exports = { authenticateJWT, authorizeRoles, optionalAuth };
