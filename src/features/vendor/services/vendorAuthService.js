const bcrypt                  = require("bcryptjs");
const AppDataSource           = require("../../../config/database");
const vendorRepository        = require("../repositories/vendorRepository");
const verificationService     = require("../../auth/services/verificationService");
const referralService         = require("../../auth/services/referralService");
const userRepository          = require("../../auth/repositories/userRepository");

class VendorAuthService {
    async registerVendor(data) {
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
            countryCode,
        } = data;

        const normalizedEmail         = email.toLowerCase().trim();
        const normalizedBusinessEmail = businessEmail.toLowerCase().trim();

        const existingUser = await userRepository.findByEmailAndRole(normalizedEmail, 'vendor');
        if (existingUser) throw new Error("Email already in use");

        const existingVendorEmail = await vendorRepository.findByBusinessEmail(normalizedBusinessEmail);
        if (existingVendorEmail) throw new Error("Business email already registered");

        const passwordHash = await bcrypt.hash(password, 12);

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        let savedUser, savedVendor;

        try {
            savedUser = await queryRunner.manager.save("User", {
                fullName,
                email: normalizedEmail,
                passwordHash,
                phoneNumber: phoneNumber || null,
                role: "vendor",
                status: "pending_email_verification",
                country: countryCode || null,
            });

            savedVendor = await queryRunner.manager.save("VendorProfile", {
                userId: savedUser.id,
                businessName,
                businessCategory,
                businessEmail: normalizedBusinessEmail,
                businessPhone,
                country,
                state,
                city,
                fullAddress,
                businessWebsite: businessWebsite || null,
                businessDescription,
                verificationStatus: "pending",
                isActive: false,
                documentsSubmitted: false,
                isHybridPharmacy: false,
            });

            await queryRunner.manager.save("VendorVerificationRequest", {
                vendorId: savedVendor.id,
                requestType: "initial_verification",
                status: "pending",
                priority: "medium",
                requestNotes: "Initial vendor registration",
                submittedAt: new Date(),
            });

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            if (err.code === "23505") {
                if (err.detail?.includes("email"))        throw new Error("Email already in use");
                if (err.detail?.includes("businessEmail")) throw new Error("Business email already registered");
            }
            throw err;
        } finally {
            await queryRunner.release();
        }

        let emailSent = true;
        try {
            await verificationService.sendEmailVerification(savedUser);
        } catch (mailErr) {
            console.error("Vendor email verification send failed:", mailErr);
            emailSent = false;
        }

        try {
            await referralService.createReferralCode(savedUser.id);
        } catch {
            // Referral code creation is non-critical
        }

        return { user: savedUser, vendor: savedVendor, emailSent };
    }

    async getVendorProfile(userId) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const user = await userRepository.findById(userId);

        return { vendor, user };
    }

    async updateVendorProfile(userId, updateData) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const allowedFields = [
            "businessName",
            "businessPhone",
            "country",
            "state",
            "city",
            "fullAddress",
            "businessWebsite",
            "businessDescription",
            "notificationPreferences",
        ];

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                vendor[field] = updateData[field];
            }
        }

        const repo = AppDataSource.getRepository("VendorProfile");
        const updated = await repo.save(vendor);

        if (updateData.fullName) {
            await AppDataSource.getRepository("User").update(userId, { fullName: updateData.fullName });
        }

        return updated;
    }

    async uploadVendorLogo(userId, logoUrl) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        await AppDataSource.getRepository("VendorProfile").update(vendor.id, { logoUrl });
        await AppDataSource.getRepository("User").update(userId, { profileImageUrl: logoUrl });

        return { logoUrl };
    }

    async uploadDocuments(userId, documents) {
        const vendor = await vendorRepository.findByUserId(userId);
        if (!vendor) throw new Error("Vendor profile not found");

        const saved = await Promise.all(
            documents.map((doc) =>
                vendorRepository.saveDocument({
                    vendorId: vendor.id,
                    documentType: doc.documentType,
                    documentUrl: doc.documentUrl,
                    fileName: doc.fileName || null,
                    mimeType: doc.mimeType || null,
                })
            )
        );

        await AppDataSource.getRepository("VendorProfile").update(vendor.id, {
            documentsSubmitted: true,
            verificationStatus: "documents_required",
        });

        return saved;
    }

    async getAllVendors(options) {
        return vendorRepository.findAllPaginated(options);
    }
}

module.exports = new VendorAuthService();
