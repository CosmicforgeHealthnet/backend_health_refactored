const AppDataSource = require("../../../config/database");
const PatientProfile = require("../entities/PatientProfile");
const MedicalCondition = require("../entities/MedicalCondition");
const Surgery = require("../entities/Surgery");
const Allergy = require("../entities/Allergy");
const FamilyHistory = require("../entities/FamilyHistory");
const Medication = require("../entities/Medication");
const Immunization = require("../entities/Immunization");
const HealthInsurance = require("../entities/HealthInsurance");
const Disability = require("../entities/Disability");
const Consent = require("../entities/Consent");

class PatientProfileRepository {
  constructor() {
    this.repo = AppDataSource.getRepository(PatientProfile);
    this.medicalConditionRepo = AppDataSource.getRepository(MedicalCondition);
    this.surgeryRepo = AppDataSource.getRepository(Surgery);
    this.allergyRepo = AppDataSource.getRepository(Allergy);
    this.familyHistoryRepo = AppDataSource.getRepository(FamilyHistory);
    this.medicationRepo = AppDataSource.getRepository(Medication);
    this.immunizationRepo = AppDataSource.getRepository(Immunization);
    this.healthInsuranceRepo = AppDataSource.getRepository(HealthInsurance);
    this.disabilityRepo = AppDataSource.getRepository(Disability);
    this.consentRepo = AppDataSource.getRepository(Consent);
  }

  /**
   * Find a patient profile by ID
   * @param {string} id - The UUID of the patient profile
   * @returns {Promise<PatientProfile|null>} - The patient profile or null if not found
   */
  async findById(id) {
    return await this.repo.findOne({
      where: { id },
      relations: [
        "medicalConditions",
        "surgeries",
        "allergies",
        "familyHistories",
        "medications",
        "immunizations",
        "healthInsurance",
        "disability",
        "consent",
        "user",
      ],
    });
  }

  /**
   * Find a patient profile by user ID
   * @param {string} userId - The UUID of the associated user
   * @returns {Promise<PatientProfile|null>} - The patient profile or null if not found
   */
  async findByUserId(userId) {
    const user = await this.repo.findOne({
      where: { user: { id: userId } },
      relations: [
        "medicalConditions",
        "surgeries",
        "allergies",
        "familyHistories",
        "medications",
        "immunizations",
        "healthInsurance",
        "disability",
        "consent",
        "user",
      ],
    });
    console.log(user);

    return user;
  }

  /**
   * Create a new patient profile (without saving)
   * @param {Object} data - The patient profile data
   * @returns {PatientProfile} - The unsaved patient profile entity
   */
  async create(data) {
    return await this.repo.create(data);
  }

  /**
   * Save a patient profile
   * @param {PatientProfile} patientProfile - The patient profile entity to save
   * @returns {Promise<PatientProfile>} - The saved patient profile
   */
  async save(patientProfile) {
    return await this.repo.save(patientProfile);
  }

  /**
   * Update a patient profile by ID
   * @param {string} id - The UUID of the patient profile
   * @param {Object} data - The updated patient profile data
   * @returns {Promise<PatientProfile>} - The updated patient profile
   */
  async update(id, data) {
    const patientProfile = await this.findById(id);
    if (!patientProfile) {
      throw new Error("Patient profile not found");
    }
    Object.assign(patientProfile, data);
    return this.repo.save(patientProfile);
  }

  /**
   * Delete a patient profile by ID
   * @param {string} id - The UUID of the patient profile
   * @returns {Promise<void>}
   */
  async delete(id) {
    const patientProfile = await this.findById(id);
    if (!patientProfile) {
      throw new Error("Patient profile not found");
    }
    await this.repo.remove(patientProfile);
  }
}

module.exports = new PatientProfileRepository();
