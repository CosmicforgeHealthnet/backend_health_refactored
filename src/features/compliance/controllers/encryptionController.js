// src/controllers/encryptionController.js
const AdvancedEncryptionService = require('../services/advancedEncryptionService');
const AdvancedAuditService = require('../services/advancedAuditService');
const EncryptionKeyRepository = require('../repositories/encryptionKeyRepository');

class EncryptionController {

  /**
   * Generate new FHIR encryption key
   * POST /api/encryption/generate-key
   */
  static async generateKey(req, res) {
    try {
      const userId = req.user.sub;
      const {
        patientIdentifier,
        fhirResourceType,
        sensitivityLevel,
        purposeOfUse,
        keyType = 'resource'
      } = req.body;

      // Validate required context
      if (!sensitivityLevel) {
        return res.status(400).json({
          success: false,
          error: 'Sensitivity level is required'
        });
      }

      const context = {
        patientIdentifier,
        fhirResourceType,
        sensitivityLevel,
        purposeOfUse,
        keyType
      };

      const result = await AdvancedEncryptionService.generateFHIREncryptionKey(context, userId);

      // Log key generation
      await AdvancedAuditService.logEvent({
        eventType: 'key_generation',
        severity: 'medium',
        userId,
        patientIdentifier,
        fhirResourceType,
        eventDescription: `Generated ${keyType} encryption key`,
        encryptionUsed: true,
        encryptionKeyId: result.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          context,
          keyId: result.id,
          algorithm: result.algorithm
        }
      });

      res.json({
        success: true,
        key: {
          id: result.id,
          keyIdentifier: result.keyIdentifier,
          algorithm: result.algorithm,
          effectiveDate: result.effectiveDate,
          expirationDate: result.expirationDate,
          context
        }
      });

    } catch (error) {
      console.error('Error generating encryption key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate encryption key'
      });
    }
  }

  /**
   * Get encryption key details
   * GET /api/encryption/keys/:keyId
   */
  static async getKeyDetails(req, res) {
    try {
      const userId = req.user.sub;
      const { keyId } = req.params;

      const key = await EncryptionKeyRepository.getKeyById(keyId);

      if (!key) {
        return res.status(404).json({
          success: false,
          error: 'Encryption key not found'
        });
      }

      // Log key access
      await AdvancedAuditService.logEvent({
        eventType: 'encryption_key_access',
        severity: 'low',
        userId,
        eventDescription: 'User accessed encryption key details',
        encryptionKeyId: keyId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { keyId, accessType: 'view_details' }
      });

      // Remove sensitive data before sending
      const {
        encryptedKey,
        keyDerivationSalt,
        initializationVector,
        ...safeKeyData
      } = key;

      res.json({
        success: true,
        key: safeKeyData
      });

    } catch (error) {
      console.error('Error getting key details:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get key details'
      });
    }
  }

  /**
   * Search encryption keys
   * POST /api/encryption/keys/search
   */
  static async searchKeys(req, res) {
    try {
      const userId = req.user.sub;
      const searchCriteria = req.body;
      const options = {
        page: parseInt(req.body.page || 1),
        limit: parseInt(req.body.limit || 50),
        sortBy: req.body.sortBy || 'createdAt',
        sortOrder: req.body.sortOrder || 'DESC'
      };

      // Validate search criteria
      const allowedFields = [
        'keyIdentifier', 'keyType', 'keyStatus', 'patientIdentifier',
        'fhirResourceType', 'sensitivityLevel', 'algorithm', 'createdBy',
        'dateRange', 'expiringWithin', 'minUsageCount', 'maxUsageCount'
      ];

      const filteredCriteria = {};
      allowedFields.forEach(field => {
        if (searchCriteria[field] !== undefined) {
          filteredCriteria[field] = searchCriteria[field];
        }
      });

      const result = await EncryptionKeyRepository.searchKeys(filteredCriteria, options);

      // Log key search
      await AdvancedAuditService.logEvent({
        eventType: 'encryption_key_search',
        severity: 'low',
        userId,
        eventDescription: 'User searched encryption keys',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          searchCriteria: filteredCriteria,
          resultCount: result.keys.length
        }
      });

      // Remove sensitive data from results
      const safeKeys = result.keys.map(key => {
        const {
          encryptedKey,
          keyDerivationSalt,
          initializationVector,
          ...safeKeyData
        } = key;
        return safeKeyData;
      });

      res.json({
        ...result,
        keys: safeKeys
      });

    } catch (error) {
      console.error('Error searching encryption keys:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search encryption keys'
      });
    }
  }

  /**
   * Rotate encryption key
   * PUT /api/encryption/keys/:keyId/rotate
   */
  static async rotateKey(req, res) {
    try {
      const userId = req.user.sub;
      const { keyId } = req.params;
      const { reason } = req.body;

      const result = await AdvancedEncryptionService.rotateKey(keyId, userId);

      // Log key rotation
      await AdvancedAuditService.logEvent({
        eventType: 'key_rotation',
        severity: 'high',
        userId,
        eventDescription: `Rotated encryption key ${keyId}`,
        encryptionUsed: true,
        encryptionKeyId: result.newKeyId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          oldKeyId: result.oldKeyId,
          newKeyId: result.newKeyId,
          rotationReason: reason,
          rotatedAt: result.rotatedAt
        }
      });

      res.json({
        success: true,
        message: 'Key rotated successfully',
        oldKeyId: result.oldKeyId,
        newKeyId: result.newKeyId,
        rotatedAt: result.rotatedAt
      });

    } catch (error) {
      console.error('Error rotating encryption key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to rotate encryption key'
      });
    }
  }

  /**
   * Get keys requiring rotation
   * GET /api/encryption/keys-requiring-rotation
   */
  static async getKeysRequiringRotation(req, res) {
    try {
      const userId = req.user.sub;

      const result = await AdvancedEncryptionService.getKeysRequiringRotation();

      // Log rotation check
      await AdvancedAuditService.logEvent({
        eventType: 'key_rotation_check',
        severity: 'low',
        userId,
        eventDescription: 'User checked keys requiring rotation',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          totalRequiringRotation: result.totalRequiringRotation,
          expiredKeys: result.expiredKeys.length,
          overusedKeys: result.overusedKeys.length
        }
      });

      // Remove sensitive data
      const sanitizeKeys = (keys) => keys.map(key => {
        const {
          encryptedKey,
          keyDerivationSalt,
          initializationVector,
          ...safeKeyData
        } = key;
        return safeKeyData;
      });

      res.json({
        success: true,
        expiredKeys: sanitizeKeys(result.expiredKeys),
        overusedKeys: sanitizeKeys(result.overusedKeys),
        totalRequiringRotation: result.totalRequiringRotation
      });

    } catch (error) {
      console.error('Error getting keys requiring rotation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get keys requiring rotation'
      });
    }
  }

  /**
   * Get encryption key statistics
   * GET /api/encryption/statistics
   */
  static async getKeyStatistics(req, res) {
    try {
      const userId = req.user.sub;

      const result = await EncryptionKeyRepository.getKeyStatistics();

      // Log statistics access
      await AdvancedAuditService.logEvent({
        eventType: 'encryption_statistics_access',
        severity: 'low',
        userId,
        eventDescription: 'User accessed encryption key statistics',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          totalActiveKeys: result.statusDistribution.find(s => s.status === 'active')?.count || 0
        }
      });

      res.json({
        success: true,
        statistics: result
      });

    } catch (error) {
      console.error('Error getting key statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get encryption key statistics'
      });
    }
  }

  /**
   * Get keys by type
   * GET /api/encryption/keys/type/:keyType?page=1&limit=50
   */
  static async getKeysByType(req, res) {
    try {
      const userId = req.user.sub;
      const { keyType } = req.params;
      const {
        page = 1,
        limit = 50,
        status = 'active',
        includeExpired = false
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        includeExpired: includeExpired === 'true'
      };

      const result = await EncryptionKeyRepository.getKeysByType(keyType, options);

      // Log type-based access
      await AdvancedAuditService.logEvent({
        eventType: 'encryption_keys_by_type_access',
        severity: 'low',
        userId,
        eventDescription: `User accessed ${keyType} encryption keys`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          keyType,
          keyCount: result.keys.length
        }
      });

      // Remove sensitive data
      const safeKeys = result.keys.map(key => {
        const {
          encryptedKey,
          keyDerivationSalt,
          initializationVector,
          ...safeKeyData
        } = key;
        return safeKeyData;
      });

      res.json({
        ...result,
        keys: safeKeys
      });

    } catch (error) {
      console.error('Error getting keys by type:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get keys by type'
      });
    }
  }

  /**
   * Get patient encryption keys
   * GET /api/encryption/patient/:patientId/keys
   */
  static async getPatientKeys(req, res) {
    try {
      const userId = req.user.sub;
      const { patientId } = req.params;
      const {
        includeInactive = false,
        keyType
      } = req.query;

      const options = {
        includeInactive: includeInactive === 'true',
        keyType
      };

      const keys = await EncryptionKeyRepository.getPatientKeys(patientId, options);

      // Log patient key access
      await AdvancedAuditService.logEvent({
        eventType: 'patient_encryption_keys_access',
        severity: 'medium',
        userId,
        patientIdentifier: patientId,
        eventDescription: `User accessed encryption keys for patient ${patientId}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          patientId,
          keyCount: keys.length,
          includeInactive
        }
      });

      // Remove sensitive data
      const safeKeys = keys.map(key => {
        const {
          encryptedKey,
          keyDerivationSalt,
          initializationVector,
          ...safeKeyData
        } = key;
        return safeKeyData;
      });

      res.json({
        success: true,
        keys: safeKeys,
        patientIdentifier: patientId,
        totalKeys: safeKeys.length
      });

    } catch (error) {
      console.error('Error getting patient keys:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get patient encryption keys'
      });
    }
  }

  /**
   * Update key status
   * PUT /api/encryption/keys/:keyId/status
   */
  static async updateKeyStatus(req, res) {
    try {
      const userId = req.user.sub;
      const { keyId } = req.params;
      const { status, reason } = req.body;

      // Validate status
      const validStatuses = ['active', 'rotated', 'revoked', 'expired'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid key status'
        });
      }

      const result = await EncryptionKeyRepository.updateKeyStatus(keyId, status, userId);

      // Log status update
      await AdvancedAuditService.logEvent({
        eventType: 'encryption_key_status_update',
        severity: status === 'revoked' ? 'high' : 'medium',
        userId,
        eventDescription: `Updated encryption key status to ${status}`,
        encryptionKeyId: keyId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          keyId,
          oldStatus: result.previousStatus,
          newStatus: status,
          reason
        }
      });

      // Remove sensitive data
      const {
        encryptedKey,
        keyDerivationSalt,
        initializationVector,
        ...safeKeyData
      } = result;

      res.json({
        success: true,
        message: `Key status updated to ${status}`,
        key: safeKeyData
      });

    } catch (error) {
      console.error('Error updating key status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update key status'
      });
    }
  }

  /**
   * Get key rotation history
   * GET /api/encryption/keys/:keyId/rotation-history
   */
  static async getKeyRotationHistory(req, res) {
    try {
      const userId = req.user.sub;
      const { keyId } = req.params;
      const { includeRotatedFrom = true } = req.query;

      const options = {
        includeRotatedFrom: includeRotatedFrom === 'true'
      };

      const result = await EncryptionKeyRepository.getKeyRotationHistory(keyId, options);

      // Log rotation history access
      await AdvancedAuditService.logEvent({
        eventType: 'key_rotation_history_access',
        severity: 'low',
        userId,
        eventDescription: `User accessed rotation history for key ${keyId}`,
        encryptionKeyId: keyId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          keyId,
          totalRotations: result.totalRotations
        }
      });

      // Remove sensitive data from rotation chain
      const safeRotationChain = result.rotationChain.map(key => {
        const {
          encryptedKey,
          keyDerivationSalt,
          initializationVector,
          ...safeKeyData
        } = key;
        return safeKeyData;
      });

      res.json({
        success: true,
        rotationChain: safeRotationChain,
        totalRotations: result.totalRotations,
        currentKey: safeRotationChain[safeRotationChain.length - 1],
        originalKey: safeRotationChain[0]
      });

    } catch (error) {
      console.error('Error getting key rotation history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get key rotation history'
      });
    }
  }

  /**
   * Bulk update key status
   * PUT /api/encryption/keys/bulk-status
   */
  static async bulkUpdateKeyStatus(req, res) {
    try {
      const userId = req.user.sub;
      const { keyIds, status, reason } = req.body;

      // Validate input
      if (!keyIds || !Array.isArray(keyIds) || keyIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Key IDs array is required'
        });
      }

      const validStatuses = ['active', 'rotated', 'revoked', 'expired'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid key status'
        });
      }

      // Limit bulk operations
      if (keyIds.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Cannot update more than 100 keys at once'
        });
      }

      const result = await EncryptionKeyRepository.bulkUpdateKeyStatus(keyIds, status, userId);

      // Log bulk status update
      await AdvancedAuditService.logEvent({
        eventType: 'bulk_key_status_update',
        severity: status === 'revoked' ? 'high' : 'medium',
        userId,
        eventDescription: `Bulk updated ${result.affectedKeys} encryption keys to ${status}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          keyIds,
          newStatus: status,
          affectedKeys: result.affectedKeys,
          reason
        }
      });

      res.json({
        success: true,
        message: `${result.affectedKeys} keys updated to ${status}`,
        affectedKeys: result.affectedKeys,
        updatedStatus: status,
        updatedAt: result.updatedAt
      });

    } catch (error) {
      console.error('Error bulk updating key status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk update key status'
      });
    }
  }

  /**
   * Get key compliance status
   * GET /api/encryption/keys/:keyId/compliance
   */
  static async getKeyComplianceStatus(req, res) {
    try {
      const userId = req.user.sub;
      const { keyId } = req.params;

      const result = await EncryptionKeyRepository.getKeyComplianceStatus(keyId);

      // Log compliance check
      await AdvancedAuditService.logEvent({
        eventType: 'key_compliance_check',
        severity: result.isCompliant ? 'low' : 'medium',
        userId,
        eventDescription: `Checked compliance status for encryption key ${keyId}`,
        encryptionKeyId: keyId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          keyId,
          isCompliant: result.isCompliant,
          issueCount: result.issues.length
        }
      });

      res.json({
        success: true,
        compliance: result
      });

    } catch (error) {
      console.error('Error getting key compliance status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get key compliance status'
      });
    }
  }

  /**
   * Get keys by compliance framework
   * GET /api/encryption/compliance/:framework/keys
   */
  static async getKeysByComplianceFramework(req, res) {
    try {
      const userId = req.user.sub;
      const { framework } = req.params;
      const {
        page = 1,
        limit = 50
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const result = await EncryptionKeyRepository.getKeysByComplianceFramework(framework, options);

      // Log compliance framework access
      await AdvancedAuditService.logEvent({
        eventType: 'compliance_framework_keys_access',
        severity: 'low',
        userId,
        eventDescription: `User accessed ${framework} compliance keys`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          framework,
          keyCount: result.keys.length
        }
      });

      // Remove sensitive data
      const safeKeys = result.keys.map(key => {
        const {
          encryptedKey,
          keyDerivationSalt,
          initializationVector,
          ...safeKeyData
        } = key;
        return safeKeyData;
      });

      res.json({
        ...result,
        keys: safeKeys
      });

    } catch (error) {
      console.error('Error getting keys by compliance framework:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get keys by compliance framework'
      });
    }
  }

  /**
   * Generate analytics encryption key for research
   * POST /api/encryption/generate-analytics-key
   */
  static async generateAnalyticsKey(req, res) {
    try {
      const userId = req.user.sub;
      const { analysisType, researchPurpose, privacyLevel } = req.body;

      // Validate required fields
      if (!analysisType || !researchPurpose) {
        return res.status(400).json({
          success: false,
          error: 'Analysis type and research purpose are required'
        });
      }

      const result = await AdvancedEncryptionService.generateAnalyticsKey(
        analysisType,
        researchPurpose,
        privacyLevel
      );

      // Log analytics key generation
      await AdvancedAuditService.logEvent({
        eventType: 'analytics_key_generation',
        severity: 'medium',
        userId,
        eventDescription: `Generated analytics encryption key for ${analysisType}`,
        encryptionUsed: true,
        encryptionKeyId: result.keyId,
        purposeOfUse: 'research',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          analysisType,
          researchPurpose,
          privacyLevel,
          keyId: result.keyId
        }
      });

      res.json({
        success: true,
        message: 'Analytics encryption key generated successfully',
        keyId: result.keyId,
        analysisType,
        privacyLevel
      });

    } catch (error) {
      console.error('Error generating analytics key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate analytics encryption key'
      });
    }
  }

  /**
   * Cleanup expired keys
   * DELETE /api/encryption/cleanup-expired?retentionDays=2555
   */
  static async cleanupExpiredKeys(req, res) {
    try {
      const userId = req.user.sub;
      const { retentionDays = 2555 } = req.query; // 7 years default

      const result = await EncryptionKeyRepository.deleteExpiredKeys(parseInt(retentionDays));

      // Log cleanup operation
      await AdvancedAuditService.logEvent({
        eventType: 'expired_keys_cleanup',
        severity: 'medium',
        userId,
        eventDescription: `Cleaned up ${result.deletedCount} expired encryption keys`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          deletedCount: result.deletedCount,
          retentionDays: parseInt(retentionDays),
          cutoffDate: result.cutoffDate
        }
      });

      res.json({
        success: true,
        message: `${result.deletedCount} expired keys cleaned up`,
        deletedCount: result.deletedCount,
        cutoffDate: result.cutoffDate,
        retentionDays: parseInt(retentionDays)
      });

    } catch (error) {
      console.error('Error cleaning up expired keys:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup expired keys'
      });
    }
  }
}

module.exports = EncryptionController;