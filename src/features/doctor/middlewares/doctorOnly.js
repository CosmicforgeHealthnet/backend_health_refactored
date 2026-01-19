// src/features/doctor/middlewares/doctorOnly.js
// Middleware to restrict access to doctor role only

const { USER_ROLES } = require('../../../shared/utils/constants');

/**
 * Middleware to ensure only doctors can access the route
 */
function doctorOnly(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.user.role !== USER_ROLES.DOCTOR) {
        return res.status(403).json({
            error: 'Access denied. Doctor role required.',
            requiredRole: USER_ROLES.DOCTOR,
            yourRole: req.user.role
        });
    }

    next();
}

module.exports = { doctorOnly };
