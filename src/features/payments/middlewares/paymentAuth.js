// ================================
// 4. PAYMENT AUTH MIDDLEWARE
// ================================

// src/middlewares/paymentAuth.js
const userRepository = require('../../auth/repositories/userRepository');

class PaymentAuthMiddleware {
  /**
   * Fresh DB read of the requesting user, attached as req.fullUser.
   *
   * Must run after authenticateJWT (relies on req.user.sub). Exists because
   * req.user.status is a snapshot baked into the JWT at login/refresh time —
   * up to ACCESS_EXPIRES old — so a doctor whose verification status just
   * changed (e.g. admin approval, or a status-consistency fix) would
   * otherwise be denied/allowed wallet access based on stale data until
   * their token happened to refresh. requireVerifiedDoctor/requireActivePatient
   * already prefer req.fullUser over req.user when it's present.
   */
  static async verifyPaymentAuth(req, res, next) {
    try {
      const user = await userRepository.findById(req.user.sub);

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (user.status === 'locked') {
        return res.status(403).json({ error: 'Account is locked. Contact support.' });
      }

      req.fullUser = user;
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Authentication error' });
    }
  }

  /**
   * Check ownership or admin access
   */
  static requireOwnershipOrAdmin(resourceField = 'userId') {
    return (req, res, next) => {
      const resourceUserId = req.params[resourceField] || req.body[resourceField];

      if (req.user.sub !== resourceUserId && !['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied. You can only access your own resources.' });
      }
      next();
    };
  }

  /**
   * Verify patient can make payments
   */
  static requireActivePatient(req, res, next) {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can make payments' });
    }

    if (!['active', 'pending_email_verification'].includes(req.user.status)) {
      return res.status(403).json({ error: 'Account must be active to make payments' });
    }

    next();
  }

  /**
   * Verify doctor can receive payments
   */
  static requireVerifiedDoctor(req, res, next) {
    // Use fullUser if available (populated by verifyPaymentAuth), otherwise user from token
    const userRole = req.fullUser ? req.fullUser.role : req.user.role;
    const userStatus = req.fullUser ? req.fullUser.status : req.user.status;

    if (userRole !== 'doctor') {
      return res.status(403).json({ error: 'Only doctors can access wallet features' });
    }

    // Allow both 'doctor_active' and 'active' as valid verified statuses
    if (!['doctor_active', 'active'].includes(userStatus)) {
      return res.status(403).json({
        error: 'Doctor account must be verified to access wallet',
        currentStatus: userStatus
      });
    }

    next();
  }

}

module.exports = PaymentAuthMiddleware;
