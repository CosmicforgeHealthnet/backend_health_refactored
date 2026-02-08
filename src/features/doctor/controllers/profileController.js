// src/features/doctor/controllers/profileController.js
// Doctor profile controller - extracted from userController.js

const userService = require("../services/doctorService");
const {
    validateDoctorProfile,
    validateDoctorProfileUpdate,
} = require("../../../shared/validators/profileValidator");

/**
 * Create a new doctor profile
 * @route POST /api/doctor/profile
 * @legacy POST /user/doctor-profile (deprecated)
 */
exports.createProfile = [
    validateDoctorProfile,
    async (req, res, next) => {
        try {
            const { fullName, email, ...doctorData } = req.body;
            const { sub: id } = req.user;

            const data = {
                fullName,
                email,
                ...doctorData,
                user: id ? { id } : undefined,
            };

            const profile = await userService.createDoctorProfile(data);

            return res.status(201).json({
                message: "Doctor profile created successfully",
                profile: {
                    id: profile.id,
                    fullName: profile.fullName,
                    email: profile.email,
                    createdAt: profile.createdAt,
                },
            });
        } catch (err) {
            if (
                err.message === "Email already in use" ||
                err.message === "Doctor profile already exists for this user"
            ) {
                return res.status(400).json({ error: err.message });
            }
            if (err.message === "User not found") {
                return res.status(404).json({ error: err.message });
            }
            next(err);
        }
    },
];

/**
 * Get doctor profile by ID
 * @route GET /api/doctor/profile/:id
 * @legacy GET /user/doctor-profile/:id (deprecated)
 */
exports.getProfileById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const profile = await userService.getDoctorProfileById(id);
        return res.json({
            message: "Doctor profile retrieved successfully",
            profile,
        });
    } catch (err) {
        if (err.message === "Doctor profile not found") {
            return res.status(404).json({ error: err.message });
        }
        next(err);
    }
};

/**
 * Get doctor profile by user ID
 * @route GET /api/doctor/profile/user/:userId
 * @legacy GET /user/doctor-profile/user/:userId (deprecated)
 */
exports.getProfileByUserId = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const profile = await userService.getDoctorProfileByUserId(userId);
        return res.json({
            message: "Doctor profile retrieved successfully",
            profile,
        });
    } catch (err) {
        if (err.message === "Doctor profile not found for this user") {
            return res.status(404).json({ error: err.message });
        }
        next(err);
    }
};

/**
 * Update doctor profile
 * @route PUT /api/doctor/profile/:id
 * @legacy PUT /user/doctor-profile/:id (deprecated)
 */
exports.updateProfile = [
    validateDoctorProfileUpdate,
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const data = req.body;

            const profile = await userService.updateDoctorProfile(id, data, req);
            return res.json({
                message: "Doctor profile updated successfully",
                profile: {
                    id: profile.id,
                    fullName: profile.fullName,
                    email: profile.email,
                    updatedAt: profile.updatedAt,
                },
            });
        } catch (err) {
            if (err.message === "Doctor profile not found") {
                return res.status(404).json({ error: err.message });
            }
            next(err);
        }
    },
];

/**
 * Delete doctor profile
 * @route DELETE /api/doctor/profile/:id
 * @legacy DELETE /user/doctor-profile/:id (deprecated)
 */
exports.deleteProfile = async (req, res, next) => {
    try {
        const { id } = req.params;
        await userService.deleteDoctorProfile(id, req);
        return res.json({ message: "Doctor profile deleted successfully" });
    } catch (err) {
        if (err.message === "Doctor profile not found") {
            return res.status(404).json({ error: err.message });
        }
        next(err);
    }
};

/**
 * Get all doctors
 * @route GET /api/doctor/list
 * @legacy GET /user/doctors (deprecated)
 */
exports.getAllDoctors = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const result = await userService.getAllDoctors({ page, limit });
        return res.json({
            success: true,
            data: result.data,
            meta: result.meta,
            message: "Doctors retrieved successfully",
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get all doctors with complete profiles
 * @route GET /api/doctor/list/complete
 * @legacy GET /user/doctors/complete (deprecated)
 */
exports.getAllDoctorsWithCompleteProfile = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const result = await userService.getAllDoctorsWithCompleteProfile({ page, limit });
        return res.json({
            success: true,
            data: result.data,
            meta: result.meta,
            message: "Doctors with completed profile retrieved successfully",
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get all verified doctors
 * @route GET /api/doctor/list/verified
 * @legacy GET /user/doctors/verified (deprecated)
 */
exports.getAllVerifiedDoctors = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const result = await userService.getAllVerifiedDoctors({ page, limit });
        return res.json({
            success: true,
            data: result.data,
            meta: result.meta,
            message: "Doctors with completed verification retrieved successfully",
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get a specific doctor
 * @route GET /api/doctor/:userId
 * @legacy GET /user/doctor/:userId (deprecated)
 */
exports.getDoctor = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const doctor = await userService.getADoctor(userId);
        return res.json({
            success: true,
            data: doctor,
            message: "Doctor retrieved successfully",
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get doctors by online status
 * @route GET /api/doctor/list/online
 * @legacy GET /user/doctors/online (deprecated)
 */
exports.getDoctorsByOnlineStatus = async (req, res, next) => {
    try {
        const { isOnline } = req.query;
        if (isOnline === undefined) {
            return res
                .status(400)
                .json({ error: "isOnline query parameter is required" });
        }
        const isOnlineBool = isOnline === "true";
        const doctors = await userService.getDoctorsByOnlineStatus(isOnlineBool);
        return res.json({
            success: true,
            data: doctors,
            message: `Online doctors retrieved successfully`,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Search doctors
 * @route GET /api/doctor/search
 * @legacy GET /user/doctors/search (deprecated)
 */
exports.searchDoctors = async (req, res, next) => {
    try {
        const q = req.query.q || req.query.search;
        if (!q) {
            return res.status(400).json({ error: "Search query (q or search) is required" });
        }
        const doctors = await userService.searchDoctors(q);
        return res.json({
            success: true,
            data: doctors,
            message: "Search results retrieved successfully",
        });
    } catch (err) {
        if (err.message === "Search query must be at least 3 characters long") {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

/**
 * Update doctor online status
 * @route PUT /api/doctor/status
 * @legacy PUT /user/doctor/online-status (deprecated)
 */
exports.updateOnlineStatus = async (req, res, next) => {
    try {
        const { sub: userId } = req.user;
        const { isOnline } = req.body;
        if (!userId || isOnline === undefined) {
            return res
                .status(400)
                .json({ error: "userId and isOnline are required" });
        }
        const result = await userService.updateOnlineStatus(
            userId,
            isOnline,
            req.user
        );
        return res.json({
            success: true,
            data: result,
            message: "Online status updated successfully",
        });
    } catch (err) {
        if (
            err.message === "User not found" ||
            err.message === "User must be a doctor" ||
            err.message.includes("Unauthorized")
        ) {
            return res.status(403).json({ error: err.message });
        }
        next(err);
    }
};

/**
 * Get doctor online status
 * @route GET /api/doctor/:userId/status
 * @legacy GET /user/doctor/:userId/online-status (deprecated)
 */
exports.getOnlineStatus = async (req, res, next) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }
        const result = await userService.getDoctorOnlineStatus(userId);
        return res.json({
            success: true,
            data: result,
            message: "Online status retrieved successfully",
        });
    } catch (err) {
        if (
            err.message === "User not found" ||
            err.message === "User must be a doctor"
        ) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

/**
 * Update auth/profile info (for doctors)
 * @route PUT /api/doctor/auth-info
 * @legacy PUT /user/update-auth (deprecated)
 */
exports.updateAuthInfo = async (req, res, next) => {
    try {
        const userId = req.user.sub;
        const { fullName, profileImageUrl, bannerUrl, departmentSpecialty } =
            req.body;
        if ((!fullName && !profileImageUrl && !bannerUrl && !departmentSpecialty)) {
            return res.status(400).json({
                error:
                    "At least one field (fullName, profileImageUrl, bannerUrl, departmentSpecialty) is required",
            });
        }
        const updatedUser = await userService.updateAuthInfo(userId, {
            fullName,
            profileImageUrl,
            bannerUrl,
            departmentSpecialty,
        });
        return res.json({
            success: true,
            data: updatedUser,
            message: "Authentication information updated successfully",
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Add rating to a user (doctor)
 * @route POST /api/doctor/rating
 * @legacy POST /user/rating (deprecated)
 */
exports.addRating = async (req, res, next) => {
    try {
        const id = req.user.sub;
        const { userId, rating, message } = req.body;
        const response = await userService.addUserRating(id, userId, rating, message);
        return res.json({
            success: true,
            data: response,
            message: "Rating added successfully"
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

/**
 * Get user ratings
 * @route GET /api/doctor/:userId/ratings
 * @legacy GET /user/:userId/ratings (deprecated)
 */
exports.getRatings = async (req, res, next) => {
    try {
        const userId = req.params.userId;
        const response = await userService.getUserRatings(userId);
        return res.json({
            success: true,
            data: response,
            message: "Ratings retrieved successfully"
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};
