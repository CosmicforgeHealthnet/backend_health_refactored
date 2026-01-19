const ProfileOptionsRepository = require('../repositories/ProfileOptionsRepository');
const { UniqueConstraintError } = require('../utils/errors');

class ProfileOptionsService {
  /**
   * Get all profile options grouped by patient and doctor.
   * @returns {Promise<Object>} Object with patient and doctor profile options.
   */
  async getProfileOptions() {
    const options = await ProfileOptionsRepository.findAll();

    if (!options.length) {
      console.warn('No profile options found in database');
      return {
        patientProfileOptions: { note: 'No options available. Contact support.' },
        doctorProfileOptions: { note: 'No options available.' },
      };
    }

    return {
      patientProfileOptions: {
        ...options
          .filter(o => o.profileType.toLowerCase() === 'patient')
          .reduce((acc, o) => {
            acc[o.field] = acc[o.field] || [];
            acc[o.field].push(o.value);
            return acc;
          }, {}),
        note: 'All string fields are case-insensitive (e.g., "Male", "MALE", "male" are accepted for gender).',
      },
      doctorProfileOptions: {
        ...options
          .filter(o => o.profileType.toLowerCase() === 'doctor')
          .reduce((acc, o) => {
            acc[o.field] = acc[o.field] || [];
            acc[o.field].push(o.value);
            return acc;
          }, {}),
        note: 'All string fields are case-insensitive (e.g., "Monday", "MONDAY", "monday" are accepted for daysAvailableFrom).',
      },
    };
  }

  /**
   * Manage profile options (add, update, delete).
   * @param {Array<Object>} operations - Array of operations to perform.
   * @returns {Promise<Array<Object>>} Array of operation results.
   */
  async manageProfileOptions(operations) {
    const results = [];

    for (const op of operations) {
      try {
        if (op.action === 'add') {
          const existing = await ProfileOptionsRepository.findByTypeFieldValue(
            op.profileType,
            op.field,
            op.value
          );
          if (existing) {
            throw new UniqueConstraintError(
              `Option already exists for profileType: ${op.profileType}, field: ${op.field}, value: ${op.value}`
            );
          }

          const savedOption = await ProfileOptionsRepository.create({
            profileType: op.profileType,
            field: op.field,
            value: op.value,
          });
          results.push({ action: 'add', status: 'success', option: savedOption });
        } else if (op.action === 'update') {
          const option = await ProfileOptionsRepository.findById(op.id);
          if (!option) {
            throw new Error(`Option with id ${op.id} not found`);
          }

          const existing = await ProfileOptionsRepository.findByTypeFieldValue(
            option.profileType,
            option.field,
            op.value
          );
          if (existing && existing.id !== op.id) {
            throw new UniqueConstraintError(
              `Value ${op.value} already exists for profileType: ${option.profileType}, field: ${option.field}`
            );
          }

          const updatedOption = await ProfileOptionsRepository.update(option, op.value);
          results.push({ action: 'update', status: 'success', option: updatedOption });
        } else if (op.action === 'delete') {
          const option = await ProfileOptionsRepository.findById(op.id);
          if (!option) {
            throw new Error(`Option with id ${op.id} not found`);
          }

          await ProfileOptionsRepository.delete(option);
          results.push({ action: 'delete', status: 'success', id: op.id });
        }
      } catch (error) {
        results.push({
          action: op.action,
          status: 'error',
          error: error.message,
          input: op,
        });
      }
    }

    return results;
  }
}

module.exports = new ProfileOptionsService();