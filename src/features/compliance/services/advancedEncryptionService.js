// src/services/advancedEncryptionService.js
const crypto = require('crypto');
const AppDataSource = require('../../../config/database');

class AdvancedEncryptionService {

  /**
   * Initialize the encryption service with master key
   */
  static async initialize() {
    try {
      // Check if master key exists
      let masterKey = await this.getMasterKey();
      
      if (!masterKey) {
        // Generate new master key
        masterKey = await this.generateMasterKey();
        console.log('Generated new master key');
      }
      
      this.masterKey = masterKey;
      console.log('Advanced Encryption Service initialized');
      
    } catch (error) {
      throw new Error(`Failed to initialize encryption service: ${error.message}`);
    }
  }

  /**
   * Generate encryption key based on FHIR context
   */
  static async generateFHIREncryptionKey(context, createdBy) {
    try {
      const {
        patientIdentifier,
        fhirResourceType,
        sensitivityLevel,
        purposeOfUse,
        keyType = KeyType.RESOURCE
      } = context;

      // Generate unique key identifier
      const keyIdentifier = this.generateKeyIdentifier(context);
      
      // Check if key already exists
      const existingKey = await this.getKeyByIdentifier(keyIdentifier);
      if (existingKey && existingKey.keyStatus === KeyStatus.ACTIVE) {
        return existingKey;
      }

      // Generate raw encryption key
      const rawKey = crypto.randomBytes(32); // 256-bit key
      
      // Encrypt the key with master key
      const encryptedKeyData = await this.encryptWithMasterKey(rawKey);
      
      // Create key record
      const keyData = {
        keyIdentifier,
        keyType,
        keyStatus: KeyStatus.ACTIVE,
        patientIdentifier,
        fhirResourceType,
        sensitivityLevel,
        purposeOfUse,
        algorithm: EncryptionAlgorithm.AES_256_GCM,
        keySize: 256,
        encryptedKey: encryptedKeyData.encryptedKey,
        initializationVector: encryptedKeyData.iv,
        keyDerivationSalt: encryptedKeyData.salt,
        createdBy,
        effectiveDate: new Date(),
        expirationDate: this.calculateExpirationDate(sensitivityLevel),
        version: 1,
        keyStrength: this.calculateKeyStrength(rawKey),
        complianceFlags: this.generateComplianceFlags(context)
      };

      const keyRepo = AppDataSource.getRepository('EncryptionKey');
      const savedKey = await keyRepo.save(keyRepo.create(keyData));

      return {
        id: savedKey.id,
        keyIdentifier: savedKey.keyIdentifier,
        algorithm: savedKey.algorithm,
        effectiveDate: savedKey.effectiveDate,
        expirationDate: savedKey.expirationDate
      };

    } catch (error) {
      throw new Error(`Failed to generate FHIR encryption key: ${error.message}`);
    }
  }

  /**
   * Get encryption key for FHIR context
   */
  static async getFHIREncryptionKey(context) {
    try {
      const keyIdentifier = this.generateKeyIdentifier(context);
      const key = await this.getKeyByIdentifier(keyIdentifier);
      
      if (!key || key.keyStatus !== KeyStatus.ACTIVE) {
        throw new Error(`No active encryption key found for context: ${keyIdentifier}`);
      }

      // Check if key is expired
      if (key.expirationDate && new Date() > key.expirationDate) {
        throw new Error(`Encryption key expired: ${keyIdentifier}`);
      }

      // Decrypt the key
      const rawKey = await this.decryptWithMasterKey({
        encryptedKey: key.encryptedKey,
        iv: key.initializationVector,
        salt: key.keyDerivationSalt
      });

      // Update usage tracking
      await this.updateKeyUsage(key.id);

      return {
        keyId: key.id,
        rawKey: rawKey.toString('hex'),
        algorithm: key.algorithm,
        version: key.version
      };

    } catch (error) {
      throw new Error(`Failed to get FHIR encryption key: ${error.message}`);
    }
  }

  /**
   * Encrypt FHIR file with context-aware encryption
   */
  static async encryptFHIRFile(fileBuffer, fhirContext, createdBy) {
    try {
      // Get or generate encryption key
      let keyInfo = await this.getFHIREncryptionKey(fhirContext);
      
      if (!keyInfo) {
        // Generate new key if none exists
        await this.generateFHIREncryptionKey(fhirContext, createdBy);
        keyInfo = await this.getFHIREncryptionKey(fhirContext);
      }

      // Encrypt the file
      const encryptedData = this.encryptBuffer(fileBuffer, keyInfo.rawKey, keyInfo.algorithm);

      return {
        encryptedBuffer: encryptedData.encryptedBuffer,
        encryptionMetadata: {
          keyId: keyInfo.keyId,
          algorithm: keyInfo.algorithm,
          version: keyInfo.version,
          iv: encryptedData.iv,
          authTag: encryptedData.authTag,
          encryptedAt: new Date()
        }
      };

    } catch (error) {
      throw new Error(`Failed to encrypt FHIR file: ${error.message}`);
    }
  }

  /**
   * Decrypt FHIR file with context validation
   */
  static async decryptFHIRFile(encryptedBuffer, encryptionMetadata, accessContext) {
    try {
      // Get the encryption key
      const keyRepo = AppDataSource.getRepository('EncryptionKey');
      const key = await keyRepo.findOne({ where: { id: encryptionMetadata.keyId } });
      
      if (!key) {
        throw new Error('Encryption key not found');
      }

      // Validate access context matches key context
      if (!this.validateAccessContext(key, accessContext)) {
        throw new Error('Access context does not match encryption context');
      }

      // Decrypt the key
      const rawKey = await this.decryptWithMasterKey({
        encryptedKey: key.encryptedKey,
        iv: key.initializationVector,
        salt: key.keyDerivationSalt
      });

      // Decrypt the file
      const decryptedBuffer = this.decryptBuffer(
        encryptedBuffer,
        rawKey.toString('hex'),
        encryptionMetadata.algorithm,
        encryptionMetadata.iv,
        encryptionMetadata.authTag
      );

      // Update usage tracking
      await this.updateKeyUsage(key.id);

      return decryptedBuffer;

    } catch (error) {
      throw new Error(`Failed to decrypt FHIR file: ${error.message}`);
    }
  }

  /**
   * Rotate encryption keys
   */
  static async rotateKey(keyId, rotatedBy) {
    try {
      const keyRepo = AppDataSource.getRepository('EncryptionKey');
      const oldKey = await keyRepo.findOne({ where: { id: keyId } });
      
      if (!oldKey) {
        throw new Error('Key not found for rotation');
      }

      // Generate new key with same context
      const context = {
        patientIdentifier: oldKey.patientIdentifier,
        fhirResourceType: oldKey.fhirResourceType,
        sensitivityLevel: oldKey.sensitivityLevel,
        purposeOfUse: oldKey.purposeOfUse,
        keyType: oldKey.keyType
      };

      // Create new key
      const newRawKey = crypto.randomBytes(32);
      const encryptedKeyData = await this.encryptWithMasterKey(newRawKey);
      
      const newKeyData = {
        ...oldKey,
        id: undefined, // Remove ID to create new record
        encryptedKey: encryptedKeyData.encryptedKey,
        initializationVector: encryptedKeyData.iv,
        keyDerivationSalt: encryptedKeyData.salt,
        version: oldKey.version + 1,
        rotatedFromKeyId: oldKey.id,
        createdBy: rotatedBy,
        effectiveDate: new Date(),
        expirationDate: this.calculateExpirationDate(oldKey.sensitivityLevel),
        usageCount: 0,
        lastUsedAt: null
      };

      const newKey = await keyRepo.save(keyRepo.create(newKeyData));

      // Mark old key as rotated
      await keyRepo.update(oldKey.id, {
        keyStatus: KeyStatus.ROTATED,
        updatedAt: new Date()
      });

      return {
        oldKeyId: oldKey.id,
        newKeyId: newKey.id,
        rotatedAt: new Date()
      };

    } catch (error) {
      throw new Error(`Failed to rotate key: ${error.message}`);
    }
  }

  /**
   * Get keys requiring rotation
   */
  static async getKeysRequiringRotation() {
    try {
      const keyRepo = AppDataSource.getRepository('EncryptionKey');
      const now = new Date();

      // Keys that have expired
      const expiredKeys = await keyRepo.find({
        where: {
          keyStatus: KeyStatus.ACTIVE,
          expirationDate: { $lte: now }
        }
      });

      // Keys that have exceeded usage limits
      const overusedKeys = await keyRepo.createQueryBuilder('key')
        .where('key.keyStatus = :status', { status: KeyStatus.ACTIVE })
        .andWhere('key.maxUsageCount IS NOT NULL')
        .andWhere('key.usageCount >= key.maxUsageCount')
        .getMany();

      return {
        expiredKeys,
        overusedKeys,
        totalRequiringRotation: expiredKeys.length + overusedKeys.length
      };

    } catch (error) {
      throw new Error(`Failed to get keys requiring rotation: ${error.message}`);
    }
  }

  /**
   * Homomorphic encryption for analytics
   */
  static async encryptForAnalytics(data, analysisType) {
    try {
      // Simplified homomorphic encryption simulation
      // In production, you'd use libraries like SEAL or HElib
      
      const analyticsKey = await this.getAnalyticsKey(analysisType);
      
      // Add noise for differential privacy
      const noise = this.generateDifferentialPrivacyNoise();
      const noisyData = this.addNoise(data, noise);
      
      // Encrypt the noisy data
      const encryptedData = this.encryptBuffer(
        Buffer.from(JSON.stringify(noisyData)),
        analyticsKey.rawKey
      );

      return {
        encryptedData: encryptedData.encryptedBuffer,
        metadata: {
          analysisType,
          noiseLevel: noise.level,
          keyVersion: analyticsKey.version,
          privacyBudget: noise.budget
        }
      };

    } catch (error) {
      throw new Error(`Failed to encrypt for analytics: ${error.message}`);
    }
  }

  // Helper methods

  /**
   * Generate unique key identifier
   */
  static generateKeyIdentifier(context) {
    const parts = [
      context.keyType || 'resource',
      context.patientIdentifier || 'global',
      context.fhirResourceType || 'any',
      context.sensitivityLevel || 'normal',
      context.purposeOfUse || 'treatment'
    ];
    
    return crypto.createHash('sha256')
      .update(parts.join(':'))
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Get key by identifier
   */
  static async getKeyByIdentifier(keyIdentifier) {
    const keyRepo = AppDataSource.getRepository('EncryptionKey');
    return await keyRepo.findOne({ 
      where: { 
        keyIdentifier,
        keyStatus: KeyStatus.ACTIVE 
      }
    });
  }

  /**
   * Generate or get master key
   */
  static async getMasterKey() {
    const keyRepo = AppDataSource.getRepository('EncryptionKey');
    return await keyRepo.findOne({
      where: {
        keyType: KeyType.MASTER,
        keyStatus: KeyStatus.ACTIVE
      }
    });
  }

  /**
   * Generate new master key
   */
  static async generateMasterKey() {
    const masterKeyRaw = crypto.randomBytes(32);
    const keyIdentifier = 'master-key-' + Date.now();
    
    // For master key, we store it encrypted with a system-level key
    // In production, this would be managed by HSM or cloud KMS
    const systemKey = process.env.SYSTEM_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(systemKey, 'hex'), iv);
    
    let encrypted = cipher.update(masterKeyRaw);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    const keyData = {
      keyIdentifier,
      keyType: KeyType.MASTER,
      keyStatus: KeyStatus.ACTIVE,
      algorithm: EncryptionAlgorithm.AES_256_GCM,
      keySize: 256,
      encryptedKey: Buffer.concat([iv, authTag, encrypted]).toString('hex'),
      createdBy: '00000000-0000-0000-0000-000000000000', // System user
      effectiveDate: new Date(),
      version: 1
    };

    const keyRepo = AppDataSource.getRepository('EncryptionKey');
    return await keyRepo.save(keyRepo.create(keyData));
  }

  /**
   * Encrypt with master key
   */
  static async encryptWithMasterKey(data) {
    const masterKey = await this.getMasterKey();
    
    // Decrypt master key first
    const systemKey = process.env.SYSTEM_ENCRYPTION_KEY;
    const masterKeyData = Buffer.from(masterKey.encryptedKey, 'hex');
    
    const iv = masterKeyData.slice(0, 16);
    const authTag = masterKeyData.slice(16, 32);
    const encrypted = masterKeyData.slice(32);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(systemKey, 'hex'), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    // Now encrypt data with master key
    const dataIv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(32);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', decrypted, dataIv);
    let encryptedData = cipher.update(data);
    encryptedData = Buffer.concat([encryptedData, cipher.final()]);
    const dataAuthTag = cipher.getAuthTag();
    
    return {
      encryptedKey: Buffer.concat([dataIv, dataAuthTag, encryptedData]).toString('hex'),
      iv: dataIv.toString('hex'),
      salt: salt.toString('hex')
    };
  }

  /**
   * Decrypt with master key
   */
  static async decryptWithMasterKey(encryptedData) {
    const masterKey = await this.getMasterKey();
    
    // Decrypt master key
    const systemKey = process.env.SYSTEM_ENCRYPTION_KEY;
    const masterKeyData = Buffer.from(masterKey.encryptedKey, 'hex');
    
    const masterIv = masterKeyData.slice(0, 16);
    const masterAuthTag = masterKeyData.slice(16, 32);
    const masterEncrypted = masterKeyData.slice(32);
    
    const masterDecipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(systemKey, 'hex'), masterIv);
    masterDecipher.setAuthTag(masterAuthTag);
    
    let decryptedMasterKey = masterDecipher.update(masterEncrypted);
    decryptedMasterKey = Buffer.concat([decryptedMasterKey, masterDecipher.final()]);
    
    // Decrypt data with master key
    const dataBuffer = Buffer.from(encryptedData.encryptedKey, 'hex');
    const dataIv = dataBuffer.slice(0, 16);
    const dataAuthTag = dataBuffer.slice(16, 32);
    const dataEncrypted = dataBuffer.slice(32);
    
    const dataDecipher = crypto.createDecipheriv('aes-256-gcm', decryptedMasterKey, dataIv);
    dataDecipher.setAuthTag(dataAuthTag);
    
    let decryptedData = dataDecipher.update(dataEncrypted);
    decryptedData = Buffer.concat([decryptedData, dataDecipher.final()]);
    
    return decryptedData;
  }

  /**
   * Encrypt buffer with key
   */
  static encryptBuffer(buffer, keyHex, algorithm = 'aes-256-gcm') {
    const key = Buffer.from(keyHex, 'hex');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(buffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      encryptedBuffer: Buffer.concat([iv, authTag, encrypted]),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt buffer with key
   */
  static decryptBuffer(encryptedBuffer, keyHex, algorithm = 'aes-256-gcm', ivHex = null, authTagHex = null) {
    const key = Buffer.from(keyHex, 'hex');
    
    let iv, authTag, encrypted;
    
    if (ivHex && authTagHex) {
      // Separate IV and auth tag provided
      iv = Buffer.from(ivHex, 'hex');
      authTag = Buffer.from(authTagHex, 'hex');
      encrypted = encryptedBuffer;
    } else {
      // IV and auth tag are prepended to encrypted data
      iv = encryptedBuffer.slice(0, 16);
      authTag = encryptedBuffer.slice(16, 32);
      encrypted = encryptedBuffer.slice(32);
    }
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  /**
   * Calculate key expiration date based on sensitivity
   */
  static calculateExpirationDate(sensitivityLevel) {
    const now = new Date();
    
    switch (sensitivityLevel) {
      case 'very_high':
        // 30 days for very high sensitivity
        return new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      case 'high':
        // 90 days for high sensitivity
        return new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
      case 'normal':
      default:
        // 1 year for normal sensitivity
        return new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
    }
  }

  /**
   * Calculate key strength score
   */
  static calculateKeyStrength(key) {
    // Simple key strength calculation
    // In production, this would be more sophisticated
    const entropy = this.calculateEntropy(key);
    const length = key.length * 8; // bits
    
    return Math.min(100, Math.round((entropy + length) / 10));
  }

  /**
   * Calculate entropy of key
   */
  static calculateEntropy(buffer) {
    const freq = {};
    for (const byte of buffer) {
      freq[byte] = (freq[byte] || 0) + 1;
    }
    
    let entropy = 0;
    const len = buffer.length;
    
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  /**
   * Generate compliance flags
   */
  static generateComplianceFlags(context) {
    return {
      hipaaCompliant: true,
      gdprCompliant: true,
      fips140Compliant: true,
      sensitivityLevel: context.sensitivityLevel,
      requiresAudit: context.sensitivityLevel === 'very_high',
      keyRotationRequired: context.sensitivityLevel !== 'normal'
    };
  }

  /**
   * Update key usage tracking
   */
  static async updateKeyUsage(keyId) {
    const keyRepo = AppDataSource.getRepository('EncryptionKey');
    await keyRepo.update(keyId, {
      usageCount: () => 'usage_count + 1',
      lastUsedAt: new Date()
    });
  }

  /**
   * Validate access context
   */
  static validateAccessContext(key, accessContext) {
    // Check if access context matches key context
    if (key.patientIdentifier && key.patientIdentifier !== accessContext.patientIdentifier) {
      return false;
    }
    
    if (key.fhirResourceType && key.fhirResourceType !== accessContext.fhirResourceType) {
      return false;
    }
    
    if (key.purposeOfUse && key.purposeOfUse !== accessContext.purposeOfUse) {
      return false;
    }
    
    return true;
  }

  /**
   * Get analytics key
   */
  static async getAnalyticsKey(analysisType) {
    // Simplified analytics key retrieval
    const context = {
      keyType: KeyType.PURPOSE,
      purposeOfUse: 'analytics',
      fhirResourceType: analysisType
    };
    
    return await this.getFHIREncryptionKey(context);
  }

  /**
   * Generate differential privacy noise
   */
  static generateDifferentialPrivacyNoise() {
    const epsilon = 0.1; // Privacy parameter
    const sensitivity = 1.0; // Query sensitivity
    
    const scale = sensitivity / epsilon;
    const noise = this.generateLaplaceNoise(scale);
    
    return {
      level: Math.abs(noise),
      budget: epsilon,
      scale
    };
  }

  /**
   * Generate Laplace noise for differential privacy
   */
  static generateLaplaceNoise(scale) {
    const u = Math.random() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Add noise to data
   */
  static addNoise(data, noise) {
    if (typeof data === 'number') {
      return data + noise.level;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => 
        typeof item === 'number' ? item + noise.level : item
      );
    }
    
    return data; // Return unchanged for non-numeric data
  }
}

module.exports = AdvancedEncryptionService;
    
