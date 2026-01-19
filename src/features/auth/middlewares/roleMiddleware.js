// src/features/auth/middlewares/roleMiddleware.js
// Role-specific middleware for restricting access

const { USER_ROLES } = require('../../../shared/utils/constants');

/**
 * Middleware to restrict access to patients only
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

/**
 * Middleware to restrict access to doctors only
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

/**
 * Middleware to restrict access to admin roles only
 */
function adminOnly(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const adminRoles = [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN];
    if (!adminRoles.includes(req.user.role)) {
        return res.status(403).json({
            error: 'Access denied. Admin role required.',
            requiredRoles: adminRoles,
            yourRole: req.user.role
        });
    }
    next();
}

/**
 * Middleware to restrict access to pharmacy roles
 */
function pharmacyOnly(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const pharmacyRoles = [
        USER_ROLES.PHARMACY,
        USER_ROLES.PHARMACIST,
        USER_ROLES.PHARMACY_MANAGER,
        USER_ROLES.PHARMACY_ADMIN
    ];
    if (!pharmacyRoles.includes(req.user.role)) {
        return res.status(403).json({
            error: 'Access denied. Pharmacy role required.',
            requiredRoles: pharmacyRoles,
            yourRole: req.user.role
        });
    }
    next();
}

/**
 * Middleware to restrict access to lab roles
 */
function labOnly(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const labRoles = [
        USER_ROLES.LAB,
        USER_ROLES.LAB_ADMIN,
        USER_ROLES.LAB_MANAGER,
        USER_ROLES.LAB_TECHNICIAN,
        USER_ROLES.SAMPLE_COLLECTOR,
        USER_ROLES.RADIOLOGIST,
        USER_ROLES.RESULT_REVIEWER
    ];
    if (!labRoles.includes(req.user.role)) {
        return res.status(403).json({
            error: 'Access denied. Lab role required.',
            requiredRoles: labRoles,
            yourRole: req.user.role
        });
    }
    next();
}

module.exports = {
    patientOnly,
    doctorOnly,
    adminOnly,
    pharmacyOnly,
    labOnly
};
