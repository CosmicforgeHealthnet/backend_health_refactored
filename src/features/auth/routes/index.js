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

module.exports = router;