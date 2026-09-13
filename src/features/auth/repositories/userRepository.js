const AppDataSource = require("../../../config/database");
const User = require("../entities/User");
const { USER_ROLES } = require("../../../shared/utils/constants");
const UserRating = require("../../doctor/entities/UserRatings");

class UserRepository {
  get repo() {
    return AppDataSource.getRepository(User);
  }

  get ratingRepo() {
    return AppDataSource.getRepository(UserRating);
  }

  async findByEmail(email) {
    console.log('🔍 DEBUG - UserRepository.findByEmail called with:', email);
    try {
      const result = await this.repo.findOne({ where: { email } });
      console.log('🔍 DEBUG - UserRepository.findByEmail success. Found:', result ? 'Yes' : 'No');
      return result;
    } catch (err) {
      console.error('💥 DEBUG - UserRepository.findByEmail error:', err);
      throw err;
    }
  }

  async findByEmailAndRole(email, role) {
    return this.repo.findOne({ where: { email, role } });
  }

  // passwordHash/mfaSecret are select:false on the entity (see User.js) so
  // they never come back by accident. Login and password-change flows are
  // the only legitimate consumers — they must go through these explicitly,
  // via addSelect, which adds the field on top of the normal default
  // selection rather than restricting to just these columns.
  async findByEmailWithAuthSecrets(email) {
    return this.repo
      .createQueryBuilder("user")
      .addSelect(["user.passwordHash", "user.mfaSecret"])
      .where("user.email = :email", { email })
      .getOne();
  }

  async findByEmailAndRoleWithAuthSecrets(email, role) {
    return this.repo
      .createQueryBuilder("user")
      .addSelect(["user.passwordHash", "user.mfaSecret"])
      .where("user.email = :email", { email })
      .andWhere("user.role = :role", { role })
      .getOne();
  }

  async findByIdWithAuthSecrets(id) {
    return this.repo
      .createQueryBuilder("user")
      .addSelect(["user.passwordHash", "user.mfaSecret"])
      .where("user.id = :id", { id })
      .getOne();
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

  /**
   * Doctors stuck at pending_doctor_verification with zero verification_requests
   * rows ever — i.e. invisible to the admin verification queue, since that only
   * ever lists existing verification_requests. Used by the admin "stuck doctors"
   * view and the reminder cron job.
   */
  async findDoctorsWithNoVerificationRequest() {
    const rows = await this.repo
      .createQueryBuilder("user")
      .leftJoin("verification_requests", "vr", 'vr."doctorId" = user.id')
      .leftJoin("doctor_profiles", "dp", 'dp."userId" = user.id')
      .where("user.role = :role", { role: USER_ROLES.DOCTOR })
      .andWhere("user.status = :status", { status: "pending_doctor_verification" })
      .andWhere("vr.id IS NULL")
      .orderBy("user.createdAt", "ASC")
      .select(["user", "dp.id"])
      .getRawAndEntities();

    // getRawAndEntities keeps dp.id alongside each entity row so we can tell
    // apart doctors who never came back at all vs. those who at least
    // completed their profile but still never submitted verification.
    return rows.entities.map((user, i) => ({
      ...user,
      hasProfile: !!rows.raw[i].dp_id,
    }));
  }

  // Verified doctors who are invisible-to-bookers in practice: they pass
  // verification but never set consultation pricing and/or a weekly
  // schedule, so a patient can find them but can't actually book them.
  // Lets admins/support proactively nudge doctors stuck at this step instead
  // of it only surfacing as a silent "why can't patients see me" report.
  async findVerifiedDoctorsMissingBookingSetup() {
    const rows = await this.repo
      .createQueryBuilder("user")
      .leftJoin("doctor_pricing", "dp", 'dp."doctorId" = user.id')
      .leftJoin("doctor_availability", "da", 'da."doctorId" = user.id')
      .where("user.role = :role", { role: USER_ROLES.DOCTOR })
      .andWhere("user.status = :status", { status: "doctor_active" })
      .andWhere("(dp.id IS NULL OR da.id IS NULL)")
      .groupBy("user.id")
      .orderBy("user.createdAt", "ASC")
      .select(["user.id", "user.fullName", "user.email", "user.createdAt"])
      .addSelect("bool_or(dp.id IS NOT NULL)", "haspricing")
      .addSelect("bool_or(da.id IS NOT NULL)", "hasavailability")
      .getRawMany();

    return rows.map(r => ({
      id: r.user_id,
      fullName: r.user_fullName,
      email: r.user_email,
      createdAt: r.user_createdAt,
      hasPricing: r.haspricing,
      hasAvailability: r.hasavailability,
    }));
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
        "tier",
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
        "user.tier",
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
      .leftJoin(
        "doctorProfile.professionalCertificate",
        "professionalCertificate"
      )
      .leftJoin("doctorProfile.clinicalPractice", "clinicalPractice")
      .leftJoin("doctorProfile.digitalHealthTools", "digitalHealthTools")
      .leftJoin("user.doctorPricing", "doctorPricing")
      .leftJoin("user.doctorAvailability", "doctorAvailability")
      .where("user.role = :role", { role: USER_ROLES.DOCTOR })
      .orderBy("user.createdAt", "DESC");

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
        "tier",
        "createdAt",
        "updatedAt",
        "departmentSpecialty",
        "bannerUrl"

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
        "tier",
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
        "user.tier",
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
        "user.tier",
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
      // Pricing/availability are surfaced but not required to appear here —
      // requiring them (via innerJoin) silently hid every verified doctor who
      // hadn't yet set them up (roughly half of all verified doctors on
      // staging when this was found). A verified doctor should be
      // discoverable immediately; the frontend can show "booking not yet
      // available" for one with no pricing/availability set.
      .leftJoin("user.doctorPricing", "doctorPricing")
      .leftJoin("user.doctorAvailability", "doctorAvailability")
      .leftJoin("user.doctorUnavailability", "doctorUnavailability") // Optional
      .leftJoin("user.ratings", "ratings") // Optional
      .where("user.role = :role", { role: USER_ROLES.DOCTOR })
      .andWhere("user.status = :status", { status: "doctor_active" })
      .orderBy("user.createdAt", "DESC");

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
