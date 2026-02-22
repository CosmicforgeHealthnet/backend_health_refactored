// src/services/pharmacy/pharmacyRegistrationService.js
const pharmacyProfileRepo = require("../repositories/pharmacyProfileRepository");
const pharmacyDocumentRepo = require("../repositories/pharmacyDocumentRepository");
const pharmacyVerificationRepo = require("../repositories/pharmacyVerificationRepository");
const userRepo = require("../../auth/repositories/userRepository");
const bcrypt = require('bcryptjs');
const verificationService = require('../../auth/services/verificationService'); // Assuming this is still in global services or moved
const referralService = require('../../auth/services/referralService'); // Pending refactor to auth

class PharmacyRegistrationService {
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
      preferredUsername
    } = registrationData;


    console.log('🔍 DEBUG - Raw email from request:', email);
    console.log('🔍 DEBUG - Email type:', typeof email);
    console.log('🔍 DEBUG - Email length:', email?.length);

    const normalizedEmail = email.toLowerCase().trim();
    console.log('🔍 DEBUG - Normalized email:', normalizedEmail);

    // Check if user email exists
    console.log('🔍 DEBUG - About to call userRepo.findByEmail...');
    const existingUser = await userRepo.findByEmail(normalizedEmail);
    console.log('🔍 DEBUG - userRepo.findByEmail result:', existingUser);

    if (existingUser) {
      console.log('🔍 DEBUG - Found user details:', {
        id: existingUser.id,
        email: existingUser.email,
        createdAt: existingUser.createdAt
      });
      throw new Error("Email already in use");
    }

    // Check if username exists
    const existingUsername = await pharmacyProfileRepo.findByUsername(preferredUsername);
    if (existingUsername) {
      throw new Error("Username already taken");
    }

    // Check if registration number exists
    const existingRegistration = await pharmacyProfileRepo.findByRegistrationNumber(registrationNumber);
    if (existingRegistration) {
      throw new Error("Registration number already exists");
    }

    // Create and save user
    const passwordHash = await bcrypt.hash(password, 12);
    const savedUser = await userRepo.save({
      fullName,
      email: normalizedEmail,
      passwordHash,
      role: "pharmacy",
      status: "pending_email_verification"
    });

    // Create pharmacy profile
    const savedPharmacy = await pharmacyProfileRepo.save({
      userId: savedUser.id,
      pharmacyName,
      registrationNumber,
      address,
      phone,
      primaryContactPerson,
      email: normalizedEmail,
      preferredUsername,
      verificationStatus: "pending",
      documentsSubmitted: false
    });

    // Create initial verification request
    await pharmacyVerificationRepo.save({
      pharmacyId: savedPharmacy.id,
      requestType: "initial_verification",
      status: "pending",
      priority: "medium",
      requestNotes: "Initial pharmacy registration"
    });



    // Send verification email (non-blocking)
    let emailSent = true;
    try {
      await verificationService.sendEmailVerification(savedUser);
    } catch (mailErr) {
      console.error("💥 Email verification failed:", mailErr);
      emailSent = false;
    }

    // Create referral code
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
    console.log('DEBUG - pharmacyId received:', pharmacyId);
    console.log('DEBUG - documentsData:', documentsData);

    const pharmacy = await pharmacyProfileRepo.findById(pharmacyId);
    console.log('DEBUG - pharmacy found:', pharmacy);
    if (!pharmacy) {
      throw new Error("Pharmacy not found");
    }

    const savedDocuments = [];

    for (const docData of documentsData) {
      const document = pharmacyDocumentRepo.create({
        pharmacyId,
        documentFileId: docData.fileId,
        documentType: docData.documentType,
        documentName: docData.documentName,
        submissionStatus: "submitted"
      });

      const savedDoc = await pharmacyDocumentRepo.save({
        pharmacyId,
        documentFileId: docData.fileId,
        documentType: docData.documentType,
        documentName: docData.documentName,
        submissionStatus: "submitted"
      });
      savedDocuments.push(savedDoc);
    }

    // Update pharmacy status
    await pharmacyProfileRepo.updateVerificationStatus(pharmacyId, "documents_required");
    await pharmacyProfileRepo.updateDocumentSubmissionStatus(pharmacyId, true);

    return savedDocuments;
  }

  async getPharmacyProfile(userId) {
    // Get pharmacy profile with all relations
    const pharmacy = await pharmacyProfileRepo.findByUserId(userId);
    if (!pharmacy) {
      return null;
    }

    // Get documents separately if not included in relations
    const documents = await pharmacyDocumentRepo.findByPharmacyId(pharmacy.id);

    // Attach documents to pharmacy object
    pharmacy.documents = documents || [];
    pharmacy.branches = pharmacy.branches || [];

    return pharmacy;
  }
}

module.exports = new PharmacyRegistrationService();