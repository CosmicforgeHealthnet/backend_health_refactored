// src/services/pharmacy/pharmacyRegistrationService.js
const pharmacyProfileRepo = require("../repositories/pharmacyProfileRepository");
const pharmacyDocumentRepo = require("../repositories/pharmacyDocumentRepository");
const pharmacyVerificationRepo = require("../repositories/pharmacyVerificationRepository");
const userRepo = require("../../auth/repositories/userRepository");
const bcrypt = require('bcryptjs');
const verificationService = require('../../auth/services/verificationService'); // Assuming this is still in global services or moved
const referralService = require('../../auth/services/referralService'); // Pending refactor to auth
const { sendPharmacyStaffWelcomeEmail } = require("../../../shared/services/email/helper/pharmacy");
const AppDataSource = require('../../../config/database');
const CurrencyService = require('../../payments/services/currencyService');

class PharmacyRegistrationService {
  get profileRepo() { return require("../repositories/pharmacyProfileRepository"); }
  get documentRepo() { return require("../repositories/pharmacyDocumentRepository"); }
  get verificationRepo() { return require("../repositories/pharmacyVerificationRepository"); }
  get pricingRepo() { return require("../repositories/pharmacyPricingRepository"); }
  get userRepo() { return require("../../auth/repositories/userRepository"); }

  async registerPharmacy(registrationData) {
    const {
      fullName,
      email,
      password,
      pharmacyName,
      registrationNumber,
      address,
      phone,
      primaryContactPerson,
      preferredUsername,
      countryCode,
    } = registrationData;

    // Resolve defaultCurrency from pharmacy's location — fall back to USD if not supported
    let defaultCurrency = "USD";
    try {
      const localCurrency = CurrencyService.getCurrencyForCountry(countryCode);
      const [paystackOk, flutterwaveOk] = await Promise.all([
        CurrencyService.isCurrencySupportedByProvider(localCurrency, "paystack"),
        CurrencyService.isCurrencySupportedByProvider(localCurrency, "flutterwave"),
      ]);
      if (paystackOk || flutterwaveOk) defaultCurrency = localCurrency;
    } catch (_) {
      // Currency resolution is non-critical — keep USD fallback
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Run all uniqueness checks before opening a transaction
    const existingUser = await this.userRepo.findByEmail(normalizedEmail);
    if (existingUser) throw new Error("Email already in use");

    const existingUsername = await this.profileRepo.findByUsername(preferredUsername);
    if (existingUsername) throw new Error("Username already taken");

    const existingRegistration = await this.profileRepo.findByRegistrationNumber(registrationNumber);
    if (existingRegistration) throw new Error("Registration number already exists");

    // Hash password before transaction (CPU work, no DB needed)
    const passwordHash = await bcrypt.hash(password, 12);

    // Wrap all DB writes in a transaction — if anything fails, everything rolls back
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedUser, savedPharmacy;

    try {
      savedUser = await queryRunner.manager.save("User", {
        fullName,
        email: normalizedEmail,
        passwordHash,
        role: "pharmacy",
        status: "pending_email_verification"
      });

      savedPharmacy = await queryRunner.manager.save("PharmacyProfile", {
        userId: savedUser.id,
        pharmacyName,
        registrationNumber,
        address,
        phone,
        primaryContactPerson,
        email: normalizedEmail,
        preferredUsername,
        verificationStatus: "pending",
        documentsSubmitted: false,
        defaultCurrency,
      });

      await queryRunner.manager.save("PharmacyVerificationRequest", {
        pharmacyId: savedPharmacy.id,
        requestType: "initial_verification",
        status: "pending",
        priority: "medium",
        requestNotes: "Initial pharmacy registration"
      });

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      // Re-map unique constraint DB errors to friendly messages
      if (err.code === '23505') {
        if (err.detail?.includes('email')) throw new Error("Email already in use");
        if (err.detail?.includes('preferredUsername')) throw new Error("Username already taken");
        if (err.detail?.includes('registrationNumber')) throw new Error("Registration number already exists");
      }
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Send verification email (non-blocking — outside transaction on purpose)
    let emailSent = true;
    try {
      await verificationService.sendEmailVerification(savedUser);
    } catch (mailErr) {
      console.error("💥 Email verification failed:", mailErr);
      emailSent = false;
    }

    // Create referral code (non-blocking — outside transaction on purpose)
    try {
      await referralService.createUserReferralCode(savedUser.id);
    } catch (referralErr) {
      console.error("Referral code creation failed:", referralErr);
    }

    return {
      user: savedUser,
      pharmacy: savedPharmacy,
      emailSent
    };
  }

  async uploadPharmacyDocuments(pharmacyId, documentsData) {
    const pharmacy = await this.profileRepo.findById(pharmacyId);
    if (!pharmacy) {
      throw new Error("Pharmacy not found");
    }

    const savedDocuments = [];

    for (const docData of documentsData) {
      const savedDoc = await this.documentRepo.save({
        pharmacyId,
        documentFileId: docData.fileId,
        documentType: docData.documentType,
        documentName: docData.documentName,
        submissionStatus: "submitted"
      });
      savedDocuments.push(savedDoc);
    }

    // Update pharmacy status
    await this.profileRepo.updateVerificationStatus(pharmacyId, "documents_required");
    await this.profileRepo.updateDocumentSubmissionStatus(pharmacyId, true);

    return savedDocuments;
  }

  async getAllPharmacies(options = {}) {
    const { limit = 50, page = 1, verificationStatus } = options;
    const offset = (page - 1) * limit;
    return this.profileRepo.findAll({ limit: Number(limit), offset, verificationStatus });
  }

  async getPharmacyProfile(userId) {
    const pharmacy = await this.profileRepo.findByUserId(userId);
    if (!pharmacy) {
      return null;
    }

    const documents = await this.documentRepo.findByPharmacyId(pharmacy.id);
    pharmacy.documents = documents || [];
    pharmacy.branches = pharmacy.branches || [];
    pharmacy.pricing = await this.pricingRepo.getPricing(pharmacy.id);

    return pharmacy;
  }

  async updatePharmacyProfile(userId, updateData) {
    const pharmacy = await this.profileRepo.findByUserId(userId);
    if (!pharmacy) {
      throw new Error("Pharmacy not found");
    }

    const {
      fullName,
      pharmacyName,
      address,
      phone,
      primaryContactPerson,
      operatingHours,
      description,
      website,
      serviceRadius,
      defaultCurrency,
      notificationPreferences
    } = updateData;

    if (fullName) {
      await this.userRepo.update(userId, { fullName, updatedAt: new Date() });
    }

    const profileUpdates = {
      ...(pharmacyName && { pharmacyName }),
      ...(address && { address }),
      ...(phone && { phone }),
      ...(primaryContactPerson && { primaryContactPerson }),
      ...(operatingHours && { operatingHours }),
      ...(description && { description }),
      ...(website && { website }),
      ...(serviceRadius !== undefined && { serviceRadius }),
      ...(defaultCurrency && { defaultCurrency }),
      ...(notificationPreferences && { notificationPreferences }),
      updatedAt: new Date()
    };

    await this.profileRepo.save({ ...pharmacy, ...profileUpdates });
    return this.getPharmacyProfile(userId);
  }

  async setPricing(userId, pricingData) {
    const pharmacy = await this.profileRepo.findByUserId(userId);
    if (!pharmacy) {
      throw new Error("Pharmacy not found");
    }
    // Accept both a single object and an array
    if (Array.isArray(pricingData)) {
      return Promise.all(pricingData.map(item => this.pricingRepo.setPricing(pharmacy.id, item)));
    }
    return this.pricingRepo.setPricing(pharmacy.id, pricingData);
  }

  async getPricing(userId) {
    const pharmacy = await this.profileRepo.findByUserId(userId);
    if (!pharmacy) {
      throw new Error("Pharmacy not found");
    }
    return this.pricingRepo.getPricing(pharmacy.id);
  }

  async addStaffMember(userId, staffData) {
    const pharmacy = await this.profileRepo.findByUserId(userId);
    if (!pharmacy) {
      throw new Error("Pharmacy not found");
    }
    const { fullName, email, password, role } = staffData;

    const ALLOWED_STAFF_ROLES = ["pharmacist", "assistant", "dispatcher", "pharmacy"];
    if (!role || !ALLOWED_STAFF_ROLES.includes(role)) {
      const err = new Error(`Invalid staff role "${role}". Allowed: ${ALLOWED_STAFF_ROLES.join(", ")}`);
      err.status = 400;
      throw err;
    }

    const existingUser = await this.userRepo.findByEmail(email.toLowerCase().trim());
    if (existingUser) {
      throw new Error("Email already in use");
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const staffUser = await this.userRepo.save({
      fullName,
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      status: "active",
      pharmacyId: pharmacy.id
    });

    // Send welcome email with credentials (non-blocking)
    sendPharmacyStaffWelcomeEmail({
      to: email.toLowerCase().trim(),
      staffName: fullName,
      pharmacyName: pharmacy.pharmacyName,
      role,
      loginEmail: email.toLowerCase().trim(),
      password
    }).catch(err => console.error("Staff welcome email failed:", err));

    return staffUser;
  }

  async getStaffMembers(userId) {
    const pharmacy = await this.profileRepo.findByUserId(userId);
    if (!pharmacy) {
      throw new Error("Pharmacy not found");
    }
    return this.userRepo.repo.find({
      where: { employerPharmacy: { id: pharmacy.id } },
      select: ["id", "fullName", "email", "role", "status", "createdAt"]
    });
  }

  async removeStaffMember(userId, staffUserId) {
    const pharmacy = await this.profileRepo.findByUserId(userId);
    if (!pharmacy) {
      throw new Error("Pharmacy not found");
    }
    const staffUser = await this.userRepo.findById(staffUserId);
    if (!staffUser || staffUser.pharmacyId !== pharmacy.id) {
      throw new Error("Staff user not found or not part of your pharmacy");
    }
    staffUser.pharmacyId = null;
    await this.userRepo.save(staffUser);
    return { success: true, message: "Staff member removed successfully" };
  }
}

module.exports = new PharmacyRegistrationService();
