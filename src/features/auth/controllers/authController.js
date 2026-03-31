// src/features/auth/controllers/authController.js
// Auth Controller - Feature based
const authService = require("../services/authService");
const referralService = require("../services/referralService"); // Internal to auth feature now
const emailVerRepo = require("../repositories/emailVerificationRepository");
const userRepo = require("../repositories/userRepository");
const passwordResetRepository = require("../repositories/passwordResetRepository");

// Feature-internal services
const passwordResetService = require("../services/passwordResetService");
const verificationService = require("../services/verificationService");
const magicLinkService = require("../services/magicLinkService");
const googleAuthService = require("../services/googleAuthService");
const refreshTokenService = require("../services/refreshTokenService");
const mfaService = require('../services/mfa/mfaService');

// ADD THIS: Country restriction for patients only
const ALLOWED_PATIENT_COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'South Africa'];

const validatePatientCountry = (req, role) => {
    if (role !== 'patient') {
        return { allowed: true };
    }

    const userCountry = req.location?.country;

    if (!userCountry || userCountry === 'Unknown') {
        return { allowed: true, country: 'Unknown' };
    }

    const allowed = ALLOWED_PATIENT_COUNTRIES.includes(userCountry);

    return {
        allowed,
        country: userCountry,
        allowedCountries: ALLOWED_PATIENT_COUNTRIES
    };
};

// signup
exports.signup = async (req, res, next) => {
    try {
        const { fullName, email, password, role, phoneNumber, departmentSpecialty } = req.body;
        if (!fullName || !email || !password) {
            return res
                .status(400)
                .json({ error: "fullName, email and password are required" });
        }

        // ADD THIS: Country validation for patients
        const countryValidation = validatePatientCountry(req, role);
        if (!countryValidation.allowed) {
            return res.status(403).json({
                error: `Patient registration is currently only available in: ${countryValidation.allowedCountries.join(', ')}. Your location: ${countryValidation.country}`,
                code: 'COUNTRY_RESTRICTED',
                userCountry: countryValidation.country,
                allowedCountries: countryValidation.allowedCountries
            });
        }

        // Add the validation here:
        if (role === 'doctor' && phoneNumber) {
            // Optional: validate phone number format
            // Example: basic validation
            // const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
            // Country code (1-4 digits) + phone number (max 15 digits total per ITU-T E.164)
            const phoneRegex = /^\+[1-9]\d{0,3}\d{4,11}$/;
            if (!phoneRegex.test(phoneNumber)) {
                return res.status(400).json({
                    error: "Invalid phone number format. Use +countrycode followed by digits (max 15 digits total)"
                });
            }
        }

        // 1) Create the user unconditionally
        const user = await authService.register({
            fullName,
            email,
            password,
            phoneNumber,
            departmentSpecialty,
            role,
            country: countryValidation.country, // ADD THIS: Pass country to service
        });

        // 2) Attempt to send verification email, but don't let it block user creation
        let emailSent = true;
        try {
            await verificationService.sendEmailVerification(user);
        } catch (mailErr) {
            console.error("💥 Email send failed:", mailErr);
            emailSent = false;
        }

        //create referral
        await referralService.createUserReferralCode(user.id);
        const { ref } = req.query;
        console.log(req.query);
        if (ref) {
            const referral = await referralService.processReferral(user.id, ref);
            console.log(referral);
            if (referral)
                await referralService.verifyReferral(referral.referredUserId);
        }

        return res.status(201).json({
            message: emailSent
                ? "Account created successfully; check your email for a verification link."
                : "Account created, but we couldn't send a verification email. Please retry from your profile.",
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                status: user.status
            },
        });
    } catch (err) {
        if (err.message == "Email already in use") {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

// signup-otp (for mobile)
exports.signupOtp = async (req, res, next) => {
    try {
        const { fullName, email, password, role, phoneNumber, departmentSpecialty } = req.body;
        if (!fullName || !email || !password) {
            return res
                .status(400)
                .json({ error: "fullName, email and password are required" });
        }

        const countryValidation = validatePatientCountry(req, role);
        if (!countryValidation.allowed) {
            return res.status(403).json({
                error: `Patient registration is currently only available in: ${countryValidation.allowedCountries.join(', ')}. Your location: ${countryValidation.country}`,
                code: 'COUNTRY_RESTRICTED',
                userCountry: countryValidation.country,
                allowedCountries: countryValidation.allowedCountries
            });
        }

        if (role === 'doctor' && phoneNumber) {
            const phoneRegex = /^\+[1-9]\d{0,3}\d{4,11}$/;
            if (!phoneRegex.test(phoneNumber)) {
                return res.status(400).json({
                    error: "Invalid phone number format. Use +countrycode followed by digits (max 15 digits total)"
                });
            }
        }

        const user = await authService.register({
            fullName,
            email,
            password,
            phoneNumber,
            departmentSpecialty,
            role,
            country: countryValidation.country,
        });

        let emailSent = true;
        let debugOtp = null;
        try {
            debugOtp = await verificationService.sendEmailVerificationOtp(user);
        } catch (mailErr) {
            console.error("💥 OTP Email send failed:", mailErr.message);
            console.error("💥 SMTP config:", {
                host: process.env.CPANEL_EMAIL_HOST,
                port: process.env.CPANEL_EMAIL_PORT,
                user: process.env.CPANEL_EMAIL_USER,
                from: process.env.CPANEL_EMAIL_FROM,
            });
            emailSent = false;
        }

        await referralService.createUserReferralCode(user.id);
        const { ref } = req.query;
        if (ref) {
            const referral = await referralService.processReferral(user.id, ref);
            if (referral)
                await referralService.verifyReferral(referral.referredUserId);
        }

        const responseBody = {
            message: emailSent
                ? "Account created successfully; check your email for a 6-digit verification code."
                : "Account created, but we couldn't send the verification code. Please retry from your profile.",
            emailSent,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                status: user.status
            },
        };

        // In non-production, expose the OTP so it can be used in Postman without needing the email
        if (process.env.NODE_ENV !== "production" && debugOtp) {
            responseBody.debugOtp = debugOtp;
        }

        return res.status(201).json(responseBody);
    } catch (err) {
        if (err.message == "Email already in use") {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

// login
exports.login = async (req, res, next) => {
    const { email, password, mfaToken, deviceFingerprint } = req.body;
    const userAgent = req.headers["user-agent"];

    try {
        console.log(email, password, deviceFingerprint);
        // 1) Validate inputs
        if (!email || !password || !deviceFingerprint) {
            return res.status(400).json({
                error: "Email, password, and device fingerprint are required",
            });
        }

        // 2) Lookup user
        const user = await userRepo.findByEmail(email);
        if (!user) {
            return res
                .status(401)
                .json({ error: "The email address you entered is not registered." });
        }

        // 3) Guard against non-local accounts
        if (!user.passwordHash) {
            return res.status(401).json({
                error:
                    "This account has no local password. Please log in with Google or your magic link.",
            });
        }

        // 4) Auth (Service handles password comparison)

        // 5) MFA CHECK - NEW LOGIC
        if (user.mfaEnabled) {
            if (!mfaToken) {
                // Password correct but need MFA token
                return res.status(206).json({
                    requiresMFA: true,
                    message: "Please enter your two-factor authentication code",
                    tempUserId: user.id // You might want to use a temporary token instead
                });
            }

            // Verify MFA token

            const mfaValid = mfaService.verifyToken(user.mfaSecret, mfaToken);
            if (!mfaValid) {
                return res.status(401).json({
                    error: "Invalid two-factor authentication code"
                });
            }
        }

        // 6) Issue tokens (original logic)
        const tokens = await authService.login(
            { email, password },
            deviceFingerprint,
            userAgent
        );


        return res.json(tokens);
    } catch (err) {
        next(err);
    }
};

// logout
exports.logout = async (req, res, next) => {
    try {
        const { refreshToken, deviceFingerprint } = req.body;
        if (refreshToken && deviceFingerprint) {
            await refreshTokenService.revokeToken(refreshToken, deviceFingerprint);
        }
        res.json({ message: "Logged out successfully" });
    } catch (err) {
        next(err);
    }
};

// Redirect to Google consent screen
exports.googleAuth = (req, res) => {
    const { role, deviceFingerprint, platform } = req.query;
    if (!role || !deviceFingerprint) {
        return res
            .status(400)
            .json({ error: "Both `role` and `deviceFingerprint` are required" });
    }

    // Encode role + fingerprint (+ platform for redirect) into state
    const stateObj = { role, deviceFingerprint, platform };
    const state = Buffer.from(JSON.stringify(stateObj)).toString("base64");

    const url = googleAuthService.getAuthUrl(state);

    if (platform === 'mobile') {
        return res.redirect(url);
    }

    res.json({ url });
};

// OAuth2 callback
exports.googleCallback = async (req, res, next) => {
    try {
        const { code, state } = req.query;
        console.log('Generated state:', state);
        if (!code || !state) {
            return res
                .status(400)
                .json({ error: "Authorization code and state are required." });
        }

        // Decode state back into your role+fingerprint
        let stateObj;
        try {
            stateObj = JSON.parse(Buffer.from(state, "base64").toString());
        } catch {
            return res.status(400).json({ error: "Invalid state parameter." });
        }

        const { role, deviceFingerprint } = stateObj;
        if (!deviceFingerprint) {
            return res
                .status(400)
                .json({ error: "deviceFingerprint missing in state." });
        }

        // ADD THIS: Country validation for Google OAuth patients
        const countryValidation = validatePatientCountry(req, role);
        if (!countryValidation.allowed) {
            return res.status(403).json({
                error: `Patient registration is currently only available in: ${countryValidation.allowedCountries.join(', ')}. Your location: ${countryValidation.country}`,
                code: 'COUNTRY_RESTRICTED',
                userCountry: countryValidation.country,
                allowedCountries: countryValidation.allowedCountries
            });
        }

        const userAgent = req.headers["user-agent"] || "";
        const { jwtPayload, accessToken, refreshToken } =
            await googleAuthService.handleCallback(
                code,
                deviceFingerprint,
                userAgent,
                role
            );

        if (stateObj.platform === 'mobile') {
            // Redirect to mobile app deep link
            const encodedUser = encodeURIComponent(JSON.stringify(jwtPayload));
            const redirectUrl = `cosmicforge://auth-callback?accessToken=${accessToken}&refreshToken=${refreshToken}&user=${encodedUser}`;
            return res.redirect(redirectUrl);
        }

        return res.json({ jwtPayload, accessToken, refreshToken });
    } catch (err) {
        next(err);
    }
};

// Google Mobile Login (ID Token verification)
exports.googleMobileLogin = async (req, res, next) => {
    try {
        const { idToken, deviceFingerprint, role } = req.body;
        if (!idToken || !deviceFingerprint) {
            return res.status(400).json({ error: "idToken and deviceFingerprint are required" });
        }

        // ADD THIS: Country validation for patients
        const countryValidation = validatePatientCountry(req, role);
        if (!countryValidation.allowed) {
            return res.status(403).json({
                error: `Patient registration is currently only available in: ${countryValidation.allowedCountries.join(', ')}. Your location: ${countryValidation.country}`,
                code: 'COUNTRY_RESTRICTED',
                userCountry: countryValidation.country,
                allowedCountries: countryValidation.allowedCountries
            });
        }

        const userAgent = req.headers["user-agent"] || "";
        const result = await googleAuthService.verifyMobileIdToken(
            idToken,
            deviceFingerprint,
            userAgent,
            role || 'patient'
        );

        return res.json(result);
    } catch (err) {
        next(err);
    }
};

// refresh token!!!!
exports.refresh = async (req, res) => {
    try {
        const { refreshToken, deviceFingerprint } = req.body;
        if (!refreshToken || !deviceFingerprint) {
            return res
                .status(400)
                .json({ error: "refreshToken and deviceFingerprint are required" });
        }

        const tokens = await refreshTokenService.rotateRefreshToken(
            refreshToken,
            deviceFingerprint,
            req.headers["user-agent"]
        );
        res.json(tokens);
    } catch (err) {
        // Wrap into friendly JSON
        const msg =
            err.message === "Invalid or expired refresh token"
                ? "Your session has expired. Please sign in again."
                : err.message;
        res.status(401).json({ error: msg });
    }
};

// verify email
exports.verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.query;
        const ev = await emailVerRepo.findByToken(token);
        if (!ev) {
            return res.status(400).json({ error: "Invalid token" });
        }

        const user = await userRepo.findById(ev.user.id);
        // If they already verified, treat as success
        if (user.status === "active" || user.status === "doctor_active") {
            return res.json({ message: "Email already verified." });
        }

        // Now check expiration
        if (ev.expiresAt < new Date()) {
            return res.status(400).json({ error: "Expired token" });
        }

        // Mark token used and activate user
        ev.usedAt = new Date();
        await emailVerRepo.save(ev);

        user.status =
            user.role === "doctor" ? "pending_doctor_verification" : "active";
        await userRepo.save(user);

        res.json({ message: "Email verified! You may now log in." });
    } catch (err) {
        next(err);
    }
};

exports.resendVerification = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        // Note: verificationService is now local
        await verificationService.resendVerificationEmail(email);

        // Always 200 to avoid leaking which emails exist
        res.json({ message: "If unverified, a new link has been emailed." });
    } catch (err) {
        next(err);
    }
};

// request password reset (always link-based)
exports.requestPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        await passwordResetService.requestReset(email);

        // Always return 200 to avoid user enumeration
        res.json({ message: "If that email exists, a reset link has been sent." });
    } catch (err) {
        next(err);
    }
};

// reset password
exports.resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res
                .status(400)
                .json({ error: "Token and newPassword are required" });
        }

        await passwordResetService.resetPassword(token, newPassword);

        res.json({ message: "Password has been reset successfully." });
    } catch (err) {
        next(err);
    }
};

// resend password reset
exports.resendPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        await passwordResetService.resendResetEmail(email);
        res.json({ message: "If eligible, a new reset link has been sent." });
    } catch (err) {
        next(err);
    }
};

// --- OTP ENDPOINTS ---

exports.verifyEmailOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: "Email and OTP are required" });
        }

        const user = await userRepo.findByEmail(email);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const ev = await emailVerRepo.findByOtp(otp, user.id);
        if (!ev) {
            return res.status(400).json({ error: "Invalid OTP" });
        }

        if (ev.expiresAt < new Date()) {
            return res.status(400).json({ error: "OTP has expired" });
        }

        if (ev.usedAt) {
            return res.status(400).json({ error: "OTP has already been used" });
        }

        // Mark OTP used and activate user
        ev.usedAt = new Date();
        await emailVerRepo.save(ev);

        user.status = user.role === "doctor" ? "pending_doctor_verification" : "active";
        await userRepo.save(user);

        res.json({ message: "Email verified successfully!" });
    } catch (err) {
        next(err);
    }
};

exports.checkVerificationStatus = async (req, res, next) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const user = await userRepo.findByEmail(email);
        if (!user) return res.status(404).json({ error: "User not found" });

        const isVerified = user.status === "active" || user.status === "doctor_active" || user.status === "pending_doctor_verification";
        res.json({ verified: isVerified, status: user.status });
    } catch (err) {
        next(err);
    }
};

exports.requestPasswordResetOtp = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        await passwordResetService.requestResetOtp(email);
        res.json({ message: "If that email exists, a 6-digit code has been sent." });
    } catch (err) {
        next(err);
    }
};

exports.verifyPasswordResetOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: "Email and OTP are required" });
        }

        const user = await userRepo.findByEmail(email);
        if (!user) return res.status(404).json({ error: "User not found" });

        const record = await passwordResetRepository.findByOtp(otp, user.id);
        if (!record || record.usedAt || record.expiresAt < new Date()) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }

        // Return the token so the mobile app can use it for the final reset call
        res.json({ message: "OTP verified", token: record.token });
    } catch (err) {
        next(err);
    }
};

// src/controllers/authController.js
exports.requestMagicLink = async (req, res) => {
    try {
        const { email, fullName, role } = req.body;

        // ADD THIS: Country validation for magic link patients
        const countryValidation = validatePatientCountry(req, role);
        if (!countryValidation.allowed) {
            return res.status(403).json({
                error: `Patient registration is currently only available in: ${countryValidation.allowedCountries.join(', ')}. Your location: ${countryValidation.country}`,
                code: 'COUNTRY_RESTRICTED',
                userCountry: countryValidation.country,
                allowedCountries: countryValidation.allowedCountries
            });
        }

        await magicLinkService.requestMagicLink(
            { email, fullName, role },
            req.ip,
            req.headers["user-agent"]
        );
        return res.json({
            message:
                "If that address is registered (or was just created), you'll receive a magic link shortly.",
        });
    } catch (err) {
        // Handle "user does not exist" case explicitly
        if (err.message === "User does not exist. Sign-up using MagicLink") {
            return res.status(404).json({
                error: "No account found with that email. Please sign up first.",
            });
        }
        // Handle missing fullName
        if (err.message.includes("fullName required")) {
            return res.status(400).json({ error: err.message });
        }
        // Fallback to generic JSON error
        return res
            .status(err.status || 500)
            .json({ error: err.message || "Internal server error" });
    }
};

// src/controllers/authController.js
exports.consumeMagicLink = async (req, res) => {
    try {
        const { token, deviceFingerprint } = req.query;
        const tokens = await magicLinkService.consumeMagicLink(
            token,
            req.ip,
            req.headers["user-agent"],
            deviceFingerprint
        );

        return res.json(tokens);
    } catch (err) {
        // Invalid or expired token
        if (err.message === "Invalid or expired token") {
            return res
                .status(400)
                .json({ error: "Magic link is invalid or has expired." });
        }
        // Fallback generic
        return res
            .status(err.status || 500)
            .json({ error: err.message || "Internal server error" });
    }
};

// mobile magic link — request (sends deep link email)
exports.requestMobileMagicLink = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        await magicLinkService.requestMobileMagicLink(
            { email, role: 'doctor' },
            req.ip,
            req.headers['user-agent']
        );
        return res.json({
            message: 'If that email is registered, a sign-in link has been sent.',
        });
    } catch (err) {
        if (err.statusCode === 404) {
            return res.status(404).json({ error: err.message });
        }
        next(err);
    }
};

// mobile magic link — verify (called in-app after deep link opens)
exports.verifyMobileMagicLink = async (req, res, next) => {
    try {
        const { token, deviceFingerprint } = req.body;
        if (!token || !deviceFingerprint) {
            return res.status(400).json({ error: 'token and deviceFingerprint are required' });
        }
        const tokens = await magicLinkService.consumeMagicLink(
            token,
            req.ip,
            req.headers['user-agent'],
            deviceFingerprint
        );
        return res.json(tokens);
    } catch (err) {
        if (err.message === 'Invalid or expired token') {
            return res.status(400).json({ error: 'Magic link is invalid or has expired. Please request a new one.' });
        }
        next(err);
    }
};


