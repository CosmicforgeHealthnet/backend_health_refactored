// src/repositories/doctorProfileRepository.js
const AppDataSource = require('../../../config/database');
const DoctorProfile = require('../entities/DoctorProfile/Index');
const ProfessionalLicense = require('../entities/DoctorProfile/ProfessionalLicense');
const ProfessionalCertificate = require('../entities/DoctorProfile/ProfessionalCertificate');
const ClinicalPractice = require('../entities/DoctorProfile/ClinicalPractice');
const DigitalHealthTools = require('../entities/DoctorProfile/DigitalHealthTools');
const Wallet = require('../entities/DoctorProfile/Wallet');

class DoctorProfileRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(DoctorProfile);
    this.professionalLicenseRepo = AppDataSource.getRepository(ProfessionalLicense);
    this.professionalCertificateRepo = AppDataSource.getRepository(ProfessionalCertificate);
    this.clinicalPracticeRepo = AppDataSource.getRepository(ClinicalPractice);
    this.digitalHealthToolsRepo = AppDataSource.getRepository(DigitalHealthTools);
    this.walletRepo = AppDataSource.getRepository(Wallet);
  }

  /**
   * Find a doctor profile by ID
   * @param {string} id - The UUID of the doctor profile
   * @returns {Promise<DoctorProfile|null>} - The doctor profile or null if not found
   */
  async findById(id) {
    return this.repo.findOne({
      where: { id },
      relations: [
        'user',
        'professionalLicense',
        'professionalCertificate',
        'clinicalPractice',
        'digitalHealthTools',
        'wallet'
      ],
    });
  }

  /**
   * Find a doctor profile by user ID
   * @param {string} userId - The UUID of the associated user
   * @returns {Promise<DoctorProfile|null>} - The doctor profile or null if not found
   */
  async findByUserId(userId) {
    return this.repo.findOne({
      where: { user: { id: userId } },
      relations: [
        'user',
        'professionalLicense',
        'professionalCertificate',
        'clinicalPractice',
        'digitalHealthTools',
        'wallet',
        // 'currentVerificationRequest' // NEW: Include current verification
      ],
    });
  }

  /**
   * Create a new doctor profile (without saving)
   * @param {Object} data - The doctor profile data
   * @returns {DoctorProfile} - The unsaved doctor profile entity
   */
  create(data) {
    return this.repo.create(data);
  }

  /**
   * Save a doctor profile
   * @param {DoctorProfile} doctorProfile - The doctor profile entity to save
   * @returns {Promise<DoctorProfile>} - The saved doctor profile
   */
  async save(doctorProfile) {
    return await this.repo.save(doctorProfile);
  }

  /**
   * Update a doctor profile by ID
   * @param {string} id - The UUID of the doctor profile
   * @param {Object} data - The updated doctor profile data
   * @returns {Promise<DoctorProfile>} - The updated doctor profile
   */
  async update(id, data) {
    const doctorProfile = await this.findById(id);
    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }
    Object.assign(doctorProfile, data);
    return this.repo.save(doctorProfile);
  }

  /**
 * Create doctor profile if it doesn't exist
 * @param {string} userId - The UUID of the user
 * @returns {Promise<DoctorProfile>} - The doctor profile
 */
  async createProfileIfNotExists(userId) {
    const existing = await this.repo.findOne({
      where: { user: { id: userId } }
    });

    if (!existing) {
      return await this.repo.save(this.repo.create({
        user: { id: userId },
        createdAt: new Date(),
        updatedAt: new Date()
      }));
    }

    return existing;
  }

  /**
   * Update doctor profile by user ID (NEW - for verification status)
   * @param {string} userId - The UUID of the user
   * @param {Object} updateData - The data to update
   * @returns {Promise<DoctorProfile>} - The updated doctor profile
   */
  async updateByUserId(userId, updateData) {
    try {
      // Find the doctor profile by userId
      const doctorProfile = await this.repo.findOne({
        where: { user: { id: userId } }
      });

      if (!doctorProfile) {
        throw new Error("Doctor profile not found");
      }

      // Update the profile with new data
      Object.assign(doctorProfile, updateData);
      doctorProfile.updatedAt = new Date();

      // Save and return
      return await this.repo.save(doctorProfile);
    } catch (error) {
      console.error("Error updating doctor profile by user ID:", error);
      throw error;
    }
  }

  /**
   * Update verification status specifically (NEW)
   * @param {string} userId - The UUID of the user
   * @param {Object} verificationData - Verification-specific data
   * @returns {Promise<DoctorProfile>} - The updated doctor profile
   */
  async updateVerificationStatus(userId, verificationData) {
    const updateData = {
      verificationStatus: verificationData.status,
      verificationMethod: verificationData.method,
      verificationTier: verificationData.tier,
      verificationConfidenceScore: verificationData.confidenceScore || 0,
      currentVerificationRequestId: verificationData.verificationRequestId,
      lastVerificationAttempt: new Date(),
      ...verificationData.additionalData
    };

    // Add success timestamp if verified
    if (verificationData.status === 'verified') {
      updateData.lastVerificationSuccess = new Date();
      updateData.profileVerified = true;
    }

    return await this.updateByUserId(userId, updateData);
  }

  /**
   * Get doctors by verification status (NEW)
   * @param {string} status - Verification status to filter by
   * @param {number} limit - Maximum number of results
   * @returns {Promise<DoctorProfile[]>} - Array of doctor profiles
   */
  async findByVerificationStatus(status, limit = 50) {
    return await this.repo.find({
      where: { verificationStatus: status },
      relations: ["user"],
      order: { lastVerificationAttempt: "DESC" },
      take: limit
    });
  }

  /**
   * Get verification statistics (NEW)
   * @returns {Promise<Array>} - Verification statistics
   */
  async getVerificationStats() {
    const queryBuilder = this.repo.createQueryBuilder("dp");

    return await queryBuilder
      .select([
        "dp.verificationStatus",
        "dp.verificationTier",
        "COUNT(*) as count",
        "AVG(dp.verificationConfidenceScore) as avgConfidence"
      ])
      .groupBy("dp.verificationStatus, dp.verificationTier")
      .getRawMany();
  }

  /**
   * Find doctors with expiring verifications (NEW)
   * @param {number} daysFromNow - Days from now to check for expiry
   * @returns {Promise<DoctorProfile[]>} - Doctors with expiring verifications
   */
  async findWithExpiringVerifications(daysFromNow = 30) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysFromNow);

    return await this.repo.find({
      where: {
        verificationStatus: 'verified',
        // Assuming you have a verification expiry field
        // verificationExpiryDate: LessThan(expiryDate)
      },
      relations: ["user"]
    });
  }

  /**
   * Get doctor profile with verification details (NEW)
   * @param {string} userId - The UUID of the user
   * @returns {Promise<DoctorProfile|null>} - Doctor profile with verification relations
   */
  async findByUserIdWithVerification(userId) {
    return this.repo.findOne({
      where: { user: { id: userId } },
      relations: [
        'user',
        'professionalLicense',
        'professionalCertificate',
        'clinicalPractice',
        'digitalHealthTools',
        'wallet',
        'currentVerificationRequest',
        'verificationRequests'
      ],
    });
  }

  /**
   * Delete a doctor profile by ID
   * @param {string} id - The UUID of the doctor profile
   * @returns {Promise<void>}
   */
  async delete(id) {
    const doctorProfile = await this.findById(id);
    if (!doctorProfile) {
      throw new Error('Doctor profile not found');
    }
    await this.repo.remove(doctorProfile);
  }

  /**
   * Get dashboard statistics for doctors (NEW)
   * @returns {Promise<Object>} - Dashboard statistics
   */
  async getDashboardStats() {
    const [
      totalDoctors,
      verifiedDoctors,
      pendingVerification,
      rejectedVerification
    ] = await Promise.all([
      this.repo.count(),
      this.repo.count({ where: { verificationStatus: 'verified' } }),
      this.repo.count({ where: { verificationStatus: 'pending' } }),
      this.repo.count({ where: { verificationStatus: 'rejected' } })
    ]);

    return {
      totalDoctors,
      verifiedDoctors,
      pendingVerification,
      rejectedVerification,
      verificationRate: totalDoctors > 0 ? Math.round((verifiedDoctors / totalDoctors) * 100) : 0
    };
  }
}

module.exports = new DoctorProfileRepository();