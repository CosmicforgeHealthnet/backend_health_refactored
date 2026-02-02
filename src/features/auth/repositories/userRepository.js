const AppDataSource = require("../../../config/database");
const User = require("../entities/User");
const { USER_ROLES } = require("../../../shared/utils/constants");
const UserRating = require("../../doctor/entities/UserRatings");

class UserRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(User);
    this.ratingRepo = AppDataSource.getRepository(UserRating);
  }

  findByEmail(email) {
    return this.repo.findOne({ where: { email } });
  }

  create(data) {
    return this.repo.create(data);
  }

  save(user) {
    return this.repo.save(user);
  }

  findById(id) {
    return this.repo.findOne({ where: { id } });
  }

  findByProvider(provider, providerId) {
    return this.repo.findOne({
      where: { provider, providerId },
    });
  }

  // New method to fetch all doctors
  async findAllDoctors({ skip, take } = {}) {
    const [doctors, total] = await this.repo.findAndCount({
      where: { role: USER_ROLES.DOCTOR },
      select: [
        "id",
        "fullName",
        "email",
        "status",
        "isOnline",
        "profileImageUrl",
        "departmentSpecialty",
        "averageRating",
        "totalRatings",
        "createdAt",
        "updatedAt",
      ],
      relations: [
        "doctorProfile",
        "doctorProfile.professionalLicense",
        "doctorProfile.professionalCertificate",
        "doctorProfile.clinicalPractice",
        "doctorProfile.digitalHealthTools",
        "doctorPricing",
        "doctorAvailability",
        "doctorUnavailability",
        "ratings"
      ],
      skip,
      take,
      order: { createdAt: "DESC" }
    });

    return { doctors, total };
  }

  async findAllCompleteProfileDoctors({ skip, take } = {}) {
    const query = this.repo
      .createQueryBuilder("user")
      .select([
        "user.id",
        "user.fullName",
        "user.email",
        "user.status",
        "user.isOnline",
        "user.profileImageUrl",
        "user.departmentSpecialty",
        "user.averageRating",
        "user.totalRatings",
        "user.createdAt",
        "user.updatedAt",
      ])
      .addSelect("doctorProfile")
      .addSelect("professionalLicense")
      .addSelect("professionalCertificate")
      .addSelect("clinicalPractice")
      .addSelect("digitalHealthTools")
      .addSelect("doctorPricing")
      .addSelect("doctorAvailability")
      .innerJoin("user.doctorProfile", "doctorProfile")
      .leftJoin("doctorProfile.professionalLicense", "professionalLicense")
      .innerJoin(
        "doctorProfile.professionalCertificate",
        "professionalCertificate"
      )
      .innerJoin("doctorProfile.clinicalPractice", "clinicalPractice")
      .innerJoin("doctorProfile.digitalHealthTools", "digitalHealthTools")
      .innerJoin("user.doctorPricing", "doctorPricing")
      .innerJoin("user.doctorAvailability", "doctorAvailability")
      .where("user.role = :role", { role: USER_ROLES.DOCTOR });

    if (typeof skip === 'number') query.skip(skip);
    if (typeof take === 'number') query.take(take);

    const [doctors, total] = await query.getManyAndCount();
    return { doctors, total };
  }

  async findADoctor(id) {
    return this.repo.find({
      where: { role: USER_ROLES.DOCTOR, id: id },
      select: [
        "id",
        "fullName",
        "email",
        "status",
        "isOnline",
        "profileImageUrl",
        "averageRating",
        "totalRatings",
        "createdAt",
        "updatedAt",
        "departmentSpecialty",

      ],
      relations: [
        "doctorProfile",
        "doctorProfile.professionalLicense",
        "doctorProfile.professionalCertificate",
        "doctorProfile.clinicalPractice",
        "doctorProfile.digitalHealthTools",
        "doctorPricing",
        "doctorAvailability",
        "doctorUnavailability",
      ],
    });
  }
  // New method to filter doctors by online status
  async findDoctorsByOnlineStatus(isOnline) {
    return this.repo.find({
      where: { role: USER_ROLES.DOCTOR, isOnline },
      select: [
        "id",
        "fullName",
        "email",
        "status",
        "isOnline",
        "profileImageUrl",
        "averageRating",
        "totalRatings",
        "createdAt",
        "updatedAt",
        "departmentSpecialty",
      ],
      relations: [
        "doctorProfile",
        "doctorProfile.professionalLicense",
        "doctorProfile.professionalCertificate",
        "doctorProfile.clinicalPractice",
        "doctorProfile.digitalHealthTools",
        "doctorPricing",
        "doctorAvailability",
        "doctorUnavailability",
        "ratings"
      ],
    });
  }

  // New method to search doctors by email or username (fullName)
  async searchDoctors(query) {
    return this.repo
      .createQueryBuilder("user")
      .where("user.role = :role", { role: USER_ROLES.DOCTOR })
      .andWhere("(user.email ILIKE :query OR user.fullName ILIKE :query)", {
        query: `%${query}%`,
      })
      .select([
        "user.id",
        "user.fullName",
        "user.email",
        "user.status",
        "user.isOnline",
        "user.profileImageUrl",
        "user.departmentSpecialty",
        "user.averageRating",
        "user.totalRatings",
        "user.createdAt",
        "user.updatedAt",
      ])
      .getMany();
  }

  // New method to update user authentication information
  async updateAuthInfo(userId, updates) {
    return this.repo.update(
      { id: userId },
      {
        fullName: updates.fullName,
        profileImageUrl: updates.profileImageUrl,
        bannerUrl: updates.bannerUrl, // Add this
        departmentSpecialty: updates.departmentSpecialty, // Add this
        updatedAt: new Date(),
      }
    );
  }

  async update(id, data) {
    return this.repo.update({ id }, data);
  }
  // New method to update online status
  async updateOnlineStatus(userId, isOnline) {
    return this.repo.update(
      { id: userId },
      {
        isOnline,
        updatedAt: new Date(),
      }
    );
  }

  // New method to get online status
  async getOnlineStatus(userId) {
    const user = await this.repo.findOne({
      where: { id: userId },
      select: ["id", "isOnline"],
    });
    return user;
  }

  // Check if user has a specific role by ID
  async hasRole(userId, role) {
    const user = await this.repo.findOne({
      where: { id: userId },
      select: ["id", "role"],
    });

    if (!user) return false;

    return user.role === role;
  }

  // Check if doctor is verified
  async isDoctorVerified(doctorId) {
    const user = await this.repo.findOne({
      where: { id: doctorId, role: USER_ROLES.DOCTOR },
      select: ["id", "status"],
    });
    return user?.status === "doctor_active";
  }

  async findVerifiedDoctors({ skip, take } = {}) {
    const query = this.repo
      .createQueryBuilder("user")
      .select([
        "user.id",
        "user.fullName",
        "user.email",
        "user.status",
        "user.isOnline",
        "user.profileImageUrl",
        "user.departmentSpecialty",
        "user.averageRating",
        "user.totalRatings",
        "user.createdAt",
        "user.updatedAt"
      ])
      .addSelect("doctorProfile")
      .addSelect("professionalLicense")
      .addSelect("professionalCertificate")
      .addSelect("clinicalPractice")
      .addSelect("digitalHealthTools")
      .addSelect("doctorPricing")
      .addSelect("doctorAvailability")
      .addSelect("doctorUnavailability")
      .addSelect("ratings")
      .innerJoin("user.doctorProfile", "doctorProfile")
      .leftJoin("doctorProfile.professionalLicense", "professionalLicense")
      .leftJoin(
        "doctorProfile.professionalCertificate",
        "professionalCertificate"
      )
      .leftJoin("doctorProfile.clinicalPractice", "clinicalPractice")
      .leftJoin("doctorProfile.digitalHealthTools", "digitalHealthTools")
      .innerJoin("user.doctorPricing", "doctorPricing")
      .innerJoin("user.doctorAvailability", "doctorAvailability")
      .leftJoin("user.doctorUnavailability", "doctorUnavailability") // Optional
      .leftJoin("user.ratings", "ratings") // Optional
      .where("user.role = :role", { role: USER_ROLES.DOCTOR })
      .andWhere("user.status = :status", { status: "doctor_active" });

    if (typeof skip === 'number') query.skip(skip);
    if (typeof take === 'number') query.take(take);

    const [doctors, total] = await query.getManyAndCount();
    return { doctors, total };
  }



  async addUserRating(userId, newRating, message) {
    if (newRating < 1 || newRating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    // Save new rating row
    await this.ratingRepo.save({
      user: user,
      rating: newRating,
      message: message || null,
    });

    // Recalculate average
    const stats = await this.ratingRepo
      .createQueryBuilder("r")
      .select("COUNT(r.id)", "count")
      .addSelect("AVG(r.rating)", "avg")
      .where("r.userId = :userId", { userId })
      .getRawOne();

    user.totalRatings = parseInt(stats.count || 0, 10);
    user.averageRating = Number(parseFloat(stats.avg || 0).toFixed(1));
    user.updatedAt = new Date();
    await this.repo.save(user);

    return {
      message: "Rating added successfully",
      averageRating: user.averageRating,
      totalRatings: user.totalRatings,
    };
  }

  async getUserRatings(userId) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const ratings = await this.ratingRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: "DESC" },
    });

    return {
      message: "User ratings fetched successfully",
      averageRating: user.averageRating || 0,
      totalRatings: user.totalRatings || 0,
      ratings: ratings,
    };
  }
}

module.exports = new UserRepository();
