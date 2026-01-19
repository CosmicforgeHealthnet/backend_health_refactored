const AppDataSource = require('../../config/database');
const ProfileOption = require('../entities/ProfileOption');
const { UniqueConstraintError } = require('../utils/errors');

class ProfileOptionsRepository {
  constructor() {
    this.repository = AppDataSource.getRepository(ProfileOption);

    // getRepository('ProfileOption');
  }

  /**
   * Find all profile options.
   * @returns {Promise<Array>} Array of profile options.
   */
  async findAll() {
    return this.repository.find();
  }

  /**
   * Find a profile option by ID.
   * @param {string} id - UUID of the profile option.
   * @returns {Promise<Object|null>} Profile option or null if not found.
   */
  async findById(id) {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Find a profile option by profileType, field, and value.
   * @param {string} profileType - Profile type (e.g., 'patient', 'doctor').
   * @param {string} field - Field name (e.g., 'gender').
   * @param {string} value - Field value (e.g., 'male').
   * @returns {Promise<Object|null>} Profile option or null if not found.
   */

  async findByTypeFieldValue(profileType, field, value) {
    return this.repository.findOne({
      where: {
        'profileType': profileType.toLowerCase(), // Quoted for case sensitivity
        field,
        value,
      },
    });
  }

  /**
   * Create a new profile option.
   * @param {Object} data - Profile option data (profileType, field, value).
   * @returns {Promise<Object>} Saved profile option.
   */
  async create(data) {
    const newOption = this.repository.create({
      profileType: data.profileType.toLowerCase(),
      field: data.field,
      value: data.value,
    });
    return this.repository.save(newOption);
  }

  /**
   * Update a profile option's value.
   * @param {Object} option - Existing profile option.
   * @param {string} value - New value.
   * @returns {Promise<Object>} Updated profile option.
   */
  async update(option, value) {
    option.value = value;
    return this.repository.save(option);
  }

  /**
   * Delete a profile option.
   * @param {Object} option - Profile option to delete.
   * @returns {Promise<void>}
   */
  async delete(option) {
    await this.repository.remove(option);
  }
}

module.exports = new ProfileOptionsRepository();