// ===== 3. DATA GOVERNANCE SERVICE =====
// src/services/dataGovernanceService.js
const AppDataSource = require('../../../config/database');
const AdvancedAuditService = require('./advancedAuditService');
const ConsentService = require('./consentService');
const crypto = require('crypto');

class DataGovernanceService {

  /**
   * Initialize data governance system
   */
  static async initialize() {
    try {
      // Load default policies
      await this.loadDefaultPolicies();
      
      // Start automated enforcement
      await this.startAutomatedEnforcement();
      
      console.log('Data Governance Service initialized');
      
    } catch (error) {
      throw new Error(`Failed to initialize data governance: ${error.message}`);
    }
  }

  /**
   * Apply data retention policy
   */
  static async applyRetentionPolicy(policyId, dryRun = false) {
    try {
      const policyRepo = AppDataSource.getRepository('DataGovernancePolicy');
      const policy = await policyRepo.findOne({ where: { id: policyId } });
      
      if (!policy || policy.policyType !== PolicyType.RETENTION) {
        throw new Error('Invalid retention policy');
      }

      const rules = policy.policyRules;
      const affectedFiles = [];
      const fileRepo = AppDataSource.getRepository('DocumentFile');

      // Calculate retention period
      const retentionDays = rules.retentionDays || 2555; // 7 years default
      const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

      // Find files that exceed retention period
      let queryBuilder = fileRepo.createQueryBuilder('file')
        .where('file.createdAt < :cutoffDate', { cutoffDate });

      // Apply data type filters
      if (rules.applicableDataTypes && rules.applicableDataTypes.length > 0) {
        queryBuilder.andWhere('file.fhirResourceType IN (:...dataTypes)', {
          dataTypes: rules.applicableDataTypes
        });
      }

      // Apply sensitivity filters
      if (rules.sensitivityLevels && rules.sensitivityLevels.length > 0) {
        queryBuilder.andWhere('file.fhirSensitivityLevel IN (:...sensitivityLevels)', {
          sensitivityLevels: rules.sensitivityLevels
        });
      }

      const expiredFiles = await queryBuilder.getMany();

      for (const file of expiredFiles) {
        affectedFiles.push({
          fileId: file.id,
          fileName: file.originalFileName,
          createdAt: file.createdAt,
          retentionDaysExceeded: Math.floor((Date.now() - file.createdAt.getTime()) / (24 * 60 * 60 * 1000)) - retentionDays
        });

        if (!dryRun) {
          // Apply retention action based on policy
          switch (rules.retentionAction) {
            case 'delete':
              await this.secureDelete(file);
              break;
            case 'archive':
              await this.archiveFile(file, rules.archiveLocation);
              break;
            case 'anonymize':
              await this.anonymizeFile(file);
              break;
            default:
              console.warn(`Unknown retention action: ${rules.retentionAction}`);
          }

          // Record data lineage
          await this.recordDataLineage({
            sourceId: file.id,
            sourceType: 'file',
            transformationType: rules.retentionAction,
            transformationRules: rules,
            transformedBy: policy.policyOwner,
            purposeOfTransformation: 'data_retention_policy'
          });
        }
      }

      // Update policy metrics
      if (!dryRun) {
        await policyRepo.update(policyId, {
          enforcementCount: () => 'enforcement_count + 1',
          lastEnforcedAt: new Date()
        });

        // Log enforcement
        await AdvancedAuditService.logEvent({
          eventType: 'data_retention_enforcement',
          severity: 'medium',
          eventDescription: `Applied retention policy ${policy.policyName}`,
          metadata: {
            policyId,
            filesProcessed: affectedFiles.length,
            retentionAction: rules.retentionAction
          }
        });
      }

      return {
        success: true,
        policyName: policy.policyName,
        affectedFiles,
        dryRun,
        summary: {
          totalFiles: affectedFiles.length,
          retentionDays,
          action: rules.retentionAction
        }
      };

    } catch (error) {
      throw new Error(`Failed to apply retention policy: ${error.message}`);
    }
  }

  /**
   * Anonymize patient data for research
   */
  static async anonymizeForResearch(datasetId, anonymizationLevel = 'k-anonymity', k = 5) {
    try {
      const fileRepo = AppDataSource.getRepository('DocumentFile');
      
      // Get files in dataset (assuming dataset is a folder or collection)
      const files = await fileRepo.find({
        where: {
          folder: { id: datasetId },
          fhirResourceType: { $ne: null }
        },
        relations: ['folder']
      });

      const anonymizedFiles = [];
      const privacyBudget = this.calculatePrivacyBudget(files.length, anonymizationLevel);

      for (const file of files) {
        // Read and decrypt file
        const fileContent = await this.readAndDecryptFile(file);
        
        // Parse FHIR content
        let fhirData;
        try {
          fhirData = JSON.parse(fileContent.toString());
        } catch (error) {
          console.warn(`Skipping non-FHIR file: ${file.originalFileName}`);
          continue;
        }

        // Apply anonymization based on level
        let anonymizedData;
        switch (anonymizationLevel) {
          case 'k-anonymity':
            anonymizedData = await this.applyKAnonymity(fhirData, k);
            break;
          case 'l-diversity':
            anonymizedData = await this.applyLDiversity(fhirData, k, 2);
            break;
          case 'differential-privacy':
            anonymizedData = await this.applyDifferentialPrivacy(fhirData, privacyBudget.epsilon);
            break;
          case 'synthetic':
            anonymizedData = await this.generateSyntheticData(fhirData);
            break;
          default:
            anonymizedData = await this.applyBasicAnonymization(fhirData);
        }

        // Generate anonymized file
        const anonymizedFileName = `anon_${crypto.randomUUID()}_${file.originalFileName}`;
        const anonymizedBuffer = Buffer.from(JSON.stringify(anonymizedData));

        // Create new file record
        const anonymizedFileData = {
          originalFileName: anonymizedFileName,
          storedFileName: anonymizedFileName,
          filePath: `anonymized/${anonymizedFileName}`,
          fileSize: anonymizedBuffer.length,
          mimeType: 'application/json',
          fileHash: crypto.createHash('sha256').update(anonymizedBuffer).digest('hex'),
          documentType: `anonymized_${file.documentType}`,
          folder: file.folder,
          uploader: file.uploader,
          status: 'ready',
          isEncrypted: false, // Anonymized data doesn't need encryption
          fhirResourceType: file.fhirResourceType,
          patientIdentifier: null, // Remove patient identifier
          fhirSensitivityLevel: 'normal', // Anonymized data is less sensitive
          metadata: {
            originalFileId: file.id,
            anonymizationLevel,
            anonymizedAt: new Date(),
            privacyParameters: { k, epsilon: privacyBudget.epsilon }
          }
        };

        const anonymizedFile = await fileRepo.save(fileRepo.create(anonymizedFileData));
        anonymizedFiles.push(anonymizedFile);

        // Record data lineage
        await this.recordDataLineage({
          sourceId: file.id,
          sourceType: 'file',
          destinationId: anonymizedFile.id,
          destinationType: 'file',
          transformationType: 'anonymization',
          transformationRules: {
            anonymizationLevel,
            parameters: { k, epsilon: privacyBudget.epsilon }
          },
          algorithmUsed: anonymizationLevel,
          privacyLevel: 'anonymized',
          anonymizationLevel,
          privacyBudgetUsed: privacyBudget.budgetUsed,
          transformedBy: '00000000-0000-0000-0000-000000000000', // System
          purposeOfTransformation: 'research_anonymization'
        });
      }

      // Log anonymization process
      await AdvancedAuditService.logEvent({
        eventType: 'anonymization',
        severity: 'medium',
        eventDescription: `Anonymized ${files.length} files for research`,
        metadata: {
          datasetId,
          anonymizationLevel,
          originalFiles: files.length,
          anonymizedFiles: anonymizedFiles.length,
          privacyBudgetUsed: privacyBudget.budgetUsed
        }
      });

      return {
        success: true,
        originalFiles: files.length,
        anonymizedFiles: anonymizedFiles.map(f => ({
          id: f.id,
          fileName: f.originalFileName,
          resourceType: f.fhirResourceType,
          fileSize: f.fileSize
        })),
        anonymizationLevel,
        privacyParameters: {
          k: anonymizationLevel === 'k-anonymity' ? k : undefined,
          epsilon: privacyBudget.epsilon,
          budgetUsed: privacyBudget.budgetUsed
        }
      };

    } catch (error) {
      throw new Error(`Failed to anonymize data for research: ${error.message}`);
    }
  }

  /**
   * Enforce cross-border data transfer policies
   */
  static async enforceCrossBorderPolicy(transferRequest) {
    try {
      const {
        sourceJurisdiction,
        destinationJurisdiction,
        dataTypes,
        transferPurpose,
        transferMechanism
      } = transferRequest;

      // Get applicable cross-border policies
      const policyRepo = AppDataSource.getRepository('DataGovernancePolicy');
      const policies = await policyRepo.find({
        where: {
          policyType: PolicyType.CROSS_BORDER,
          policyStatus: PolicyStatus.ACTIVE,
          applicableJurisdictions: { $contains: [sourceJurisdiction] }
        }
      });

      const validationResults = {
        allowed: true,
        restrictions: [],
        requirements: [],
        violatingPolicies: []
      };

      for (const policy of policies) {
        const rules = policy.policyRules;
        
        // Check destination restrictions
        if (rules.blockedDestinations && rules.blockedDestinations.includes(destinationJurisdiction)) {
          validationResults.allowed = false;
          validationResults.violatingPolicies.push({
            policyId: policy.id,
            policyName: policy.policyName,
            violation: `Transfer to ${destinationJurisdiction} is blocked`
          });
        }

        // Check data type restrictions
        if (rules.restrictedDataTypes) {
          const restrictedTypes = dataTypes.filter(type => 
            rules.restrictedDataTypes.includes(type)
          );
          
          if (restrictedTypes.length > 0) {
            validationResults.restrictions.push({
              policyId: policy.id,
              restriction: `Data types ${restrictedTypes.join(', ')} have transfer restrictions`,
              requiresApproval: rules.requiresApproval || false
            });
          }
        }

        // Check adequacy requirements
        if (rules.adequacyRequirements) {
          const requirement = rules.adequacyRequirements[destinationJurisdiction];
          if (requirement) {
            validationResults.requirements.push({
              policyId: policy.id,
              requirement: requirement.mechanism,
              description: requirement.description
            });

            // Validate transfer mechanism
            if (!requirement.allowedMechanisms.includes(transferMechanism)) {
              validationResults.allowed = false;
              validationResults.violatingPolicies.push({
                policyId: policy.id,
                policyName: policy.policyName,
                violation: `Transfer mechanism '${transferMechanism}' not allowed. Required: ${requirement.allowedMechanisms.join(', ')}`
              });
            }
          }
        }

        // Check purpose restrictions
        if (rules.allowedPurposes && !rules.allowedPurposes.includes(transferPurpose)) {
          validationResults.allowed = false;
          validationResults.violatingPolicies.push({
            policyId: policy.id,
            policyName: policy.policyName,
            violation: `Transfer purpose '${transferPurpose}' not allowed`
          });
        }
      }

      // Log cross-border transfer validation
      await AdvancedAuditService.logEvent({
        eventType: 'cross_border_validation',
        severity: validationResults.allowed ? 'low' : 'high',
        eventDescription: `Cross-border transfer validation ${validationResults.allowed ? 'passed' : 'failed'}`,
        metadata: {
          transferRequest,
          validationResults,
          policiesEvaluated: policies.length
        }
      });

      return {
        success: true,
        validationResults,
        transferAllowed: validationResults.allowed,
        evaluatedPolicies: policies.length
      };

    } catch (error) {
      throw new Error(`Failed to enforce cross-border policy: ${error.message}`);
    }
  }

  /**
   * Generate privacy-preserving analytics
   */
  static async generatePrivacyPreservingAnalytics(query, privacyLevel = 'differential') {
    try {
      const {
        resourceType,
        aggregationType,
        groupBy,
        dateRange,
        filters
      } = query;

      // Validate privacy budget
      const privacyBudget = await this.checkPrivacyBudget(query);
      if (privacyBudget.available < privacyBudget.required) {
        throw new Error('Insufficient privacy budget for this query');
      }

      const fileRepo = AppDataSource.getRepository('DocumentFile');
      
      // Build query
      let queryBuilder = fileRepo.createQueryBuilder('file')
        .where('file.fhirResourceType = :resourceType', { resourceType });

      // Apply filters
      if (filters.sensitivityLevel) {
        queryBuilder.andWhere('file.fhirSensitivityLevel = :sensitivity', {
          sensitivity: filters.sensitivityLevel
        });
      }

      if (dateRange) {
        queryBuilder.andWhere('file.createdAt BETWEEN :startDate AND :endDate', {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        });
      }

      // Execute base query
      const baseResults = await queryBuilder.getMany();

      // Apply privacy-preserving techniques
      let analyticsResults;
      switch (privacyLevel) {
        case 'differential':
          analyticsResults = await this.applyDifferentialPrivacyToAnalytics(
            baseResults, 
            aggregationType, 
            groupBy, 
            privacyBudget.epsilon
          );
          break;
        case 'k-anonymity':
          analyticsResults = await this.applyKAnonymityToAnalytics(
            baseResults, 
            aggregationType, 
            groupBy, 
            5
          );
          break;
        case 'synthetic':
          analyticsResults = await this.generateSyntheticAnalytics(
            baseResults, 
            aggregationType, 
            groupBy
          );
          break;
        default:
          throw new Error(`Unknown privacy level: ${privacyLevel}`);
      }

      // Update privacy budget
      await this.updatePrivacyBudget(query, privacyBudget.required);

      // Log analytics query
      await AdvancedAuditService.logEvent({
        eventType: 'privacy_preserving_analytics',
        severity: 'medium',
        eventDescription: `Generated privacy-preserving analytics`,
        metadata: {
          query,
          privacyLevel,
          recordsAnalyzed: baseResults.length,
          privacyBudgetUsed: privacyBudget.required
        }
      });

      return {
        success: true,
        results: analyticsResults,
        metadata: {
          privacyLevel,
          recordsAnalyzed: baseResults.length,
          privacyBudgetUsed: privacyBudget.required,
          remainingBudget: privacyBudget.available - privacyBudget.required
        }
      };

    } catch (error) {
      throw new Error(`Failed to generate privacy-preserving analytics: ${error.message}`);
    }
  }

  /**
   * Automated data classification
   */
  static async classifyData(fileId) {
    try {
      const fileRepo = AppDataSource.getRepository('DocumentFile');
      const file = await fileRepo.findOne({ where: { id: fileId } });
      
      if (!file) {
        throw new Error('File not found');
      }

      // Read file content
      const fileContent = await this.readAndDecryptFile(file);
      
      let classification = {
        dataTypes: [],
        sensitivityLevel: 'normal',
        complianceFlags: [],
        riskScore: 0,
        recommendations: []
      };

      // FHIR-based classification
      if (file.fhirResourceType) {
        classification = await this.classifyFHIRData(fileContent, file.fhirResourceType);
      } else {
        // Content-based classification
        classification = await this.classifyContentBased(fileContent, file.mimeType);
      }

      // Apply machine learning classification if available
      if (process.env.ML_CLASSIFICATION_ENABLED === 'true') {
        const mlClassification = await this.applyMLClassification(fileContent);
        classification = this.mergeClassifications(classification, mlClassification);
      }

      // Update file with classification
      await fileRepo.update(fileId, {
        fhirSensitivityLevel: classification.sensitivityLevel,
        metadata: {
          ...file.metadata,
          autoClassification: {
            ...classification,
            classifiedAt: new Date(),
            classificationVersion: '1.0'
          }
        }
      });

      // Log classification
      await AdvancedAuditService.logEvent({
        eventType: 'data_classification',
        severity: 'low',
        eventDescription: `Automatically classified file ${file.originalFileName}`,
        resourceId: fileId,
        metadata: {
          classification,
          previousSensitivity: file.fhirSensitivityLevel
        }
      });

      return {
        success: true,
        fileId,
        classification
      };

    } catch (error) {
      throw new Error(`Failed to classify data: ${error.message}`);
    }
  }

  // Helper methods for anonymization

  /**
   * Apply k-anonymity to FHIR data
   */
  static async applyKAnonymity(fhirData, k = 5) {
    const anonymized = JSON.parse(JSON.stringify(fhirData));

    // Remove direct identifiers
    const directIdentifiers = [
      'id', 'identifier', 'name', 'telecom', 'address', 
      'photo', 'contact', 'communication'
    ];

    directIdentifiers.forEach(field => {
      if (anonymized[field]) {
        delete anonymized[field];
      }
    });

    // Generalize quasi-identifiers
    if (anonymized.birthDate) {
      // Generalize birth date to year only
      anonymized.birthDate = new Date(anonymized.birthDate).getFullYear().toString();
    }

    if (anonymized.gender) {
      // Keep gender as is (small domain)
    }

    // Handle nested resources
    if (anonymized.entry && Array.isArray(anonymized.entry)) {
      anonymized.entry = anonymized.entry.map(entry => 
        this.applyKAnonymity(entry.resource, k)
      );
    }

    return anonymized;
  }

  /**
   * Apply L-diversity
   */
  static async applyLDiversity(fhirData, k = 5, l = 2) {
    // First apply k-anonymity
    let anonymized = await this.applyKAnonymity(fhirData, k);

    // Then ensure l-diversity for sensitive attributes
    // This is a simplified implementation
    const sensitiveAttributes = ['diagnosis', 'condition', 'medication'];
    
    sensitiveAttributes.forEach(attr => {
      if (anonymized[attr]) {
        // Add noise or generalize sensitive attributes
        anonymized[attr] = this.generalizeSensitiveAttribute(anonymized[attr]);
      }
    });

    return anonymized;
  }

  /**
   * Apply differential privacy
   */
  static async applyDifferentialPrivacy(fhirData, epsilon = 0.1) {
    const anonymized = JSON.parse(JSON.stringify(fhirData));

    // Add calibrated noise to numeric fields
    const numericFields = ['age', 'value', 'quantity'];
    
    numericFields.forEach(field => {
      if (anonymized[field] && typeof anonymized[field] === 'number') {
        const noise = this.generateLaplaceNoise(1 / epsilon);
        anonymized[field] = Math.max(0, anonymized[field] + noise);
      }
    });

    // Remove or hash identifiers
    if (anonymized.id) {
      anonymized.id = crypto.createHash('sha256')
        .update(anonymized.id + Math.random().toString())
        .digest('hex')
        .substring(0, 8);
    }

    return anonymized;
  }

  /**
   * Generate synthetic FHIR data
   */
  static async generateSyntheticData(fhirData) {
    // This is a simplified synthetic data generation
    // In production, you'd use more sophisticated techniques
    
    const synthetic = {
      resourceType: fhirData.resourceType,
      meta: {
        tag: [{
          system: "http://terminology.hl7.org/CodeSystem/v3-ObservationValue",
          code: "SYNTH",
          display: "Synthetic"
        }]
      }
    };

    // Generate synthetic values based on original data structure
    if (fhirData.resourceType === 'Patient') {
      synthetic.gender = this.generateSyntheticGender();
      synthetic.birthDate = this.generateSyntheticBirthDate();
    } else if (fhirData.resourceType === 'Observation') {
      synthetic.status = 'final';
      synthetic.code = fhirData.code; // Keep observation type
      synthetic.valueQuantity = this.generateSyntheticValue(fhirData.valueQuantity);
    }

    return synthetic;
  }

  /**
   * Calculate privacy budget
   */
  static calculatePrivacyBudget(recordCount, anonymizationLevel) {
    let baseBudget = 1.0; // Total privacy budget
    
    switch (anonymizationLevel) {
      case 'differential-privacy':
        return {
          epsilon: Math.min(1.0, baseBudget / Math.log(recordCount)),
          budgetUsed: baseBudget / Math.log(recordCount)
        };
      case 'k-anonymity':
        return {
          epsilon: 0, // No differential privacy budget used
          budgetUsed: 0
        };
      default:
        return {
          epsilon: 0.1,
          budgetUsed: 0.1
        };
    }
  }

  /**
   * Check privacy budget availability
   */
  static async checkPrivacyBudget(query) {
    // Simplified privacy budget tracking
    // In production, this would be more sophisticated
    
    const dailyBudget = 10.0; // Total daily budget
    const usedBudget = 0; // Would be tracked in database
    const required = 0.1; // Required for this query
    
    return {
      available: dailyBudget - usedBudget,
      required,
      remaining: dailyBudget - usedBudget - required
    };
  }

  /**
   * Update privacy budget tracking
   */
  static async updatePrivacyBudget(query, budgetUsed) {
    // Track privacy budget usage in database
    const budgetRepo = AppDataSource.getRepository('PrivacyBudgetTracking');
    // Implementation would track budget usage per query/user/time period
  }

  /**
   * Generate Laplace noise for differential privacy
   */
  static generateLaplaceNoise(scale) {
    const u = Math.random() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Record data lineage
   */
  static async recordDataLineage(lineageData) {
    const lineageRepo = AppDataSource.getRepository('DataLineage');
    const lineage = lineageRepo.create({
      ...lineageData,
      transformedAt: lineageData.transformedAt || new Date()
    });
    
    return await lineageRepo.save(lineage);
  }

  /**
   * Secure file deletion
   */
  static async secureDelete(file) {
    // Implement secure deletion (overwrite file multiple times)
    // This is a placeholder - actual implementation would depend on storage system
    console.log(`Securely deleting file: ${file.id}`);
    
    // Update database record
    const fileRepo = AppDataSource.getRepository('DocumentFile');
    await fileRepo.update(file.id, {
      status: 'deleted',
      metadata: {
        ...file.metadata,
        securelyDeletedAt: new Date(),
        deletionMethod: 'secure_overwrite'
      }
    });
  }

  /**
   * Load default governance policies
   */
  static async loadDefaultPolicies() {
    const policyRepo = AppDataSource.getRepository('DataGovernancePolicy');
    
    // Check if default policies already exist
    const existingPolicies = await policyRepo.count();
    if (existingPolicies > 0) {
      return; // Policies already loaded
    }

    const defaultPolicies = [
      {
        policyName: 'HIPAA Data Retention',
        policyType: PolicyType.RETENTION,
        policyDescription: 'Retain medical records for 7 years as required by HIPAA',
        policyRules: {
          retentionDays: 2555, // 7 years
          retentionAction: 'archive',
          applicableDataTypes: ['Patient', 'Observation', 'DiagnosticReport'],
          archiveLocation: 's3://medical-archive'
        },
        applicableJurisdictions: ['us'],
        complianceFrameworks: ['hipaa'],
        effectiveDate: new Date(),
        policyOwner: '00000000-0000-0000-0000-000000000000' // System
      },
      {
        policyName: 'EU-US Data Transfer Restrictions',
        policyType: PolicyType.CROSS_BORDER,
        policyDescription: 'Restrict data transfers from EU to US unless adequate protections',
        policyRules: {
          blockedDestinations: [],
          adequacyRequirements: {
            'us': {
              mechanism: 'Standard Contractual Clauses',
              description: 'Transfers to US require SCCs or adequacy decision',
              allowedMechanisms: ['scc', 'adequacy', 'binding_corporate_rules']
            }
          },
          allowedPurposes: ['treatment', 'healthcare_operations']
        },
        applicableJurisdictions: ['eu'],
        complianceFrameworks: ['gdpr'],
        effectiveDate: new Date(),
        policyOwner: '00000000-0000-0000-0000-000000000000'
      }
    ];

    for (const policyData of defaultPolicies) {
      await policyRepo.save(policyRepo.create(policyData));
    }

    console.log('Loaded default governance policies');
  }

  /**
   * Start automated policy enforcement
   */
  static async startAutomatedEnforcement() {
    // Set up automated enforcement schedules
    setInterval(async () => {
      try {
        await this.runAutomatedEnforcement();
      } catch (error) {
        console.error('Automated enforcement error:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run daily

    console.log('Started automated policy enforcement');
  }

  /**
   * Run automated policy enforcement
   */
  static async runAutomatedEnforcement() {
    const policyRepo = AppDataSource.getRepository('DataGovernancePolicy');
    
    const automatedPolicies = await policyRepo.find({
      where: {
        policyStatus: PolicyStatus.ACTIVE,
        isAutomated: true
      }
    });

    for (const policy of automatedPolicies) {
      try {
        switch (policy.policyType) {
          case PolicyType.RETENTION:
            await this.applyRetentionPolicy(policy.id);
            break;
          case PolicyType.DATA_CLASSIFICATION:
            await this.runAutomatedClassification();
            break;
          // Add other automated policy types
        }
      } catch (error) {
        console.error(`Failed to enforce policy ${policy.id}:`, error);
        
        // Update policy with violation count
        await policyRepo.update(policy.id, {
          violationCount: () => 'violation_count + 1'
        });
      }
    }
  }

    // ===== ADDITIONAL HELPER METHODS FOR DATA GOVERNANCE =====
    // Add these methods to the DataGovernanceService class

    /**
     * Generate synthetic gender based on statistical distribution
     */
    static generateSyntheticGender() {
    const genders = ['male', 'female', 'other', 'unknown'];
    const weights = [0.49, 0.49, 0.01, 0.01]; // Approximate real-world distribution
    
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (let i = 0; i < genders.length; i++) {
        cumulativeWeight += weights[i];
        if (random <= cumulativeWeight) {
        return genders[i];
        }
    }
    
    return 'unknown';
    }

    /**
     * Generate synthetic birth date with realistic age distribution
     */
    static generateSyntheticBirthDate() {
    // Generate age following healthcare population distribution
    const ageDistribution = {
        '0-18': 0.22,    // 22% children/teens
        '19-35': 0.25,   // 25% young adults
        '36-55': 0.28,   // 28% middle-aged
        '56-75': 0.20,   // 20% older adults
        '76+': 0.05      // 5% elderly
    };
    
    const random = Math.random();
    let ageRange;
    
    if (random <= 0.22) ageRange = [0, 18];
    else if (random <= 0.47) ageRange = [19, 35];
    else if (random <= 0.75) ageRange = [36, 55];
    else if (random <= 0.95) ageRange = [56, 75];
    else ageRange = [76, 95];
    
    const age = Math.floor(Math.random() * (ageRange[1] - ageRange[0] + 1)) + ageRange[0];
    const birthYear = new Date().getFullYear() - age;
    const birthMonth = Math.floor(Math.random() * 12) + 1;
    const birthDay = Math.floor(Math.random() * 28) + 1; // Simplified to avoid date validation
    
    return `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
    }

    /**
     * Generate synthetic observation value based on original data patterns
     */
    static generateSyntheticValue(originalValue) {
    if (!originalValue || !originalValue.value) {
        return null;
    }
    
    const original = originalValue.value;
    let syntheticValue;
    
    // Add realistic noise based on measurement type
    if (originalValue.unit) {
        switch (originalValue.unit.toLowerCase()) {
        case 'mmhg': // Blood pressure
            syntheticValue = this.addGaussianNoise(original, original * 0.1);
            break;
        case 'mg/dl': // Blood glucose
            syntheticValue = this.addGaussianNoise(original, original * 0.15);
            break;
        case 'bpm': // Heart rate
            syntheticValue = this.addGaussianNoise(original, 5);
            break;
        case 'kg': // Weight
            syntheticValue = this.addGaussianNoise(original, original * 0.05);
            break;
        case 'cm': // Height
            syntheticValue = this.addGaussianNoise(original, 2);
            break;
        default:
            syntheticValue = this.addGaussianNoise(original, original * 0.1);
        }
    } else {
        syntheticValue = this.addGaussianNoise(original, original * 0.1);
    }
    
    return {
        value: Math.max(0, Math.round(syntheticValue * 100) / 100), // Ensure positive, round to 2 decimals
        unit: originalValue.unit,
        system: originalValue.system
    };
    }

    /**
     * Add Gaussian noise to a value
     */
    static addGaussianNoise(value, standardDeviation) {
    // Box-Muller transform for Gaussian noise
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    return value + (z * standardDeviation);
    }

    /**
     * Generalize sensitive attribute for L-diversity
     */
    static generalizeSensitiveAttribute(attribute) {
    if (typeof attribute === 'string') {
        // For diagnosis codes, generalize to broader categories
        if (attribute.startsWith('E')) {
        return 'E00-E99'; // Endocrine, nutritional and metabolic diseases
        } else if (attribute.startsWith('I')) {
        return 'I00-I99'; // Diseases of the circulatory system
        } else if (attribute.startsWith('J')) {
        return 'J00-J99'; // Diseases of the respiratory system
        } else if (attribute.startsWith('K')) {
        return 'K00-K99'; // Diseases of the digestive system
        } else {
        return 'Other'; // Generic category
        }
    }
    
    if (typeof attribute === 'number') {
        // Generalize numeric values to ranges
        if (attribute < 10) return '0-10';
        else if (attribute < 50) return '10-50';
        else if (attribute < 100) return '50-100';
        else return '100+';
    }
    
    return attribute;
    }

    /**
     * Apply differential privacy to analytics results
     */
    static async applyDifferentialPrivacyToAnalytics(baseResults, aggregationType, groupBy, epsilon) {
    const analytics = {};
    
    // Group results
    const groups = this.groupResultsByField(baseResults, groupBy);
    
    for (const [groupValue, records] of Object.entries(groups)) {
        let aggregateValue;
        
        switch (aggregationType) {
        case 'count':
            aggregateValue = records.length;
            break;
        case 'average':
            const sum = records.reduce((sum, record) => sum + (record.numericValue || 0), 0);
            aggregateValue = sum / records.length;
            break;
        case 'sum':
            aggregateValue = records.reduce((sum, record) => sum + (record.numericValue || 0), 0);
            break;
        default:
            aggregateValue = records.length;
        }
        
        // Add Laplace noise for differential privacy
        const sensitivity = this.calculateSensitivity(aggregationType);
        const noise = this.generateLaplaceNoise(sensitivity / epsilon);
        const noisyValue = Math.max(0, aggregateValue + noise);
        
        analytics[groupValue] = {
        value: Math.round(noisyValue * 100) / 100,
        noiseAdded: Math.abs(noise),
        originalCount: records.length,
        privacyBudget: epsilon
        };
    }
    
    return analytics;
    }

    /**
     * Apply k-anonymity to analytics results
     */
    static async applyKAnonymityToAnalytics(baseResults, aggregationType, groupBy, k) {
    const analytics = {};
    const groups = this.groupResultsByField(baseResults, groupBy);
    
    for (const [groupValue, records] of Object.entries(groups)) {
        // Only include groups with at least k records
        if (records.length >= k) {
        let aggregateValue;
        
        switch (aggregationType) {
            case 'count':
            // Round count to nearest k to maintain k-anonymity
            aggregateValue = Math.floor(records.length / k) * k;
            break;
            case 'average':
            const sum = records.reduce((sum, record) => sum + (record.numericValue || 0), 0);
            aggregateValue = sum / records.length;
            break;
            case 'sum':
            aggregateValue = records.reduce((sum, record) => sum + (record.numericValue || 0), 0);
            break;
            default:
            aggregateValue = Math.floor(records.length / k) * k;
        }
        
        analytics[groupValue] = {
            value: aggregateValue,
            recordCount: Math.floor(records.length / k) * k,
            kValue: k,
            suppressed: records.length < k
        };
        }
        // Groups with < k records are suppressed (not included in results)
    }
    
    return analytics;
    }

    /**
     * Generate synthetic analytics based on patterns in real data
     */
    static async generateSyntheticAnalytics(baseResults, aggregationType, groupBy) {
    const analytics = {};
    const groups = this.groupResultsByField(baseResults, groupBy);
    
    // Learn patterns from real data
    const patterns = this.learnDataPatterns(groups, aggregationType);
    
    // Generate synthetic results based on learned patterns
    for (const [groupValue, records] of Object.entries(groups)) {
        const syntheticValue = this.generateSyntheticAggregate(
        patterns,
        groupValue,
        aggregationType,
        records.length
        );
        
        analytics[groupValue] = {
        value: syntheticValue,
        dataType: 'synthetic',
        basedOnRecords: records.length,
        confidence: this.calculateConfidence(records.length)
        };
    }
    
    return analytics;
    }

    /**
     * Group results by specified field
     */
    static groupResultsByField(results, groupBy) {
    const groups = {};
    
    for (const result of results) {
        let groupValue;
        
        switch (groupBy) {
        case 'age_group':
            groupValue = this.categorizeAge(result.metadata?.patientAge);
            break;
        case 'resource_type':
            groupValue = result.fhirResourceType || 'unknown';
            break;
        case 'sensitivity_level':
            groupValue = result.fhirSensitivityLevel || 'normal';
            break;
        case 'month':
            groupValue = new Date(result.createdAt).toISOString().substring(0, 7); // YYYY-MM
            break;
        default:
            groupValue = result[groupBy] || 'unknown';
        }
        
        if (!groups[groupValue]) {
        groups[groupValue] = [];
        }
        groups[groupValue].push(result);
    }
    
    return groups;
    }

    /**
     * Categorize age into groups
     */
    static categorizeAge(age) {
    if (!age) return 'unknown';
    
    if (age < 18) return '0-17';
    else if (age < 35) return '18-34';
    else if (age < 55) return '35-54';
    else if (age < 75) return '55-74';
    else return '75+';
    }

    /**
     * Calculate sensitivity for differential privacy
     */
    static calculateSensitivity(aggregationType) {
    switch (aggregationType) {
        case 'count':
        return 1; // Adding/removing one record changes count by 1
        case 'sum':
        return 1; // Assuming normalized values
        case 'average':
        return 1; // Simplified assumption
        default:
        return 1;
    }
    }

    /**
     * Learn data patterns for synthetic generation
     */
    static learnDataPatterns(groups, aggregationType) {
    const patterns = {
        distributions: {},
        correlations: {},
        trends: {}
    };
    
    const groupSizes = Object.values(groups).map(group => group.length);
    const values = [];
    
    for (const [groupValue, records] of Object.entries(groups)) {
        let aggregateValue;
        
        switch (aggregationType) {
        case 'count':
            aggregateValue = records.length;
            break;
        case 'average':
            const sum = records.reduce((sum, record) => sum + (record.numericValue || 0), 0);
            aggregateValue = sum / records.length;
            break;
        case 'sum':
            aggregateValue = records.reduce((sum, record) => sum + (record.numericValue || 0), 0);
            break;
        default:
            aggregateValue = records.length;
        }
        
        values.push(aggregateValue);
        patterns.distributions[groupValue] = {
        mean: aggregateValue,
        variance: this.calculateVariance(records, aggregationType)
        };
    }
    
    // Calculate overall statistics
    patterns.overallMean = values.reduce((sum, val) => sum + val, 0) / values.length;
    patterns.overallVariance = this.calculateArrayVariance(values);
    patterns.minValue = Math.min(...values);
    patterns.maxValue = Math.max(...values);
    
    return patterns;
    }

    /**
     * Generate synthetic aggregate value
     */
    static generateSyntheticAggregate(patterns, groupValue, aggregationType, baseRecordCount) {
    // Use learned patterns to generate realistic synthetic value
    const groupPattern = patterns.distributions[groupValue];
    
    if (groupPattern) {
        // Generate value based on learned distribution
        const mean = groupPattern.mean;
        const variance = groupPattern.variance;
        const syntheticValue = this.addGaussianNoise(mean, Math.sqrt(variance));
        
        return Math.max(0, Math.round(syntheticValue * 100) / 100);
    } else {
        // Fall back to overall patterns
        const mean = patterns.overallMean;
        const variance = patterns.overallVariance;
        const syntheticValue = this.addGaussianNoise(mean, Math.sqrt(variance));
        
        return Math.max(0, Math.round(syntheticValue * 100) / 100);
    }
    }

    /**
     * Calculate variance for a group of records
     */
    static calculateVariance(records, aggregationType) {
    if (records.length < 2) return 0;
    
    let values = [];
    
    switch (aggregationType) {
        case 'count':
        return 0; // Count has no variance within a group
        case 'average':
        case 'sum':
        values = records.map(record => record.numericValue || 0);
        break;
        default:
        return 0;
    }
    
    return this.calculateArrayVariance(values);
    }

    /**
     * Calculate variance of an array of values
     */
    static calculateArrayVariance(values) {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / (values.length - 1);
    
    return variance;
    }

    /**
     * Calculate confidence score based on record count
     */
    static calculateConfidence(recordCount) {
    // Confidence increases logarithmically with record count
    if (recordCount < 5) return 'very_low';
    else if (recordCount < 20) return 'low';
    else if (recordCount < 100) return 'medium';
    else if (recordCount < 500) return 'high';
    else return 'very_high';
    }

    /**
     * Classify FHIR data automatically
     */
    static async classifyFHIRData(fileContent, fhirResourceType) {
    const classification = {
        dataTypes: [fhirResourceType],
        sensitivityLevel: 'normal',
        complianceFlags: ['hipaa', 'gdpr'],
        riskScore: 0,
        recommendations: []
    };
    
    try {
        const fhirData = JSON.parse(fileContent.toString());
        
        // Classify based on FHIR resource type
        switch (fhirResourceType) {
        case 'Patient':
            classification.sensitivityLevel = 'high';
            classification.riskScore = 60;
            classification.dataTypes.push('demographic_data');
            if (fhirData.identifier) {
            classification.dataTypes.push('patient_identifiers');
            classification.riskScore += 20;
            }
            break;
            
        case 'Observation':
            // Check observation category for sensitivity
            if (fhirData.category) {
            const categories = Array.isArray(fhirData.category) ? fhirData.category : [fhirData.category];
            for (const category of categories) {
                if (category.coding) {
                for (const coding of category.coding) {
                    if (this.isSensitiveObservation(coding.code)) {
                    classification.sensitivityLevel = 'very_high';
                    classification.riskScore = 90;
                    classification.dataTypes.push('sensitive_health_data');
                    }
                }
                }
            }
            }
            
            if (classification.sensitivityLevel === 'normal') {
            classification.sensitivityLevel = 'high';
            classification.riskScore = 70;
            }
            break;
            
        case 'DiagnosticReport':
            classification.sensitivityLevel = 'high';
            classification.riskScore = 75;
            classification.dataTypes.push('diagnostic_data');
            break;
            
        case 'Condition':
            classification.sensitivityLevel = 'very_high';
            classification.riskScore = 85;
            classification.dataTypes.push('diagnosis_data');
            break;
            
        case 'MedicationRequest':
        case 'MedicationStatement':
            classification.sensitivityLevel = 'very_high';
            classification.riskScore = 80;
            classification.dataTypes.push('medication_data');
            break;
            
        case 'Procedure':
            classification.sensitivityLevel = 'high';
            classification.riskScore = 70;
            classification.dataTypes.push('procedure_data');
            break;
            
        default:
            classification.sensitivityLevel = 'normal';
            classification.riskScore = 40;
        }
        
        // Add recommendations based on classification
        if (classification.riskScore >= 80) {
        classification.recommendations.push('Require additional access controls');
        classification.recommendations.push('Enable audit logging for all access');
        classification.recommendations.push('Consider data encryption at rest');
        }
        
        if (classification.sensitivityLevel === 'very_high') {
        classification.recommendations.push('Require explicit patient consent');
        classification.recommendations.push('Implement purpose-of-use validation');
        }
        
    } catch (error) {
        // If not valid JSON/FHIR, treat as unknown
        classification.dataTypes = ['unknown'];
        classification.riskScore = 30;
    }
    
    return classification;
    }

    /**
     * Check if observation is sensitive based on coding
     */
    static isSensitiveObservation(code) {
    const sensitiveCodes = [
        // Mental health
        '72133-2', // Psychiatric review of systems
        '72134-0', // Mental status assessment
        
        // Substance abuse
        '72166-2', // Tobacco smoking status
        '11331-6', // History of alcohol use
        
        // Genetic testing
        '51969-4', // Genetic analysis summary report
        '69548-6', // Genetic analysis master panel
        
        // Sexual health
        '76689-9', // Sex assigned at birth
        '72166-2', // Sexual orientation
    ];
    
    return sensitiveCodes.includes(code);
    }

    /**
     * Content-based classification for non-FHIR files
     */
    static async classifyContentBased(fileContent, mimeType) {
    const classification = {
        dataTypes: [],
        sensitivityLevel: 'normal',
        complianceFlags: [],
        riskScore: 30,
        recommendations: []
    };
    
    const content = fileContent.toString().toLowerCase();
    
    // Look for sensitive keywords
    const sensitiveKeywords = {
        'patient_identifiers': ['ssn', 'social security', 'medical record number', 'mrn'],
        'financial_data': ['insurance', 'billing', 'payment', 'credit card'],
        'medical_data': ['diagnosis', 'treatment', 'prescription', 'medication'],
        'personal_data': ['address', 'phone', 'email', 'date of birth']
    };
    
    for (const [dataType, keywords] of Object.entries(sensitiveKeywords)) {
        if (keywords.some(keyword => content.includes(keyword))) {
        classification.dataTypes.push(dataType);
        classification.riskScore += 20;
        }
    }
    
    // Determine sensitivity based on identified data types
    if (classification.dataTypes.length >= 3) {
        classification.sensitivityLevel = 'very_high';
    } else if (classification.dataTypes.length >= 1) {
        classification.sensitivityLevel = 'high';
    }
    
    // Add compliance flags based on content
    if (classification.dataTypes.includes('medical_data')) {
        classification.complianceFlags.push('hipaa');
    }
    
    if (classification.dataTypes.includes('personal_data')) {
        classification.complianceFlags.push('gdpr');
    }
    
    return classification;
    }

    /**
     * Apply machine learning classification (placeholder)
     */
    static async applyMLClassification(fileContent) {
    // Placeholder for ML-based classification
    // In production, this would use trained models to classify content
    
    return {
        dataTypes: ['ml_classified'],
        sensitivityLevel: 'normal',
        complianceFlags: [],
        riskScore: 0,
        recommendations: [],
        mlConfidence: 0.85,
        mlModel: 'healthcare_classifier_v1.0'
    };
    }

    /**
     * Merge multiple classifications
     */
    static mergeClassifications(classification1, classification2) {
    return {
        dataTypes: [...new Set([...classification1.dataTypes, ...classification2.dataTypes])],
        sensitivityLevel: this.getHigherSensitivity(classification1.sensitivityLevel, classification2.sensitivityLevel),
        complianceFlags: [...new Set([...classification1.complianceFlags, ...classification2.complianceFlags])],
        riskScore: Math.max(classification1.riskScore, classification2.riskScore),
        recommendations: [...new Set([...classification1.recommendations, ...classification2.recommendations])]
    };
    }

    /**
     * Get higher sensitivity level between two levels
     */
    static getHigherSensitivity(level1, level2) {
    const sensitivityOrder = ['normal', 'high', 'very_high'];
    const index1 = sensitivityOrder.indexOf(level1);
    const index2 = sensitivityOrder.indexOf(level2);
    
    return sensitivityOrder[Math.max(index1, index2)];
    }

    /**
     * Read and decrypt file helper
     */
    static async readAndDecryptFile(file) {
    const fs = require('fs').promises;
    const path = require('path');
    const AdvancedEncryptionService = require('./advancedEncryptionService');
    
    const uploadDir = process.env.UPLOAD_DIRECTORY || 'uploads';
    const fullFilePath = path.join(uploadDir, file.filePath);
    
    // Read file
    let fileBuffer = await fs.readFile(fullFilePath);
    
    // Decrypt if encrypted
    if (file.isEncrypted && file.encryptionKey) {
        const DocumentFileService = require('../../documents/services/documentFileService');
        fileBuffer = DocumentFileService.decryptBuffer(fileBuffer, file.encryptionKey);
    }
    
    return fileBuffer;
    }

    /**
     * Archive file to specified location
     */
    static async archiveFile(file, archiveLocation) {
    // Placeholder for file archiving
    // In production, this would move files to archive storage (S3, tape, etc.)
    
    console.log(`Archiving file ${file.id} to ${archiveLocation}`);
    
    const fileRepo = AppDataSource.getRepository('DocumentFile');
    await fileRepo.update(file.id, {
        status: 'archived',
        metadata: {
        ...file.metadata,
        archivedAt: new Date(),
        archiveLocation
        }
    });
    }
}

module.exports = DataGovernanceService;
