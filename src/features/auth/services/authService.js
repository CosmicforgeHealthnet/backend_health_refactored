// src/features/auth/services/authService.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const refreshTokenService = require('./refreshTokenService');
const { getSetting } = require('../../../shared/services/adminSettingsService');
const verificationRequestRepo = require('../../doctor/repositories/verificationRequestRepository');

const JWT_SECRET = process.env.JWT_SECRET;

// Converts { value, unit } from admin_settings to a jsonwebtoken expiresIn string.
// Falls back to `fallback` when the setting is missing or disabled.
function toJwtExpiry(setting, fallback) {
    if (!setting || setting.enabled === false) return fallback;
    const v = setting.value;
    const u = (setting.unit || '').toLowerCase();
    if (!v) return fallback;
    if (u === 'minutes' || u === 'minute') return `${v}m`;
    if (u === 'hours'   || u === 'hour')   return `${v}h`;
    if (u === 'days'    || u === 'day')     return `${v}d`;
    return fallback;
}

// Converts { value, unit } to milliseconds for date arithmetic.
function toMs(setting, fallbackMs) {
    if (!setting || setting.enabled === false) return fallbackMs;
    const v = setting.value;
    const u = (setting.unit || '').toLowerCase();
    if (!v) return fallbackMs;
    if (u === 'minutes' || u === 'minute') return v * 60 * 1000;
    if (u === 'hours'   || u === 'hour')   return v * 60 * 60 * 1000;
    if (u === 'days'    || u === 'day')     return v * 24 * 60 * 60 * 1000;
    return fallbackMs;
}

class AuthService {

    async register({ email, password, fullName, role, phoneNumber = null, departmentSpecialty = null, country = null }) {
        if (await userRepository.findByEmailAndRole(email, role)) {
            throw new Error('Email already in use');
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const user = userRepository.create({
            email,
            fullName,
            passwordHash,
            role,
            phoneNumber,
            departmentSpecialty,
            country,
            status: 'pending_email_verification',
        });
        return userRepository.save(user);
    }

    /**
     * Authenticate and issue tokens (access + rotating refresh).
     * Enforces max_login_attempts and lock_duration from admin_settings.
     */
    async login({ email, password, role }, deviceFingerprint, userAgent) {
        // Read security settings (with sensible defaults)
        const [maxAttemptsSetting, lockDurationSetting, tokenExpirySetting] = await Promise.all([
            getSetting('security', 'max_login_attempts',  { enabled: true, value: 5 }),
            getSetting('security', 'lock_duration',       { enabled: true, value: 30, unit: 'Minutes' }),
            getSetting('security', 'token_expiry',        { enabled: true, value: 1,  unit: 'Hours' }),
        ]);

        const MAX_ATTEMPTS  = (maxAttemptsSetting?.enabled !== false) ? (maxAttemptsSetting?.value ?? 5) : 5;
        const LOCK_MS       = toMs(lockDurationSetting, 30 * 60 * 1000);
        const ACCESS_EXPIRES = toJwtExpiry(tokenExpirySetting, '1h');

        // 1) Lookup user
        const user = role
            ? await userRepository.findByEmailAndRole(email, role)
            : await userRepository.findByEmail(email);
        if (!user || !user.passwordHash) {
            throw new Error('Invalid credentials');
        }

        // 2) Check if account is temporarily locked
        if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
            const remaining = Math.ceil((new Date(user.lockedUntil) - Date.now()) / 60000);
            throw Object.assign(new Error(`Account locked. Try again in ${remaining} minute(s).`), { status: 423 });
        }

        // 3) Verify password
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            const attempts = (user.loginAttempts || 0) + 1;
            const update = { loginAttempts: attempts };

            if (attempts >= MAX_ATTEMPTS) {
                update.lockedUntil = new Date(Date.now() + LOCK_MS);
                update.status = 'locked';
                await userRepository.save({ ...user, ...update });
                throw Object.assign(
                    new Error(`Too many failed attempts. Account locked for ${Math.ceil(LOCK_MS / 60000)} minute(s).`),
                    { status: 423 }
                );
            }

            await userRepository.save({ ...user, ...update });
            throw new Error('Invalid credentials');
        }

        // 4) Successful login — reset attempt counter and unlock
        if (user.loginAttempts > 0 || user.lockedUntil) {
            await userRepository.save({
                ...user,
                loginAttempts: 0,
                lockedUntil: null,
                // only restore 'active'-family statuses; leave other statuses untouched
                status: user.status === 'locked' ? 'active' : user.status,
            });
        }

        // 5) Prepare JWT payload
        // Doctors who never called /verification/submit have zero verification_requests
        // rows and are invisible to the admin queue — flag it so the frontend can
        // route them back to the submit step.
        const verificationRequired = user.role === 'doctor'
            ? !(await verificationRequestRepo.existsForDoctor(user.id))
            : false;

        const payload = {
            sub: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            status: user.status === 'locked' ? 'active' : user.status,
            provider: user.provider,
            providerId: user.providerId,
            profileImageUrl: user.profileImageUrl,
            phoneNumber: user.phoneNumber,
            departmentSpecialty: user.departmentSpecialty,
            bannerUrl: user.bannerUrl,
            mfaEnabled: user.mfaEnabled,
            verificationRequired,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };

        // 6) Sign access token using admin-configured expiry
        const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });

        // 7) Issue rotating refresh token (expiry read inside refreshTokenService)
        const refreshToken = await refreshTokenService.issueRefreshToken(user, deviceFingerprint, userAgent);

        return { payload, accessToken, refreshToken };
    }
}

module.exports = new AuthService();
