// src/features/auth/controllers/authController.js
// Auth Controller - Feature based
const authService = require("../services/authService");
const referralService = require("../services/referralService"); // Internal to auth feature now
const emailVerRepo = require("../repositories/emailVerificationRepository");
const userRepo = require("../repositories/userRepository");
const bcrypt = require("bcrypt");

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

// login
exports.login = async (req, res, next) => {
    const { email, password, mfaToken, deviceFingerprint } = req.body;
    const userAgent = req.headers["user-agent"];

    try {
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

        // 4) Check password
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res
                .status(401)
                .json({ error: "The password you entered is incorrect." });
        }

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

// Redirect to Google consent screen
exports.googleAuth = (req, res) => {
    const { role, deviceFingerprint } = req.query;
    if (!role || !deviceFingerprint) {
        return res
            .status(400)
            .json({ error: "Both `role` and `deviceFingerprint` are required" });
    }

    // Encode role + fingerprint into state
    const stateObj = { role, deviceFingerprint };
    const state = Buffer.from(JSON.stringify(stateObj)).toString("base64");

    const url = googleAuthService.getAuthUrl(state);
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

        return res.json({ jwtPayload, accessToken, refreshToken });
    } catch (err) {
        next(err);
    }
};

// refresh token!!!!
exports.refresh = async (req, res, next) => {
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

// request password reset
exports.requestPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        // Note: passwordResetService is now local
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

// src/controllers/authController.js
exports.requestMagicLink = async (req, res, next) => {
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
exports.consumeMagicLink = async (req, res, next) => {
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
        // IP/UA mismatch
        // if (err.message === "Link must be opened from the same browser and IP") {
        //   return res.status(401).json({
        //     error: "Magic link must be opened from the same browser & IP.",
        //   });
        // }
        // Fallback generic
        return res
            .status(err.status || 500)
            .json({ error: err.message || "Internal server error" });
    }
};
