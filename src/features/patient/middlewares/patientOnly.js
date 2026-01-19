// src/features/patient/middlewares/patientOnly.js
// Middleware to restrict access to patient role only

const { USER_ROLES } = require('../../../shared/utils/constants');

/**
 * Middleware to ensure only patients can access the route
 */
function patientOnly(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.user.role !== USER_ROLES.PATIENT) {
        return res.status(403).json({
            error: 'Access denied. Patient role required.',
            requiredRole: USER_ROLES.PATIENT,
            yourRole: req.user.role
        });
    }

    next();
}

module.exports = { patientOnly };
