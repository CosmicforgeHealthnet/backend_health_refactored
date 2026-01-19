// src/features/auth/entities/index.js
// Export all auth-related entities

const User = require('./User');
const RefreshToken = require('./RefreshToken');
const EmailVerification = require('./EmailVerification');

module.exports = {
    User,
    RefreshToken,
    EmailVerification,
    MagicLinkToken: require('./MagicLinkToken'),
    PasswordResetToken: require('./PasswordResetToken'),
    AuthEvent: require('./AuthEvent'),
    UserReferral: require('./UserReferral'),
    ReferralDraw: require('./ReferralDraw'),
    ReferralDrawStats: require('./ReferralDrawStats'),

    // Re-export enums from User entity for convenience
    Status: User.Status,
    Provider: User.Provider,
    UserTier: User.UserTier
};
