// src/features/auth/routes/index.js
// Auth feature routes
// 
// NEW ROUTES: /api/auth/*
// LEGACY ROUTES: /auth/* (backward compatible, with deprecation warnings)

const router = require("express").Router();

// Import controller from the existing location (will be moved later)
const authController = require("../controllers/authController");
const referralRoutes = require("./referral");
const mfaRoutes = require("./mfa");

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: |
 *     User authentication and account management.
 *     
 *     ## Route Migration Notice
 *     These routes are available at both:
 *     - **NEW**: `/api/auth/*` (recommended)
 *     - **LEGACY**: `/auth/*` (deprecated, will be removed in v2.0)
 */

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     description: |
 *       Creates a new user account and sends verification email.
 *       
 *       **Legacy route**: `POST /auth/signup` (deprecated)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               role:
 *                 type: string
 *                 enum: [patient, doctor]
 *                 default: patient
 *               phoneNumber:
 *                 type: string
 *                 description: Required for doctors
 *               departmentSpecialty:
 *                 type: string
 *                 description: Medical specialty for doctors
 */
router.post("/signup", authController.signup);
router.post("/signup-otp", authController.signupOtp);
router.get("/signup", (req, res) => {
    res.status(405).json({
        error: "Method Not Allowed",
        message: "Signup must be a POST request. The server received a GET request. This usually happens due to a redirect (e.g., http to https) or a frontend bug.",
        receivedMethod: req.method,
        receivedUrl: req.originalUrl
    });
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Authentication]
 *     description: |
 *       Authenticates user and returns JWT tokens.
 *       
 *       **Legacy route**: `POST /auth/login` (deprecated)
 */
router.post("/login", authController.login);
/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and revoke refresh token
 *     tags: [Authentication]
 *     description: |
 *       Revokes the provided refresh token for the specific device.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *               - deviceFingerprint
 *             properties:
 *               refreshToken:
 *                 type: string
 *               deviceFingerprint:
 *                 type: string
 */
router.post("/logout", authController.logout);

/**
 * @swagger
 * /api/auth/verify-email:
 *   get:
 *     summary: Verify email address
 *     tags: [Authentication]
 *     description: |
 *       Verifies user's email using token from verification email.
 *       
 *       **Legacy route**: `GET /auth/verify-email` (deprecated)
 */
router.get("/verify-email", authController.verifyEmail);
router.post("/verify-email-otp", authController.verifyEmailOtp);
router.get("/check-verification-status", authController.checkVerificationStatus);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     description: |
 *       Issues new access token using refresh token.
 *       
 *       **Legacy route**: `POST /auth/refresh` (deprecated)
 */
router.post("/refresh", authController.refresh);

// ============================================
// PASSWORD RESET ROUTES
// ============================================

/**
 * @swagger
 * /api/auth/password-reset-request:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     description: |
 *       Sends password reset email if account exists.
 *       
 *       **Legacy route**: `POST /auth/password-reset-request` (deprecated)
 */
router.post("/password-reset-request", authController.requestPasswordReset);
router.post("/password-reset-otp-request", authController.requestPasswordResetOtp);
router.post("/verify-password-reset-otp", authController.verifyPasswordResetOtp);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     description: |
 *       Resets password using token from reset email.
 *       
 *       **Legacy route**: `POST /auth/reset-password` (deprecated)
 */
router.post("/reset-password", authController.resetPassword);

/**
 * @swagger
 * /api/auth/resend-password-reset:
 *   post:
 *     summary: Resend password reset email
 *     tags: [Authentication]
 *     description: |
 *       Resends password reset email.
 *       
 *       **Legacy route**: `POST /auth/resend-password-reset` (deprecated)
 */
router.post("/resend-password-reset", authController.resendPasswordReset);

// ============================================
// EMAIL VERIFICATION ROUTES
// ============================================

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     tags: [Authentication]
 *     description: |
 *       Resends email verification link.
 *
 *       **Legacy route**: `POST /auth/resend-verification` (deprecated)
 */
router.post("/resend-verification", authController.resendVerification);

/**
 * @swagger
 * /api/auth/check-verification-status:
 *   get:
 *     summary: Check user verification status
 *     tags: [Authentication]
 *     description: |
 *       Checks if a user's email has been verified.
 *       Returns the user's email and verification status (true/false).
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: The email address to check verification status for
 *     responses:
 *       200:
 *         description: Verification status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 email:
 *                   type: string
 *                   format: email
 *                 isVerified:
 *                   type: boolean
 *       400:
 *         description: Email is required
 *       404:
 *         description: User not found
 */
router.get("/check-verification-status", authController.checkVerificationStatus);

// ============================================
// MAGIC LINK ROUTES
// ============================================

/**
 * @swagger
 * /api/auth/magic-link:
 *   post:
 *     summary: Request magic link login
 *     tags: [Authentication]
 *     description: |
 *       Sends magic link for passwordless login.
 *       
 *       **Legacy route**: `POST /auth/magic-link` (deprecated)
 */
router.post("/magic-link", authController.requestMagicLink);

/**
 * @swagger
 * /api/auth/magic-login:
 *   get:
 *     summary: Login via magic link
 *     tags: [Authentication]
 *     description: |
 *       Authenticates user via magic link token.
 *       
 *       **Legacy route**: `GET /auth/magic-login` (deprecated)
 */
router.get("/magic-login", authController.consumeMagicLink);

// ============================================
// GOOGLE OAUTH ROUTES
// ============================================

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Initiate Google OAuth
 *     tags: [Authentication]
 *     description: |
 *       Redirects to Google OAuth consent screen.
 *       
 *       **Legacy route**: `GET /auth/google` (deprecated)
 */
router.get("/google", authController.googleAuth);
/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [Authentication]
 *     description: |
 *       Handles Google OAuth callback and issues tokens.
 *       
 *       **Legacy route**: `GET /auth/google/callback` (deprecated)
 */
router.get("/google/callback", authController.googleCallback);
/**
 * @swagger
 * /api/auth/google/mobile-login:
 *   post:
 *     summary: Google Mobile Login/Signup
 *     tags: [Authentication]
 *     description: |
 *       Authenticates a user via Google ID Token sent from a mobile app (Android/iOS).
 *       If the user doesn't exist, a new account will be created with the specified role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *               - role
 *               - deviceFingerprint
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Identity token received from Google Sign-In on the mobile device
 *               role:
 *                 type: string
 *                 enum: [patient, doctor]
 *                 description: The role to assign to the user if they are signing up
 *               deviceFingerprint:
 *                 type: string
 *                 description: Unique identifier for the device
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jwtPayload:
 *                   type: object
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Invalid input or token
 *       403:
 *         description: Geographic restriction (for patients)
 */
router.post("/google/mobile-login", authController.googleMobileLogin);

router.use("/referrals", referralRoutes);
router.use("/mfa", mfaRoutes);

// ─── DEV ONLY: SMTP test endpoint ────────────────────────────────────────────
// POST /api/auth/test-email   body: { "to": "some@email.com" }
// Remove or protect this route before going to production
router.post("/test-email", async (req, res) => {
  try {
    const emailService = require("../../../shared/services/email/emailService");
    const to = req.body?.to;
    if (!to) {
      return res.status(400).json({ error: "Body must include { \"to\": \"email@example.com\" }" });
    }

    // 1. Log current SMTP config (no passwords)
    const smtpConfig = {
      host: process.env.CPANEL_EMAIL_HOST,
      port: process.env.CPANEL_EMAIL_PORT,
      secure: process.env.CPANEL_EMAIL_SECURE,
      user: process.env.CPANEL_EMAIL_USER,
      from: process.env.CPANEL_EMAIL_FROM,
      passSet: !!process.env.CPANEL_EMAIL_PASS,
    };
    console.log("📧 SMTP config at test time:", smtpConfig);

    // 2. Verify SMTP connection first
    const connected = await emailService.verifyConnection();
    if (!connected) {
      return res.status(500).json({
        success: false,
        message: "SMTP connection failed. Check server logs for details.",
        smtpConfig,
      });
    }

    // 3. Send a raw test email
    await emailService.sendRaw(
      to,
      "✅ CosmicForge SMTP Test",
      `<h2>SMTP Test</h2><p>This is a test email sent at ${new Date().toISOString()}.</p><p>If you received this, your SMTP is working correctly!</p>`
    );

    return res.json({
      success: true,
      message: `Test email sent to ${to}. Check inbox (and spam folder).`,
      smtpConfig,
    });
  } catch (err) {
    console.error("❌ test-email error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
      smtpConfig: {
        host: process.env.CPANEL_EMAIL_HOST,
        port: process.env.CPANEL_EMAIL_PORT,
        user: process.env.CPANEL_EMAIL_USER,
        passSet: !!process.env.CPANEL_EMAIL_PASS,
      },
    });
  }
});

module.exports = router;