// src/features/patient/controllers/profileController.js
// Patient profile controller - extracted from userController.js

const userService = require("../services/patientService");
const {
    validatePatientProfile,
    validatePatientProfileUpdate,
} = require("../../../shared/validators/profileValidator");
const profileOptionsService = require("../../../shared/services/profileOptionsService");
const {
    validateManageProfileOptions,
} = require("../../../shared/validators/profileOptionsValidator");

/**
 * Create a new patient profile
 * @route POST /api/patient/profile
 * @legacy POST /user/patient-profile (deprecated)
 */
exports.createProfile = [
    validatePatientProfile,
    async (req, res, next) => {
        try {
            const { fullName, email, ...patientData } = req.body;
            const { sub: id } = req.user;

            const data = {
                fullName,
                email,
                ...patientData,
                user: id ? { id } : undefined,
            };

            const profile = await userService.createPatientProfile(data);

            return res.status(201).json({
                message: "Patient profile created successfully",
                profile: {
                    id: profile.id,
                    fullName: profile.fullName,
                    email: profile.email,
                    profileType: profile.profileType,
                    createdAt: profile.createdAt,
                },
            });
        } catch (err) {
            if (
                err.message === "Email already in use" ||
                err.message === "Patient profile already exists for this user"
            ) {
                return res.status(400).json({ success: false, message: err.message });
            }
            if (err.message === "User not found") {
                return res.status(404).json({ success: false, message: err.message });
            }
            next(err);
        }
    },
];

/**
 * Get patient profile by ID
 * @route GET /api/patient/profile/:id
 * @legacy GET /user/patient-profile/:id (deprecated)
 */
exports.getProfileById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const profile = await userService.getPatientProfileById(id);
        return res.json({
            message: "Patient profile retrieved successfully",
            profile,
        });
    } catch (err) {
        if (err.message === "Patient profile not found") {
            return res.status(404).json({ success: false, message: err.message });
        }
        next(err);
    }
};

/**
 * Get patient profile by user ID
 * @route GET /api/patient/profile/user/:userId
 * @legacy GET /user/patient-profile/user/:userId (deprecated)
 */
exports.getProfileByUserId = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const profile = await userService.getPatientProfileByUserId(userId);
        return res.json({
            message: "Patient profile retrieved successfully",
            profile,
        });
    } catch (err) {
        if (err.message === "Patient profile not found for this user") {
            return res.status(404).json({ success: false, message: err.message });
        }
        next(err);
    }
};

/**
 * Update patient profile
 * @route PUT /api/patient/profile/:id
 * @legacy PUT /user/patient-profile/:id (deprecated)
 */
exports.updateProfile = [
    validatePatientProfileUpdate,
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const data = req.body;
            const profile = await userService.updatePatientProfile(id, data, req);
            return res.json({
                message: "Patient profile updated successfully",
                profile: {
                    id: profile.id,
                    fullName: profile.fullName,
                    email: profile.email,
                    profileType: profile.profileType,
                    updatedAt: profile.updatedAt,
                },
            });
        } catch (err) {
            if (err.message === "Patient profile not found") {
                return res.status(404).json({ success: false, message: err.message });
            }
            next(err);
        }
    },
];

/**
 * Delete patient profile
 * @route DELETE /api/patient/profile/:id
 * @legacy DELETE /user/patient-profile/:id (deprecated)
 */
exports.deleteProfile = async (req, res, next) => {
    try {
        const { id } = req.params;
        await userService.deletePatientProfile(id, req);
        return res.json({ message: "Patient profile deleted successfully" });
    } catch (err) {
        if (err.message === "Patient profile not found") {
            return res.status(404).json({ success: false, message: err.message });
        }
        next(err);
    }
};

/**
 * Get profile options (health record types, etc.)
 * @route GET /api/patient/profile-options
 * @legacy GET /user/profile-options (deprecated)
 */
exports.getProfileOptions = async (req, res, next) => {
    try {
        const options = await profileOptionsService.getProfileOptions();
        return res.status(200).json(options);
    } catch (err) {
        next(err);
    }
};

/**
 * Manage profile options (add/update/delete health records)
 * @route POST /api/patient/profile-options
 * @legacy POST /user/profile-options (deprecated)
 */
exports.manageProfileOptions = [
    validateManageProfileOptions,
    async (req, res, next) => {
        try {
            const results = await profileOptionsService.manageProfileOptions(
                req.body.operations
            );
            return res.status(200).json({ results });
        } catch (err) {
            next(err);
        }
    },
];

/**
 * Update auth/profile info (common user data)
 * @route PUT /api/patient/auth-info
 * @legacy PUT /user/update-auth (deprecated)
 */
exports.updateAuthInfo = async (req, res, next) => {
    try {
        const userId = req.user.sub;
        let { fullName, profileImageUrl, bannerUrl } = req.body;

        if (req.files && req.files.length > 0) {
            const crypto = require('node:crypto');
            const path = require('node:path');
            const fs = require('node:fs').promises;

            const file = req.files[0];
            const ext = path.extname(file.originalname);
            const fileName = `${crypto.randomUUID()}${ext}`;

            const uploadDir = process.env.UPLOAD_DIRECTORY ||
                (process.env.NODE_ENV === 'production' ? '/app/uploads' : path.join(__dirname, '../../../../uploads'));
            const imagesDir = path.join(uploadDir, 'images');
            await fs.mkdir(imagesDir, { recursive: true });
            await fs.writeFile(path.join(imagesDir, fileName), file.buffer);

            const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
            profileImageUrl = `${baseUrl}/uploads/images/${fileName}`;
        }

        if (!fullName && !profileImageUrl && !bannerUrl) {
            return res.status(400).json({
                success: false,
                message: "At least one field (fullName, profileImageUrl, bannerUrl) or a file is required"
            });
        }

        const updatedUser = await userService.updateAuthInfo(userId, {
            fullName,
            profileImageUrl,
            bannerUrl
        });

        return res.json({
            success: true,
            data: updatedUser,
            message: "Authentication information updated successfully"
        });
    } catch (err) {
        next(err);
    }
};
