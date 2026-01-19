// ===== 3. CONSENT REPOSITORY =====
// src/repositories/consentRepository.js
const AppDataSource = require('../../../config/database');
const { LessThanOrEqual, Between } = require('typeorm');

class ConsentRepository {

  static getRepository() {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized');
    }
    return AppDataSource.getRepository('PatientConsent');
  }

  /**
   * Create new patient consent
   */
  static async createConsent(consentData) {
    const repo = this.getRepository();
    const consent = repo.create(consentData);
    return await repo.save(consent);
  }

  /**
   * Get active consent for patient
   */
  static async getActiveConsent(patientIdentifier) {
    const repo = this.getRepository();

    return await repo.findOne({
      where: {
        patientIdentifier,
        consentStatus: 'active',
        effectiveDate:
          LessThanOrEqual(new Date())

      },
      relations: ['grantorUser', 'witnessUser'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Check if user can access patient data for specific purpose
   */
  static async checkConsentPermission(patientIdentifier, userId, purposeOfUse, resourceType = null) {
    const repo = this.getRepository();

    const consent = await this.getActiveConsent(patientIdentifier);

    if (!consent) {
      return {
        granted: false,
        reason: 'No active consent found',
        consent: null
      };
    }

    // Check if consent has expired
    if (consent.expirationDate && new Date() > consent.expirationDate) {
      return {
        granted: false,
        reason: 'Consent has expired',
        consent
      };
    }

    // Check consent scope
    if (consent.consentScope === 'no_access') {
      return {
        granted: false,
        reason: 'Patient has denied all access',
        consent
      };
    }

    // Check purpose of use
    if (!consent.allowedPurposes.includes(purposeOfUse)) {
      return {
        granted: false,
        reason: `Purpose '${purposeOfUse}' not allowed`,
        consent
      };
    }

    // Check user-specific permissions (for limited access)
    if (consent.consentScope === 'limited_access' && consent.allowedUsers) {
      if (!consent.allowedUsers.includes(userId)) {
        return {
          granted: false,
          reason: 'User not in allowed users list',
          consent
        };
      }
    }

    // Check resource type restrictions
    if (resourceType) {
      if (consent.restrictedResourceTypes && consent.restrictedResourceTypes.includes(resourceType)) {
        return {
          granted: false,
          reason: `Resource type '${resourceType}' is restricted`,
          consent
        };
      }

      if (consent.allowedResourceTypes && !consent.allowedResourceTypes.includes(resourceType)) {
        return {
          granted: false,
          reason: `Resource type '${resourceType}' not in allowed list`,
          consent
        };
      }
    }

    return {
      granted: true,
      reason: 'Access granted based on consent',
      consent
    };
  }

  /**
   * Log consent access attempt
   */
  static async logConsentAccess(consentId, userId, accessType, purposeOfUse, granted, metadata = {}) {
    const logRepo = AppDataSource.getRepository('ConsentAccessLog');

    const log = logRepo.create({
      consent: { id: consentId },
      user: { id: userId },
      accessType,
      purposeOfUse,
      accessGranted: granted,
      denyReason: granted ? null : metadata.reason,
      isEmergencyAccess: metadata.isEmergency || false,
      emergencyJustification: metadata.emergencyJustification || null,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata
    });

    return await logRepo.save(log);
  }

  /**
   * Withdraw consent
   */
  static async withdrawConsent(patientIdentifier, withdrawnBy, reason) {
    const repo = this.getRepository();

    const consent = await this.getActiveConsent(patientIdentifier);
    if (!consent) {
      throw new Error('No active consent found to withdraw');
    }

    await repo.update(consent.id, {
      consentStatus: 'withdrawn',
      withdrawnAt: new Date(),
      withdrawnBy,
      withdrawalReason: reason
    });

    return consent;
  }

  /**
   * Get consent history for patient
   */
  static async getConsentHistory(patientIdentifier, options = {}) {
    const repo = this.getRepository();
    const { page = 1, limit = 20 } = options;

    const queryBuilder = repo.createQueryBuilder('consent')
      .leftJoinAndSelect('consent.grantorUser', 'grantor')
      .leftJoinAndSelect('consent.witnessUser', 'witness')
      .leftJoinAndSelect('consent.withdrawnByUser', 'withdrawnBy')
      .where('consent.patientIdentifier = :patientIdentifier', { patientIdentifier })
      .orderBy('consent.createdAt', 'DESC');

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [consents, total] = await queryBuilder.getManyAndCount();

    return {
      consents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Check emergency access permissions
   */
  static async checkEmergencyAccess(patientIdentifier, userId, justification) {
    const consent = await this.getActiveConsent(patientIdentifier);

    if (!consent || !consent.allowEmergencyAccess) {
      return {
        granted: false,
        reason: 'Emergency access not permitted',
        consent
      };
    }

    if (!justification || justification.trim().length < 10) {
      return {
        granted: false,
        reason: 'Emergency justification required',
        consent
      };
    }

    return {
      granted: true,
      reason: 'Emergency access granted',
      consent,
      requiresJustification: true
    };
  }

  /**
   * Get patients requiring consent renewal
   */
  static async getPatientsRequiringRenewal(daysAhead = 30) {
    const repo = this.getRepository();
    const currentDate = new Date();
    const futureDate = new Date();
    futureDate.setDate(currentDate.getDate() + daysAhead);

    return await repo.find({
      where: {
        consentStatus: 'active',
        expirationDate: Between(currentDate, futureDate),
      },
      relations: ['grantorUser'],
      order: { expirationDate: 'ASC' },
    });
  }

  /**
   * Bulk consent operations
   */
  static async bulkUpdateConsents(patientIdentifiers, updateData) {
    const repo = this.getRepository();

    const result = await repo.update(
      {
        patientIdentifier: {
          $in: patientIdentifiers
        },
        consentStatus: 'active'
      },
      {
        ...updateData,
        updatedAt: new Date()
      }
    );

    return result.affected || 0;
  }
}

module.exports = ConsentRepository;
