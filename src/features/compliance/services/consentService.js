// src/services/consentService.js
const AppDataSource = require('../../../config/database');
const ConsentRepository = require('../repositories/consentRepository');
const { ConsentStatus, ConsentScope, PurposeOfUse } = require('../entities/PatientConsent');

class ConsentService {

  /**
   * Create new patient consent
   */
  static async createConsent(consentData, grantorUserId) {
    try {
      // Validate consent data
      const validation = this.validateConsentData(consentData);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Check if there's an existing active consent
      const existingConsent = await ConsentRepository.getActiveConsent(consentData.patientIdentifier);

      const consentCreateData = {
        ...consentData,
        grantor: grantorUserId,
        effectiveDate: consentData.effectiveDate || new Date(),
        consentStatus: ConsentStatus.ACTIVE,
        allowedPurposes: consentData.allowedPurposes || [PurposeOfUse.TREATMENT],
        previousConsentId: existingConsent ? existingConsent.id : null,
        version: existingConsent ? existingConsent.version + 1 : 1
      };

      // If there's an existing consent, deactivate it
      if (existingConsent) {
        await ConsentRepository.getRepository().update(existingConsent.id, {
          consentStatus: ConsentStatus.INACTIVE
        });
      }

      const consent = await ConsentRepository.createConsent(consentCreateData);

      return {
        success: true,
        consent: {
          id: consent.id,
          patientIdentifier: consent.patientIdentifier,
          consentScope: consent.consentScope,
          allowedPurposes: consent.allowedPurposes,
          effectiveDate: consent.effectiveDate,
          expirationDate: consent.expirationDate,
          version: consent.version
        }
      };

    } catch (error) {
      throw new Error(`Failed to create consent: ${error.message}`);
    }
  }

  /**
   * Check access permission with consent validation
   */
  static async checkAccessPermission(patientIdentifier, userId, purposeOfUse, resourceType, metadata = {}) {
    try {
      // Check normal consent first
      let permission = await ConsentRepository.checkConsentPermission(
        patientIdentifier,
        userId,
        purposeOfUse,
        resourceType
      );

      // If access denied and emergency access requested
      if (!permission.granted && metadata.isEmergency) {
        const emergencyPermission = await ConsentRepository.checkEmergencyAccess(
          patientIdentifier,
          userId,
          metadata.emergencyJustification
        );

        if (emergencyPermission.granted) {
          permission = emergencyPermission;
          permission.isEmergencyAccess = true;
        }
      }

      // Log the access attempt
      if (permission.consent) {
        await ConsentRepository.logConsentAccess(
          permission.consent.id,
          userId,
          metadata.accessType || 'view',
          purposeOfUse,
          permission.granted,
          {
            ...metadata,
            reason: permission.reason,
            resourceType,
            isEmergency: permission.isEmergencyAccess || false
          }
        );
      }

      return permission;

    } catch (error) {
      throw new Error(`Failed to check access permission: ${error.message}`);
    }
  }

  /**
   * Withdraw patient consent
   */
  static async withdrawConsent(patientIdentifier, withdrawnBy, reason, ipAddress, userAgent) {
    try {
      const consent = await ConsentRepository.withdrawConsent(patientIdentifier, withdrawnBy, reason);

      // Log the withdrawal
      await ConsentRepository.logConsentAccess(
        consent.id,
        withdrawnBy,
        'withdraw',
        'patient_request',
        true,
        {
          reason: 'Consent withdrawn',
          withdrawalReason: reason,
          ipAddress,
          userAgent
        }
      );

      return {
        success: true,
        message: 'Consent withdrawn successfully',
        withdrawnConsent: {
          id: consent.id,
          patientIdentifier: consent.patientIdentifier,
          withdrawnAt: new Date()
        }
      };

    } catch (error) {
      throw new Error(`Failed to withdraw consent: ${error.message}`);
    }
  }

  /**
   * Get consent status for patient
   */
  static async getConsentStatus(patientIdentifier) {
    try {
      const activeConsent = await ConsentRepository.getActiveConsent(patientIdentifier);

      if (!activeConsent) {
        return {
          success: true,
          status: {
            hasActiveConsent: false,
            patientIdentifier,
            message: 'No active consent found'
          }
        };
      }

      return {
        success: true,
        status: {
          hasActiveConsent: true,
          patientIdentifier,
          consentScope: activeConsent.consentScope,
          allowedPurposes: activeConsent.allowedPurposes,
          effectiveDate: activeConsent.effectiveDate,
          expirationDate: activeConsent.expirationDate,
          allowEmergencyAccess: activeConsent.allowEmergencyAccess,
          version: activeConsent.version
        }
      };

    } catch (error) {
      throw new Error(`Failed to get consent status: ${error.message}`);
    }
  }

  /**
   * Update consent preferences
   */
  static async updateConsent(patientIdentifier, updateData, updatedBy) {
    try {
      const activeConsent = await ConsentRepository.getActiveConsent(patientIdentifier);

      if (!activeConsent) {
        return {
          success: false,
          error: 'No active consent found to update'
        };
      }

      // Create new version of consent
      const newConsentData = {
        ...activeConsent,
        ...updateData,
        id: undefined, // Remove ID to create new record
        version: activeConsent.version + 1,
        previousConsentId: activeConsent.id,
        grantor: updatedBy,
        effectiveDate: new Date()
      };

      // Deactivate old consent
      await ConsentRepository.getRepository().update(activeConsent.id, {
        consentStatus: ConsentStatus.INACTIVE
      });

      // Create new consent
      const newConsent = await ConsentRepository.createConsent(newConsentData);

      return {
        success: true,
        consent: {
          id: newConsent.id,
          patientIdentifier: newConsent.patientIdentifier,
          consentScope: newConsent.consentScope,
          allowedPurposes: newConsent.allowedPurposes,
          version: newConsent.version
        }
      };

    } catch (error) {
      throw new Error(`Failed to update consent: ${error.message}`);
    }
  }

  /**
   * Get consent compliance report
   */
  static async getConsentComplianceReport() {
    try {
      const repo = ConsentRepository.getRepository();

      // Get consent statistics
      const totalConsents = await repo.count();
      const activeConsents = await repo.count({ where: { consentStatus: ConsentStatus.ACTIVE } });
      const withdrawnConsents = await repo.count({ where: { consentStatus: ConsentStatus.WITHDRAWN } });
      const expiredConsents = await repo.count({ where: { consentStatus: ConsentStatus.EXPIRED } });

      // Get patients requiring renewal
      const patientsRequiringRenewal = await ConsentRepository.getPatientsRequiringRenewal(30);

      // Get emergency access statistics
      const logRepo = AppDataSource.getRepository('ConsentAccessLog');
      const emergencyAccesses = await logRepo.count({ where: { isEmergencyAccess: true } });

      return {
        success: true,
        report: {
          overview: {
            totalConsents,
            activeConsents,
            withdrawnConsents,
            expiredConsents,
            consentRate: totalConsents > 0 ? Math.round((activeConsents / totalConsents) * 100) : 0
          },
          renewals: {
            patientsRequiringRenewal: patientsRequiringRenewal.length,
            upcomingExpirations: patientsRequiringRenewal.slice(0, 10)
          },
          emergencyAccess: {
            totalEmergencyAccesses: emergencyAccesses,
            last30Days: emergencyAccesses // This would need a date filter
          },
          generatedAt: new Date()
        }
      };

    } catch (error) {
      throw new Error(`Failed to generate consent compliance report: ${error.message}`);
    }
  }

  // Helper methods

  /**
   * Validate consent data
   */
  static validateConsentData(data) {
    if (!data.patientIdentifier) {
      return { isValid: false, error: 'Patient identifier is required' };
    }

    if (!data.consentScope || !Object.values(ConsentScope).includes(data.consentScope)) {
      return { isValid: false, error: 'Valid consent scope is required' };
    }

    if (!data.allowedPurposes || !Array.isArray(data.allowedPurposes) || data.allowedPurposes.length === 0) {
      return { isValid: false, error: 'At least one allowed purpose is required' };
    }

    const invalidPurposes = data.allowedPurposes.filter(p => !Object.values(PurposeOfUse).includes(p));
    if (invalidPurposes.length > 0) {
      return { isValid: false, error: `Invalid purposes: ${invalidPurposes.join(', ')}` };
    }

    if (data.expirationDate && new Date(data.expirationDate) <= new Date()) {
      return { isValid: false, error: 'Expiration date must be in the future' };
    }

    return { isValid: true };
  }
}

module.exports = ConsentService;
