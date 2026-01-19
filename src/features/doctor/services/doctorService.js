const userRepository = require("../../auth/repositories/userRepository");
const doctorProfileRepository = require("../repositories/doctorProfileRepository");
const { USER_ROLES } = require("../../../shared/utils/constants");

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

        const doctorProfile = await doctorProfileRepository.create(doctorProfileData);
        const savedProfile = await doctorProfileRepository.save(doctorProfile);

        // Save related entities
        if (data.professionalLicense) {
            await doctorProfileRepository.professionalLicenseRepo.save({
                ...data.professionalLicense,
                doctorProfile: savedProfile,
            });
        }

        if (data.professionalCertificate && Array.isArray(data.professionalCertificate)) {
            for (const certificate of data.professionalCertificate) {
                await doctorProfileRepository.professionalCertificateRepo.save({
                    ...certificate,
                    doctorProfile: savedProfile,
                });
            }
        }

        if (data.clinicalPractice) {
            await doctorProfileRepository.clinicalPracticeRepo.save({
                ...data.clinicalPractice,
                doctorProfile: savedProfile,
            });
        }

        if (data.digitalHealthTools) {
            await doctorProfileRepository.digitalHealthToolsRepo.save({
                ...data.digitalHealthTools,
                doctorProfile: savedProfile,
            });
        }

        if (data.wallet) {
            await doctorProfileRepository.walletRepo.save({
                ...data.wallet,
                doctorProfile: savedProfile,
            });
        }

        return savedProfile;
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

        if (data.professionalLicense) {
            await doctorProfileRepository.professionalLicenseRepo.delete({ doctorProfile: { id } });
            await doctorProfileRepository.professionalLicenseRepo.save({ ...data.professionalLicense, doctorProfile: { id } });
        }

        if (data.professionalCertificate && Array.isArray(data.professionalCertificate)) {
            await doctorProfileRepository.professionalCertificateRepo.delete({ doctorProfile: { id } });
            for (const certificate of data.professionalCertificate) {
                await doctorProfileRepository.professionalCertificateRepo.save({ ...certificate, doctorProfile: { id } });
            }
        }

        if (data.clinicalPractice) {
            await doctorProfileRepository.clinicalPracticeRepo.delete({ doctorProfile: { id } });
            await doctorProfileRepository.clinicalPracticeRepo.save({ ...data.clinicalPractice, doctorProfile: { id } });
        }

        if (data.digitalHealthTools) {
            await doctorProfileRepository.digitalHealthToolsRepo.delete({ doctorProfile: { id } });
            await doctorProfileRepository.digitalHealthToolsRepo.save({ ...data.digitalHealthTools, doctorProfile: { id } });
        }

        if (data.wallet) {
            await doctorProfileRepository.walletRepo.delete({ doctorProfile: { id } });
            await doctorProfileRepository.walletRepo.save({ ...data.wallet, doctorProfile: { id } });
        }

        return await doctorProfileRepository.update(id, updateData);
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

    async getAllDoctors() {
        return userRepository.findAllDoctors();
    }

    async getAllDoctorsWithCompleteProfile() {
        return userRepository.findAllCompleteProfileDoctors();
    }

    async getAllVerifiedDoctors() {
        return userRepository.findVerifiedDoctors();
    }

    async getADoctor(userId) {
        return userRepository.findADoctor(userId);
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
        await userRepository.updateOnlineStatus(userId, isOnline);
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

module.exports = new DoctorService();
