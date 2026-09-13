// src/controllers/pharmacy/pharmacyAuthController.js
const pharmacyRegistrationService = require("../services/pharmacyRegistrationService");
const pharmacyProfileRepo         = require("../repositories/pharmacyProfileRepository");
const authService = require("../../auth/services/authService");
const userRepo = require("../../auth/repositories/userRepository");
const bcrypt = require('bcryptjs');
const mfaService = require('../../auth/services/mfa/mfaService');
const passwordResetService  = require("../../auth/services/passwordResetService");
const verificationService   = require("../../auth/services/verificationService");
const emailVerRepo          = require("../../auth/repositories/emailVerificationRepository");
const AppDataSource = require("../../../config/database");

function buildAccountState(pharmacy, vendorProfile) {
  const status = pharmacy.verificationStatus;
  const isApproved = status === "approved";
  const vendorModeEnabled = !!(vendorProfile?.id);

  const stageMap = {
    pending:            { nextStep: "Upload your pharmacy license and government ID to continue.", pendingActions: ["upload_documents"] },
    documents_required: { nextStep: "Upload your pharmacy license and government ID to continue.", pendingActions: ["upload_documents"] },
    under_review:       { nextStep: "Your documents are under review. You will be notified once approved.", pendingActions: [] },
    approved:           { nextStep: null, pendingActions: [] },
    rejected:           { nextStep: "Your application was rejected. Please re-upload your documents.", pendingActions: ["upload_documents"] },
    suspended:          { nextStep: "Your account has been suspended. Please contact support.", pendingActions: [] },
  };

  const { nextStep, pendingActions } = stageMap[status] || { nextStep: null, pendingActions: [] };

  return {
    stage:              status,
    isApproved,
    canAccessShop:      isApproved,
    canReceiveOrders:   isApproved,
    vendorModeEnabled,
    vendorId:           vendorProfile?.id || null,
    documentsSubmitted: pharmacy.documentsSubmitted || false,
    nextStep,
    pendingActions,
  };
}

class PharmacyAuthController {
  async registerPharmacy(req, res, next) {
    try {
      const {
        fullName,
        email,
        password,
        pharmacyName,
        registrationNumber,
        address,
        phone,
        primaryContactPerson,
        preferredUsername
      } = req.body;

      // Validation
      if (!fullName || !email || !password || !pharmacyName || !registrationNumber || !preferredUsername || !phone || !address || !primaryContactPerson) {
        return res.status(400).json({
          error: "All required fields must be provided: fullName, email, password, pharmacyName, registrationNumber, preferredUsername, phone, address, primaryContactPerson"
        });
      }

      const result = await pharmacyRegistrationService.registerPharmacy({
        fullName,
        email,
        password,
        pharmacyName,
        registrationNumber,
        address,
        phone,
        primaryContactPerson,
        preferredUsername,
        countryCode: req.location?.countryCode ?? null,
      });

      return res.status(201).json({
        message: result.emailSent
          ? "Pharmacy registration successful. Check your email for a verification link, then upload required documents."
          : "Pharmacy registration successful, but we couldn't send a verification email. Please retry from your profile.",
        pharmacy: {
          id: result.pharmacy.id,
          pharmacyName: result.pharmacy.pharmacyName,
          registrationNumber: result.pharmacy.registrationNumber,
          address: result.pharmacy.address,
          phone: result.pharmacy.phone,
          primaryContactPerson: result.pharmacy.primaryContactPerson,
          email: result.pharmacy.email,
          username: result.pharmacy.preferredUsername,
          verificationStatus: result.pharmacy.verificationStatus,
          isActive: result.pharmacy.isActive,
          documentsSubmitted: result.pharmacy.documentsSubmitted,
          createdAt: result.pharmacy.createdAt
        },
        user: {
          id: result.user.id,
          fullName: result.user.fullName,
          email: result.user.email,
          role: result.user.role,
          status: result.user.status,
          provider: result.user.provider,
          profileImageUrl: result.user.profileImageUrl,
          bannerUrl: result.user.bannerUrl,
          isOnline: result.user.isOnline,
          tier: result.user.tier,
          createdAt: result.user.createdAt
        }
      });
    } catch (error) {
      if (error.message.includes("already")) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  async loginPharmacy(req, res, next) {
    try {
      const { email, password, mfaToken, deviceFingerprint } = req.body;
      const userAgent = req.headers["user-agent"];

      if (!email || !password || !deviceFingerprint) {
        return res.status(400).json({
          error: "Email, password, and device fingerprint are required"
        });
      }

      // 1) Lookup user
      const user = await userRepo.findByEmailAndRoleWithAuthSecrets(email, 'pharmacy');
      if (!user) {
        return res.status(401).json({
          error: "The email address you entered is not registered."
        });
      }

      // 3) Guard against non-local accounts
      if (!user.passwordHash) {
        return res.status(401).json({
          error: "This account has no local password. Please log in with Google or your magic link."
        });
      }

      // 4) Check password
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({
          error: "The password you entered is incorrect."
        });
      }

      // 5) MFA CHECK
      if (user.mfaEnabled) {
        if (!mfaToken) {
          return res.status(206).json({
            requiresMFA: true,
            message: "Please enter your two-factor authentication code",
            tempUserId: user.id
          });
        }

        const mfaValid = mfaService.verifyToken(user.mfaSecret, mfaToken);
        if (!mfaValid) {
          return res.status(401).json({
            error: "Invalid two-factor authentication code"
          });
        }
      }

      // 6) Issue tokens using existing auth service
      const tokens = await authService.login(
        { email, password, role: "pharmacy" },
        deviceFingerprint,
        userAgent
      );

      // 7) Get full pharmacy profile + vendor profile for accountState
      const pharmacyProfile = await pharmacyRegistrationService.getPharmacyProfile(user.id);
      const vendorProfile   = await AppDataSource.getRepository("VendorProfile")
        .findOne({ where: { userId: user.id, isHybridPharmacy: true } });

      return res.json({
        payload: tokens.payload,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        pharmacy: pharmacyProfile ? {
          id: pharmacyProfile.id,
          pharmacyName: pharmacyProfile.pharmacyName,
          registrationNumber: pharmacyProfile.registrationNumber,
          address: pharmacyProfile.address,
          phone: pharmacyProfile.phone,
          primaryContactPerson: pharmacyProfile.primaryContactPerson,
          email: pharmacyProfile.email,
          username: pharmacyProfile.preferredUsername,
          verificationStatus: pharmacyProfile.verificationStatus,
          documentsSubmitted: pharmacyProfile.documentsSubmitted,
          isActive: pharmacyProfile.isActive,
          createdAt: pharmacyProfile.createdAt,
          updatedAt: pharmacyProfile.updatedAt,
          documents: pharmacyProfile.documents || [],
          branches: pharmacyProfile.branches  || [],
          accountState: buildAccountState(pharmacyProfile, vendorProfile),
        } : null
      });

    } catch (error) {
      if (error.message === "Invalid credentials") {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      next(error);
    }
  }

  async getPharmacyProfile(req, res, next) {
    try {
      const userId = req.user.sub;
      const [pharmacyProfile, freshUser, vendorProfile] = await Promise.all([
        pharmacyRegistrationService.getPharmacyProfile(userId),
        userRepo.findById(userId),
        AppDataSource.getRepository("VendorProfile").findOne({ where: { userId, isHybridPharmacy: true } }),
      ]);

      if (!pharmacyProfile) {
        return res.status(404).json({ error: "Pharmacy profile not found" });
      }

      return res.json({
        user: {
          id: freshUser.id,
          fullName: freshUser.fullName,
          email: freshUser.email,
          role: freshUser.role,
          status: freshUser.status,
          provider: freshUser.provider,
          profileImageUrl: freshUser.profileImageUrl,
          isOnline: freshUser.isOnline,
          tier: freshUser.tier,
          mfaEnabled: freshUser.mfaEnabled,
          createdAt: freshUser.createdAt,
          updatedAt: freshUser.updatedAt
        },
        pharmacy: {
          id: pharmacyProfile.id,
          pharmacyName: pharmacyProfile.pharmacyName,
          registrationNumber: pharmacyProfile.registrationNumber,
          address: pharmacyProfile.address,
          phone: pharmacyProfile.phone,
          primaryContactPerson: pharmacyProfile.primaryContactPerson,
          email: pharmacyProfile.email,
          username: pharmacyProfile.preferredUsername,
          verificationStatus: pharmacyProfile.verificationStatus,
          isActive: pharmacyProfile.isActive,
          description: pharmacyProfile.description,
          website: pharmacyProfile.website,
          licenseNumber: pharmacyProfile.licenseNumber,
          licenseExpiryDate: pharmacyProfile.licenseExpiryDate,
          operatingHours: pharmacyProfile.operatingHours,
          documentsSubmitted: pharmacyProfile.documentsSubmitted,
          logoUrl: pharmacyProfile.logoUrl || null,
          serviceRadius: pharmacyProfile.serviceRadius,
          defaultCurrency: pharmacyProfile.defaultCurrency,
          createdAt: pharmacyProfile.createdAt,
          updatedAt: pharmacyProfile.updatedAt,
          documents: pharmacyProfile.documents || [],
          branches: pharmacyProfile.branches  || [],
          accountState: buildAccountState(pharmacyProfile, vendorProfile),
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePharmacyProfile(req, res, next) {
    try {
      const userId = req.user.sub;
      const updateData = req.body;
      const result = await pharmacyRegistrationService.updatePharmacyProfile(userId, updateData);
      return res.json({
        success: true,
        message: "Profile updated successfully",
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getPricingFeeTypes(req, res) {
    return res.json({
      success: true,
      data: [
        { value: "delivery",         label: "Delivery Fee" },
        { value: "consultation",     label: "Consultation Fee" },
        { value: "handling",         label: "Handling Fee" },
        { value: "processing",       label: "Processing Fee" },
        { value: "home_delivery",    label: "Home Delivery" },
        { value: "express_delivery", label: "Express Delivery" },
        { value: "packaging",        label: "Packaging Fee" },
        { value: "call_in",          label: "Call-in Fee" },
      ]
    });
  }

  async getStaffRoles(req, res) {
    return res.json({
      success: true,
      data: [
        { value: "pharmacist", label: "Pharmacist" },
        { value: "assistant",  label: "Assistant" },
        { value: "dispatcher", label: "Dispatcher" },
        { value: "pharmacy",   label: "Admin / Manager" },
      ]
    });
  }

  async setPricing(req, res, next) {
    try {
      const userId = req.user.sub;
      const pricingData = req.body;
      const pricing = await pharmacyRegistrationService.setPricing(userId, pricingData);
      return res.status(201).json({
        success: true,
        message: "Pricing set successfully",
        data: pricing
      });
    } catch (error) {
      next(error);
    }
  }

  async getPricing(req, res, next) {
    try {
      const userId = req.user.sub;
      const pricing = await pharmacyRegistrationService.getPricing(userId);
      return res.json({
        success: true,
        data: pricing
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePricing(req, res, next) {
    try {
      const userId = req.user.sub;
      const { id } = req.params;
      await pharmacyRegistrationService.deletePricing(userId, id);
      return res.json({ success: true, message: "Pricing configuration deleted" });
    } catch (error) {
      next(error);
    }
  }

  async addStaff(req, res, next) {
    try {
      const userId = req.user.sub;
      const staffData = req.body;
      const staffMember = await pharmacyRegistrationService.addStaffMember(userId, staffData);
      return res.status(201).json({
        success: true,
        message: "Staff member added successfully",
        data: staffMember
      });
    } catch (error) {
      next(error);
    }
  }

  async getStaff(req, res, next) {
    try {
      const userId = req.user.sub;
      const staff = await pharmacyRegistrationService.getStaffMembers(userId);
      return res.json({
        success: true,
        data: staff
      });
    } catch (error) {
      next(error);
    }
  }

  async removeStaff(req, res, next) {
    try {
      const userId = req.user.sub;
      const { id: staffUserId } = req.params;
      const result = await pharmacyRegistrationService.removeStaffMember(userId, staffUserId);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getAllPharmacies(req, res, next) {
    try {
      const { page = 1, limit = 20, verificationStatus } = req.query;
      const pharmacies = await pharmacyRegistrationService.getAllPharmacies({ page, limit, verificationStatus });
      return res.json({
        success: true,
        data: pharmacies.map(p => ({
          id: p.id,
          pharmacyName: p.pharmacyName,
          registrationNumber: p.registrationNumber,
          address: p.address,
          phone: p.phone,
          email: p.email,
          username: p.preferredUsername,
          verificationStatus: p.verificationStatus,
          isActive: p.isActive,
          documentsSubmitted: p.documentsSubmitted,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          user: p.user ? {
            id: p.user.id,
            fullName: p.user.fullName,
            email: p.user.email,
            status: p.user.status,
            createdAt: p.user.createdAt
          } : null
        }))
      });
    } catch (error) {
      next(error);
    }
  }

  async getPharmacyById(req, res, next) {
    try {
      const pharmacy = await pharmacyProfileRepo.findById(req.params.id);
      if (!pharmacy || pharmacy.verificationStatus !== "approved") {
        return res.status(404).json({ success: false, error: "Pharmacy not found" });
      }

      // Get vendor profile so frontend knows which vendorId to use for the cart
      const vendorProfile = await AppDataSource.getRepository("VendorProfile")
        .findOne({ where: { userId: pharmacy.userId, isHybridPharmacy: true } });

      return res.status(200).json({
        success: true,
        pharmacy: {
          id:                 pharmacy.id,
          pharmacyName:       pharmacy.pharmacyName,
          registrationNumber: pharmacy.registrationNumber,
          address:            pharmacy.address,
          phone:              pharmacy.phone,
          email:              pharmacy.email,
          website:            pharmacy.website     || null,
          logoUrl:            pharmacy.logoUrl     || null,
          description:        pharmacy.description || null,
          operatingHours:     pharmacy.operatingHours || null,
          verificationStatus: pharmacy.verificationStatus,
          isActive:           pharmacy.isActive,
          vendorId:           vendorProfile?.id || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const { token } = req.query;
      if (!token) return res.status(400).json({ success: false, error: "Verification token is required" });

      const ev = await emailVerRepo.findByToken(token);
      if (!ev) return res.status(400).json({ success: false, error: "Invalid or expired verification token" });

      if (ev.usedAt) {
        return res.status(200).json({ success: true, message: "Email already verified." });
      }
      if (ev.expiresAt < new Date()) {
        return res.status(400).json({ success: false, error: "Verification token has expired. Request a new one." });
      }

      ev.usedAt = new Date();
      await emailVerRepo.save(ev);

      return res.status(200).json({ success: true, message: "Email verified successfully. Your pharmacy application is under review." });
    } catch (error) {
      next(error);
    }
  }

  async resendVerification(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, error: "Email is required" });
      await verificationService.resendVerificationEmail(email);
      return res.status(200).json({ success: true, message: "If unverified, a new verification link has been sent." });
    } catch (error) {
      if (error.code === 'ALREADY_VERIFIED') {
        return res.status(200).json({ success: true, message: "Email is already verified. You can log in." });
      }
      if (error.message?.includes("Too many")) {
        return res.status(429).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const userId = req.user.sub;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: "currentPassword and newPassword are required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
      }

      const user = await userRepo.findByIdWithAuthSecrets(userId);
      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ success: false, message: "Current password is incorrect" });

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await userRepo.update(userId, { passwordHash });

      return res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      next(error);
    }
  }

  async updateAccountSettings(req, res, next) {
    try {
      const userId = req.user.sub;
      const { fullName, email } = req.body;

      const updates = {};
      if (fullName) updates.fullName = fullName.trim();
      if (email) {
        const existing = await userRepo.findByEmailAndRole(email.toLowerCase().trim(), 'pharmacy');
        if (existing && existing.id !== userId) {
          return res.status(400).json({ success: false, message: "Email already in use" });
        }
        updates.email = email.toLowerCase().trim();
      }

      if (!Object.keys(updates).length) {
        return res.status(400).json({ success: false, message: "Nothing to update" });
      }

      await userRepo.update(userId, updates);
      const updated = await userRepo.findById(userId);

      return res.json({
        success: true,
        message: "Account settings updated",
        data: { fullName: updated.fullName, email: updated.email }
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadProfileLogo(req, res, next) {
    try {
      const userId  = req.user.sub;
      const savedFiles = req.savedFiles || [];

      if (!savedFiles.length) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const savedFile = savedFiles[0];
      const baseUrl = process.env.FILE_SERVER_URL || process.env.APP_URL || process.env.APP_BASE_URL;
      const logoUrl = savedFile.fileUrl || `${baseUrl}/api/documents/images/${savedFile.id}`;

      // Update pharmacy profile logo AND user profileImageUrl in parallel
      await Promise.all([
        pharmacyProfileRepo.updateLogoUrl(userId, logoUrl),
        userRepo.update(userId, { profileImageUrl: logoUrl }),
      ]);

      return res.status(200).json({
        success: true,
        message: "Logo uploaded successfully",
        data: { logoUrl },
      });
    } catch (error) {
      next(error);
    }
  }
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: "Email is required" });
      await passwordResetService.requestReset(email, 'pharmacy');
      return res.status(200).json({ success: true, message: "If that email is registered, a reset link has been sent." });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: "token and newPassword are required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
      }
      await passwordResetService.resetPassword(token, newPassword);
      return res.status(200).json({ success: true, message: "Password reset successful. You can now log in." });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PharmacyAuthController();