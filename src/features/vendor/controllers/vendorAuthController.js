const vendorAuthService       = require("../services/vendorAuthService");
const authService             = require("../../auth/services/authService");
const userRepository          = require("../../auth/repositories/userRepository");
const passwordResetService    = require("../../auth/services/passwordResetService");
const verificationService     = require("../../auth/services/verificationService");
const refreshTokenService     = require("../../auth/services/refreshTokenService");
const emailVerRepo            = require("../../auth/repositories/emailVerificationRepository");
const bcrypt                  = require("bcryptjs");
const mfaService              = require("../../auth/services/mfa/mfaService");

const VALID_CATEGORIES = [
    "health_wellness",
    "medical_supplies",
    "baby_mother_care",
    "fitness_lifestyle",
    "nutrition_healthy_living",
    "others",
];

function buildVendorAccountState(user, vendor) {
    const emailVerified  = user.status !== "pending_email_verification";
    const verifyStatus   = vendor.verificationStatus;
    const isApproved     = verifyStatus === "approved" && user.status === "vendor_active";

    let stage, nextStep, pendingActions;

    if (!emailVerified) {
        stage          = "email_unverified";
        nextStep       = "Please verify your email address. Check your inbox for the verification link.";
        pendingActions = ["verify_email"];
    } else if (verifyStatus === "pending" || verifyStatus === "documents_required") {
        stage          = "documents_required";
        nextStep       = "Upload your government ID and business registration document to continue.";
        pendingActions = ["upload_documents"];
    } else if (verifyStatus === "under_review") {
        stage          = "under_review";
        nextStep       = "Your documents are under review. You will be notified once your account is approved.";
        pendingActions = [];
    } else if (verifyStatus === "approved") {
        stage          = "approved";
        nextStep       = null;
        pendingActions = [];
    } else if (verifyStatus === "rejected") {
        stage          = "rejected";
        nextStep       = "Your application was rejected. Please re-upload your documents.";
        pendingActions = ["upload_documents"];
    } else if (verifyStatus === "suspended") {
        stage          = "suspended";
        nextStep       = "Your account has been suspended. Please contact support.";
        pendingActions = [];
    } else {
        stage          = verifyStatus;
        nextStep       = null;
        pendingActions = [];
    }

    return {
        stage,
        emailVerified,
        isApproved,
        canListProducts:  isApproved,
        canReceiveOrders: isApproved,
        documentsSubmitted: vendor.documentsSubmitted || false,
        nextStep,
        pendingActions,
    };
}

class VendorAuthController {
    async registerVendor(req, res, next) {
        try {
            const {
                fullName,
                email,
                password,
                phoneNumber,
                businessName,
                businessCategory,
                businessEmail,
                businessPhone,
                country,
                state,
                city,
                fullAddress,
                businessWebsite,
                businessDescription,
            } = req.body;

            if (!fullName || !email || !password || !businessName || !businessCategory ||
                !businessEmail || !businessPhone || !country || !state || !city ||
                !fullAddress || !businessDescription) {
                return res.status(400).json({
                    success: false,
                    error: "Missing required fields: fullName, email, password, businessName, businessCategory, businessEmail, businessPhone, country, state, city, fullAddress, businessDescription",
                });
            }

            if (!VALID_CATEGORIES.includes(businessCategory)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid businessCategory. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
                });
            }

            const result = await vendorAuthService.registerVendor({
                fullName,
                email,
                password,
                phoneNumber,
                businessName,
                businessCategory,
                businessEmail,
                businessPhone,
                country,
                state,
                city,
                fullAddress,
                businessWebsite,
                businessDescription,
                countryCode: req.location?.countryCode ?? null,
            });

            return res.status(201).json({
                success: true,
                message: result.emailSent
                    ? "Vendor registration successful. Check your email for a verification link."
                    : "Vendor registration successful, but we couldn't send a verification email. Please retry from your profile.",
                vendor: {
                    id: result.vendor.id,
                    businessName: result.vendor.businessName,
                    businessCategory: result.vendor.businessCategory,
                    businessEmail: result.vendor.businessEmail,
                    businessPhone: result.vendor.businessPhone,
                    country: result.vendor.country,
                    state: result.vendor.state,
                    city: result.vendor.city,
                    fullAddress: result.vendor.fullAddress,
                    verificationStatus: result.vendor.verificationStatus,
                    isActive: result.vendor.isActive,
                    documentsSubmitted: result.vendor.documentsSubmitted,
                    createdAt: result.vendor.createdAt,
                },
                user: {
                    id: result.user.id,
                    fullName: result.user.fullName,
                    email: result.user.email,
                    role: result.user.role,
                    status: result.user.status,
                    tier: result.user.tier,
                    createdAt: result.user.createdAt,
                },
            });
        } catch (error) {
            if (error.message.includes("already")) {
                return res.status(400).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    async loginVendor(req, res, next) {
        try {
            const { email, password, deviceFingerprint } = req.body;

            if (!email || !password) {
                return res.status(400).json({ success: false, error: "Email and password are required" });
            }

            const user = await userRepository.findByEmailAndRole(email.toLowerCase().trim(), 'vendor');
            if (!user) {
                return res.status(401).json({ success: false, error: "Invalid credentials" });
            }

            const passwordMatch = await bcrypt.compare(password, user.passwordHash);
            if (!passwordMatch) {
                return res.status(401).json({ success: false, error: "Invalid credentials" });
            }

            if (user.mfaEnabled) {
                const tempToken = await mfaService.generateTempToken(user.id);
                return res.status(206).json({
                    success: true,
                    mfaRequired: true,
                    tempToken,
                    message: "MFA verification required",
                });
            }

            const { vendor } = await vendorAuthService.getVendorProfile(user.id);
            const tokens = await authService.login({ email, password }, deviceFingerprint, req.headers['user-agent']);

            return res.status(200).json({
                success: true,
                message: "Login successful",
                ...tokens,
                vendor: {
                    id: vendor.id,
                    businessName: vendor.businessName,
                    businessCategory: vendor.businessCategory,
                    verificationStatus: vendor.verificationStatus,
                    isActive: vendor.isActive,
                    documentsSubmitted: vendor.documentsSubmitted,
                    logoUrl: vendor.logoUrl,
                    accountState: buildVendorAccountState(user, vendor),
                },
                user: {
                    id: user.id,
                    fullName: user.fullName,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    tier: user.tier,
                    profileImageUrl: user.profileImageUrl,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    async forgotPassword(req, res, next) {
        try {
            await passwordResetService.requestReset(req.body.email);
            return res.status(200).json({ success: true, message: "If that email exists, a reset link has been sent." });
        } catch (error) {
            next(error);
        }
    }

    async resetPassword(req, res, next) {
        try {
            const { token, newPassword } = req.body;
            if (!token || !newPassword) {
                return res.status(400).json({ success: false, error: "token and newPassword are required" });
            }
            if (newPassword.length < 8) {
                return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
            }
            await passwordResetService.resetPassword(token, newPassword);
            return res.status(200).json({ success: true, message: "Password reset successful" });
        } catch (error) {
            next(error);
        }
    }

    async getVendorProfile(req, res, next) {
        try {
            const { vendor, user } = await vendorAuthService.getVendorProfile(req.user.id);
            return res.status(200).json({
                success: true,
                vendor: {
                    id: vendor.id,
                    businessName: vendor.businessName,
                    businessCategory: vendor.businessCategory,
                    businessEmail: vendor.businessEmail,
                    businessPhone: vendor.businessPhone,
                    country: vendor.country,
                    state: vendor.state,
                    city: vendor.city,
                    fullAddress: vendor.fullAddress,
                    businessWebsite: vendor.businessWebsite,
                    businessDescription: vendor.businessDescription,
                    logoUrl: vendor.logoUrl,
                    verificationStatus: vendor.verificationStatus,
                    isActive: vendor.isActive,
                    documentsSubmitted: vendor.documentsSubmitted,
                    isHybridPharmacy: vendor.isHybridPharmacy,
                    notificationPreferences: vendor.notificationPreferences,
                    documents: vendor.documents,
                    createdAt: vendor.createdAt,
                    updatedAt: vendor.updatedAt,
                    accountState: buildVendorAccountState(user, vendor),
                },
                user: {
                    id: user.id,
                    fullName: user.fullName,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    tier: user.tier,
                    profileImageUrl: user.profileImageUrl,
                    phoneNumber: user.phoneNumber,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    async updateVendorProfile(req, res, next) {
        try {
            const updated = await vendorAuthService.updateVendorProfile(req.user.id, req.body);
            return res.status(200).json({ success: true, message: "Profile updated", vendor: updated });
        } catch (error) {
            next(error);
        }
    }

    async uploadVendorLogo(req, res, next) {
        try {
            const savedFiles = req.savedFiles || [];
            if (!savedFiles.length) {
                return res.status(400).json({ success: false, error: "No file uploaded" });
            }
            const baseUrl = process.env.FILE_SERVER_URL || process.env.APP_URL || "";
            const logoUrl = `${baseUrl}/api/documents/images/${savedFiles[0].id}`;
            const result = await vendorAuthService.uploadVendorLogo(req.user.id, logoUrl);
            return res.status(200).json({ success: true, message: "Logo uploaded", logoUrl: result.logoUrl });
        } catch (error) {
            next(error);
        }
    }

    async uploadDocument(req, res, next) {
        try {
            const savedFiles = req.savedFiles || [];
            if (!savedFiles.length) {
                return res.status(400).json({ success: false, error: "No file uploaded" });
            }

            const { documentType } = req.body;
            const VALID_TYPES = ["government_id", "business_registration"];
            if (!documentType || !VALID_TYPES.includes(documentType)) {
                return res.status(400).json({
                    success: false,
                    error: `documentType is required. Must be one of: ${VALID_TYPES.join(", ")}`,
                });
            }

            const baseUrl = process.env.FILE_SERVER_URL || process.env.APP_URL || "";
            const savedFile = savedFiles[0];
            const documents = await vendorAuthService.uploadDocuments(req.user.id, [{
                documentType,
                documentUrl: `${baseUrl}/api/documents/images/${savedFile.id}`,
                fileName:    savedFile.originalFileName || null,
                mimeType:    savedFile.mimeType || null,
            }]);

            return res.status(200).json({
                success: true,
                message: "Document uploaded. Your account is now pending verification review.",
                document: {
                    id:           documents[0].id,
                    documentType: documents[0].documentType,
                    documentUrl:  documents[0].documentUrl,
                    fileName:     documents[0].fileName,
                    createdAt:    documents[0].createdAt,
                },
            });
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    async updateAccountSettings(req, res, next) {
        try {
            const { fullName, email } = req.body;
            const userRepo = require("../../auth/repositories/userRepository");

            if (email) {
                const existing = await userRepo.findByEmailAndRole(email.toLowerCase().trim(), 'vendor');
                if (existing && existing.id !== req.user.id) {
                    return res.status(400).json({ success: false, error: "Email already in use" });
                }
            }

            const updates = {};
            if (fullName) updates.fullName = fullName;
            if (email)    updates.email = email.toLowerCase().trim();

            await require("../../../config/database").getRepository("User").update(req.user.id, updates);
            return res.status(200).json({ success: true, message: "Account settings updated" });
        } catch (error) {
            next(error);
        }
    }

    async changePassword(req, res, next) {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ success: false, error: "currentPassword and newPassword are required" });
            }
            if (newPassword.length < 8) {
                return res.status(400).json({ success: false, error: "New password must be at least 8 characters" });
            }

            const user = await userRepository.findById(req.user.id);
            const match = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!match) {
                return res.status(401).json({ success: false, error: "Current password is incorrect" });
            }

            const passwordHash = await bcrypt.hash(newPassword, 12);
            await require("../../../config/database").getRepository("User").update(user.id, {
                passwordHash,
                passwordChangedAt: new Date(),
            });

            return res.status(200).json({ success: true, message: "Password changed successfully" });
        } catch (error) {
            next(error);
        }
    }

    async getAllVendors(req, res, next) {
        try {
            const { page = 1, limit = 20, verificationStatus } = req.query;
            const result = await vendorAuthService.getAllVendors({
                page: Number(page),
                limit: Number(limit),
                verificationStatus,
            });
            return res.status(200).json({ success: true, ...result });
        } catch (error) {
            next(error);
        }
    }

    async verifyEmail(req, res, next) {
        try {
            const { token } = req.query;
            if (!token) {
                return res.status(400).json({ success: false, error: "Verification token is required" });
            }

            const ev = await emailVerRepo.findByToken(token);
            if (!ev) {
                return res.status(400).json({ success: false, error: "Invalid verification token" });
            }

            const user = await userRepository.findById(ev.user.id);
            if (!user || user.role !== "vendor") {
                return res.status(400).json({ success: false, error: "Invalid verification token" });
            }

            // Already verified — treat as success
            if (user.status === "vendor_active" || user.status === "pending_vendor_verification") {
                if (ev.usedAt) {
                    return res.status(200).json({ success: true, message: "Email already verified. Awaiting admin approval." });
                }
            }

            if (ev.expiresAt < new Date()) {
                return res.status(400).json({ success: false, error: "Verification token has expired. Request a new one." });
            }

            ev.usedAt = new Date();
            await emailVerRepo.save(ev);

            // Vendor status stays pending_vendor_verification — admin must approve separately
            return res.status(200).json({
                success: true,
                message: "Email verified successfully. Your vendor application is under review.",
            });
        } catch (error) {
            next(error);
        }
    }

    async resendVerification(req, res, next) {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ success: false, error: "Email is required" });
            }
            await verificationService.resendVerificationEmail(email);
            return res.status(200).json({ success: true, message: "If unverified, a new verification link has been sent." });
        } catch (error) {
            if (error.code === 'ALREADY_VERIFIED') {
                return res.status(200).json({ success: true, message: "Email is already verified. You can log in." });
            }
            if (error.message.includes("Too many")) {
                return res.status(429).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    async refresh(req, res, next) {
        try {
            const { refreshToken, deviceFingerprint } = req.body;
            if (!refreshToken || !deviceFingerprint) {
                return res.status(400).json({ success: false, error: "refreshToken and deviceFingerprint are required" });
            }
            const tokens = await refreshTokenService.rotateRefreshToken(
                refreshToken,
                deviceFingerprint,
                req.headers["user-agent"]
            );
            return res.status(200).json({ success: true, ...tokens });
        } catch (error) {
            const msg = error.message === "Invalid or expired refresh token"
                ? "Your session has expired. Please sign in again."
                : error.message;
            return res.status(401).json({ success: false, error: msg });
        }
    }
}

module.exports = new VendorAuthController();
