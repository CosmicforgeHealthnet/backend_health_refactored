const userRepository = require("../../auth/repositories/userRepository");
const doctorProfileRepository = require("../repositories/doctorProfileRepository");
const { USER_ROLES } = require("../../../shared/utils/constants");
const cache = require("../../../shared/utils/cache");
const AppDataSource = require("../../../config/database");
const DoctorProfile = require("../entities/DoctorProfile");
const ProfessionalLicense = require("../entities/ProfessionalLicense");
const ProfessionalCertificate = require("../entities/ProfessionalCertificate");
const ClinicalPractice = require("../entities/ClinicalPractice");
const DigitalHealthTools = require("../entities/DigitalHealthTools");
const DoctorWallet = require("../entities/DoctorWallet");

class DoctorService {
    async createDoctorProfile(data) {
        if (data.user && (await doctorProfileRepository.findByUserId(data.user.id))) {
            throw new Error("Doctor profile already exists for this user");
        }

        let user;
        if (data.user) {
            user = await userRepository.findById(data.user.id);
            if (!user) throw new Error("User not found");
        } else if (data.email) {
            user = userRepository.create({ email: data.email, fullName: data.fullName });
            user = await userRepository.save(user);
        } else {
            throw new Error("User ID or email is required");
        }

        const doctorProfileData = {
            profilePhoto: data.profilePhoto,
            fullName: data.fullName,
            gender: data.gender,
            dateOfBirth: data.dateOfBirth,
            nationality: data.nationality,
            contactNumber: data.contactNumber,
            email: data.email,
            residentialAddress: data.residentialAddress,
            user,
        };

        // The profile and its sub-records (license, certificates, clinical
        // practice, tools, wallet) are all part of the same submission, so they
        // must land together. Previously they were saved one at a time with no
        // transaction — if a sub-record save failed (e.g. a bad license field),
        // the profile itself stayed committed, and the client's retry was
        // blocked by the "Doctor profile already exists for this user" check
        // above even though the submission never fully succeeded.
        return await AppDataSource.transaction(async (manager) => {
            const savedProfile = await manager.getRepository(DoctorProfile).save(doctorProfileData);

            if (data.professionalLicense) {
                await manager.getRepository(ProfessionalLicense).save({
                    ...data.professionalLicense,
                    doctorProfile: savedProfile,
                });
            }

            if (data.professionalCertificate && Array.isArray(data.professionalCertificate)) {
                for (const certificate of data.professionalCertificate) {
                    await manager.getRepository(ProfessionalCertificate).save({
                        ...certificate,
                        doctorProfile: savedProfile,
                    });
                }
            }

            if (data.clinicalPractice) {
                await manager.getRepository(ClinicalPractice).save({
                    ...data.clinicalPractice,
                    doctorProfile: savedProfile,
                });
            }

            if (data.digitalHealthTools) {
                await manager.getRepository(DigitalHealthTools).save({
                    ...data.digitalHealthTools,
                    doctorProfile: savedProfile,
                });
            }

            if (data.wallet) {
                await manager.getRepository(DoctorWallet).save({
                    ...data.wallet,
                    doctorProfile: savedProfile,
                });
            }

            return savedProfile;
        });
    }

    async getDoctorProfileById(id) {
        const profile = await doctorProfileRepository.findById(id);
        if (!profile) throw new Error("Doctor profile not found");
        return profile;
    }

    async getDoctorProfileByUserId(userId) {
        const profile = await doctorProfileRepository.findByUserId(userId);
        if (!profile) throw new Error("Doctor profile not found for this user");
        return profile;
    }

    async updateDoctorProfile(id, data, req) {
        const checkownerprofile = await this.getDoctorProfileByUserId(req.user.sub);
        const profile = await doctorProfileRepository.findById(id);

        if (!checkownerprofile || !profile || checkownerprofile.id != profile.id) {
            throw new Error("Doctor profile not found");
        }

        const updateData = {
            profilePhoto: data.profilePhoto,
            fullName: data.fullName,
            gender: data.gender,
            dateOfBirth: data.dateOfBirth,
            nationality: data.nationality,
            contactNumber: data.contactNumber,
            email: data.email,
            residentialAddress: data.residentialAddress,
        };

        Object.keys(updateData).forEach(
            (key) => updateData[key] === undefined && delete updateData[key]
        );

        // Deep sanitize to remove "undefined" strings and handle empty strings for DB types
        const sanitize = (val) => {
            if (val === "undefined" || val === "null" || val === "") return undefined;
            return val;
        };


        if (data.professionalLicense) {
            const license = { ...data.professionalLicense };
            // Sanitize all fields
            Object.keys(license).forEach(key => {
                license[key] = sanitize(license[key]);
            });

            const existingLicense = await doctorProfileRepository.professionalLicenseRepo.findOne({
                where: { doctorProfile: { id } },
            });

            if (existingLicense) {
                await doctorProfileRepository.professionalLicenseRepo.update(existingLicense.id, license);
            } else {
                // For new licenses, ensure mandatory fields have fallbacks to avoid NOT NULL constraint violations
                if (!license.countryOfLicense) {
                    license.countryOfLicense = "Not Specified";
                }
                if (!license.medicalLicenseNumber) {
                    license.medicalLicenseNumber = "Not Specified";
                }
                if (!license.licenseAuthority) {
                    license.licenseAuthority = "Not Specified";
                }
                if (!license.medicalInstitution) {
                    license.medicalInstitution = "Not Specified";
                }
                await doctorProfileRepository.professionalLicenseRepo.save({
                    ...license,
                    doctorProfile: { id },
                });
            }

        }

        if (data.professionalCertificate && Array.isArray(data.professionalCertificate)) {
            await doctorProfileRepository.professionalCertificateRepo.delete({
                doctorProfile: { id },
            });
            for (const certificate of data.professionalCertificate) {
                const sanitizedCert = { ...certificate };
                Object.keys(sanitizedCert).forEach(key => {
                    sanitizedCert[key] = sanitize(sanitizedCert[key]);
                });
                await doctorProfileRepository.professionalCertificateRepo.save({
                    ...sanitizedCert,
                    doctorProfile: { id },
                });
            }
        }


        if (data.clinicalPractice) {
            const practice = { ...data.clinicalPractice };
            Object.keys(practice).forEach(key => {
                practice[key] = sanitize(practice[key]);
            });

            const existingPractice = await doctorProfileRepository.clinicalPracticeRepo.findOne({
                where: { doctorProfile: { id } },
            });
            if (existingPractice) {
                await doctorProfileRepository.clinicalPracticeRepo.update(existingPractice.id, practice);
            } else {
                await doctorProfileRepository.clinicalPracticeRepo.save({
                    ...practice,
                    doctorProfile: { id },
                });
            }
        }

        if (data.digitalHealthTools) {
            const tools = { ...data.digitalHealthTools };
            Object.keys(tools).forEach(key => {
                tools[key] = sanitize(tools[key]);
            });

            const existingTools = await doctorProfileRepository.digitalHealthToolsRepo.findOne({
                where: { doctorProfile: { id } },
            });
            if (existingTools) {
                await doctorProfileRepository.digitalHealthToolsRepo.update(existingTools.id, tools);
            } else {
                await doctorProfileRepository.digitalHealthToolsRepo.save({
                    ...tools,
                    doctorProfile: { id },
                });
            }
        }

        if (data.wallet) {
            const wallet = { ...data.wallet };
            Object.keys(wallet).forEach(key => {
                wallet[key] = sanitize(wallet[key]);
            });

            const existingWallet = await doctorProfileRepository.walletRepo.findOne({
                where: { doctorProfile: { id } },
            });
            if (existingWallet) {
                await doctorProfileRepository.walletRepo.update(existingWallet.id, wallet);
            } else {
                await doctorProfileRepository.walletRepo.save({
                    ...wallet,
                    doctorProfile: { id },
                });
            }
        }


        const updatedProfile = await doctorProfileRepository.update(id, updateData);

        // Invalidate doctor cache
        await cache.invalidatePattern('doctors:*');
        await cache.del(`doctor:${checkownerprofile.user ? checkownerprofile.user.id : 'unknown'}`);
        await cache.del(`doctor:${id}`);

        return updatedProfile;
    }

    async deleteDoctorProfile(id, req) {
        const checkownerprofile = await this.getDoctorProfileByUserId(req.user.sub);
        const profile = await doctorProfileRepository.findById(id);

        if (!checkownerprofile || !profile || checkownerprofile.id != profile.id) {
            throw new Error("Doctor profile not found");
        }
        await doctorProfileRepository.delete(id);
    }

    // --- Doctor Search & Status Methods ---

    async getAllDoctors({ page = 1, limit = 10 } = {}) {
        return cache.getOrSet(
            `doctors:all:page:${page}:limit:${limit}`,
            async () => {
                const skip = (page - 1) * limit;
                const take = limit;
                const result = await userRepository.findAllDoctors({ skip, take });

                return {
                    data: result.doctors,
                    meta: {
                        total: result.total,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(result.total / limit)
                    }
                };
            },
            300 // 5 minutes TTL
        );
    }

    async getAllDoctorsWithCompleteProfile({ page = 1, limit = 10 } = {}) {
        return cache.getOrSet(
            `doctors:complete:page:${page}:limit:${limit}`,
            async () => {
                const skip = (page - 1) * limit;
                const take = limit;
                const result = await userRepository.findAllCompleteProfileDoctors({ skip, take });

                return {
                    data: result.doctors.map(withBookableFlag),
                    meta: {
                        total: result.total,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(result.total / limit)
                    }
                };
            },
            300 // 5 minutes TTL
        );
    }

    async getAllVerifiedDoctors({ page = 1, limit = 10 } = {}) {
        return cache.getOrSet(
            `doctors:verified:page:${page}:limit:${limit}`,
            async () => {
                const skip = (page - 1) * limit;
                const take = limit;
                const result = await userRepository.findVerifiedDoctors({ skip, take });

                return {
                    data: result.doctors.map(withBookableFlag),
                    meta: {
                        total: result.total,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(result.total / limit)
                    }
                };
            },
            300 // 5 minutes TTL
        );
    }

    async getADoctor(userId) {
        return cache.getOrSet(
            `doctor:${userId}`,
            async () => userRepository.findADoctor(userId),
            600 // 10 minutes TTL
        );
    }

    async getDoctorsByOnlineStatus(isOnline) {
        return userRepository.findDoctorsByOnlineStatus(isOnline);
    }

    async searchDoctors(query) {
        if (!query || query.length < 3) {
            throw new Error("Search query must be at least 3 characters long");
        }
        return userRepository.searchDoctors(query);
    }

    async updateAuthInfo(userId, { fullName, profileImageUrl, bannerUrl, departmentSpecialty }) {
        const updates = { fullName, profileImageUrl, bannerUrl, departmentSpecialty };
        await userRepository.updateAuthInfo(userId, updates);
        const updatedUser = await userRepository.findById(userId);
        return {
            id: updatedUser.id,
            fullName: updatedUser.fullName,
            email: updatedUser.email,
            role: updatedUser.role,
            status: updatedUser.status,
            provider: updatedUser.provider,
            profileImageUrl: updatedUser.profileImageUrl,
            bannerUrl: updatedUser.bannerUrl,
            departmentSpecialty: updatedUser.departmentSpecialty,
            mfaEnabled: updatedUser.mfaEnabled,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt
        };
    }

    async updateOnlineStatus(userId, isOnline, requestingUser) {
        const user = await userRepository.findById(userId);
        if (!user) throw new Error("User not found");

        if (user.role !== USER_ROLES.DOCTOR) {
            throw new Error("User must be a doctor");
        }
        if (
            requestingUser.sub !== userId &&
            requestingUser.role !== USER_ROLES.ADMIN &&
            requestingUser.role !== USER_ROLES.SUPER_ADMIN
        ) {
            throw new Error("Unauthorized: Only the doctor or an admin can update online status");
        }
        if (isOnline && user.status !== "doctor_active") {
            throw new Error("Account must be fully verified before going online");
        }
        await userRepository.updateOnlineStatus(userId, isOnline);

        // Invalidate specific doctor cache and lists
        await cache.del(`doctor:${userId}`);
        await cache.invalidatePattern('doctors:*'); // Status change affects lists

        return { id: userId, isOnline };
    }

    async getDoctorOnlineStatus(userId) {
        const user = await userRepository.getOnlineStatus(userId);
        if (!user) throw new Error("User not found");
        return { id: user.id, isOnline: user.isOnline };
    }

    async isDoctorVerified(doctorId) {
        return await userRepository.isDoctorVerified(doctorId);
    }

    async addUserRating(id, userId, rating, message) {
        if (id == userId) throw new Error("user's can't rate themselves");
        return await userRepository.addUserRating(userId, rating, message);
    }

    async getUserRatings(userId) {
        return await userRepository.getUserRatings(userId);
    }
}

// Verified doctors are now listed even before they've set pricing/availability
// (see userRepository.findVerifiedDoctors) — this flag lets the frontend tell
// patients "booking not yet available" instead of showing a broken/empty
// price and schedule for a doctor who technically can't be booked yet.
function withBookableFlag(doctor) {
    doctor.isBookable = (doctor.doctorPricing?.length > 0) && (doctor.doctorAvailability?.length > 0);
    return doctor;
}

module.exports = new DoctorService();
