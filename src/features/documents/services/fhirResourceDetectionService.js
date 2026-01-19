// src/services/fhirResourceDetectionService.js
const crypto = require('crypto');

/**
 * FHIR Resource Detection Service
 * Identifies and parses FHIR resources from uploaded documents
 */
class FHIRResourceDetectionService {

  /**
   * Main method to analyze uploaded file for FHIR content
   */
  static async analyzeDocument(fileBuffer, mimeType, originalFileName) {
    try {
      const analysis = {
        isFHIRResource: false,
        resourceType: null,
        patientIdentifier: null,
        securityLabels: [],
        sensitivityLevel: 'normal',
        fhirVersion: null,
        metadata: {},
        errors: []
      };

      // Check if file might contain FHIR data
      if (!this.couldContainFHIR(mimeType, originalFileName)) {
        return analysis;
      }

      // Try to extract and parse FHIR content
      const fhirData = await this.extractFHIRContent(fileBuffer, mimeType);
      
      if (fhirData) {
        // Validate FHIR structure
        const validation = this.validateFHIRStructure(fhirData);
        
        if (validation.isValid) {
          analysis.isFHIRResource = true;
          analysis.resourceType = fhirData.resourceType;
          analysis.fhirVersion = fhirData.fhirVersion || this.detectFHIRVersion(fhirData);
          
          // Extract patient identifier
          analysis.patientIdentifier = this.extractPatientIdentifier(fhirData);
          
          // Determine security labels
          analysis.securityLabels = this.extractSecurityLabels(fhirData);
          
          // Determine sensitivity level
          analysis.sensitivityLevel = this.determineSensitivityLevel(fhirData);
          
          // Extract additional metadata
          analysis.metadata = this.extractFHIRMetadata(fhirData);
          
        } else {
          analysis.errors = validation.errors;
        }
      }

      return analysis;

    } catch (error) {
      return {
        isFHIRResource: false,
        resourceType: null,
        patientIdentifier: null,
        securityLabels: [],
        sensitivityLevel: 'normal',
        fhirVersion: null,
        metadata: {},
        errors: [`Analysis failed: ${error.message}`]
      };
    }
  }

  /**
   * Check if file type could contain FHIR data
   */
  static couldContainFHIR(mimeType, fileName) {
    const fhirMimeTypes = [
      'application/json',
      'application/fhir+json',
      'application/xml',
      'application/fhir+xml',
      'text/plain',
      'text/json',
      'text/xml'
    ];

    const fhirFilePatterns = [
      /\.json$/i,
      /\.xml$/i,
      /\.fhir$/i,
      /fhir/i,
      /patient/i,
      /observation/i,
      /diagnostic/i
    ];

    return fhirMimeTypes.includes(mimeType) || 
           fhirFilePatterns.some(pattern => pattern.test(fileName));
  }

  /**
   * Extract FHIR content from file buffer
   */
  static async extractFHIRContent(fileBuffer, mimeType) {
    try {
      const content = fileBuffer.toString('utf8');

      if (mimeType.includes('json') || this.looksLikeJSON(content)) {
        return JSON.parse(content);
      }

      if (mimeType.includes('xml') || this.looksLikeXML(content)) {
        // For XML, you'd need an XML parser like xml2js
        // For now, we'll focus on JSON FHIR resources
        return null;
      }

      // Try to parse as JSON anyway (some files have wrong MIME types)
      try {
        return JSON.parse(content);
      } catch {
        return null;
      }

    } catch (error) {
      return null;
    }
  }

  /**
   * Validate FHIR resource structure
   */
  static validateFHIRStructure(data) {
    const errors = [];

    // Check if it's a FHIR resource
    if (!data.resourceType) {
      errors.push('Missing resourceType field');
    }

    // Check for known FHIR resource types
    const knownResourceTypes = [
      'Patient', 'Practitioner', 'Organization', 'Location',
      'Observation', 'DiagnosticReport', 'Condition', 'Procedure',
      'MedicationRequest', 'MedicationStatement', 'AllergyIntolerance',
      'Immunization', 'CarePlan', 'Goal', 'Encounter', 'Appointment',
      'DocumentReference', 'Binary', 'Bundle', 'Consent'
    ];

    if (data.resourceType && !knownResourceTypes.includes(data.resourceType)) {
      errors.push(`Unknown FHIR resource type: ${data.resourceType}`);
    }

    // Check for required FHIR fields
    if (!data.id && !data.identifier) {
      errors.push('FHIR resource must have either id or identifier');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract patient identifier from FHIR resource
   */
  static extractPatientIdentifier(fhirData) {
    try {
      // Direct patient resource
      if (fhirData.resourceType === 'Patient') {
        return this.getIdentifierValue(fhirData.identifier) || fhirData.id;
      }

      // Resource with patient reference
      if (fhirData.patient) {
        if (typeof fhirData.patient === 'string') {
          return this.extractIdFromReference(fhirData.patient);
        }
        if (fhirData.patient.reference) {
          return this.extractIdFromReference(fhirData.patient.reference);
        }
      }

      // Resource with subject reference (many FHIR resources use this)
      if (fhirData.subject) {
        if (typeof fhirData.subject === 'string') {
          return this.extractIdFromReference(fhirData.subject);
        }
        if (fhirData.subject.reference) {
          return this.extractIdFromReference(fhirData.subject.reference);
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract security labels from FHIR resource
   */
  static extractSecurityLabels(fhirData) {
    const labels = [];

    try {
      // Check meta.security field
      if (fhirData.meta && fhirData.meta.security) {
        fhirData.meta.security.forEach(security => {
          if (security.code) {
            labels.push({
              system: security.system || 'unknown',
              code: security.code,
              display: security.display || security.code
            });
          }
        });
      }

      // Check meta.tag field for additional security tags
      if (fhirData.meta && fhirData.meta.tag) {
        fhirData.meta.tag.forEach(tag => {
          if (tag.system && tag.system.includes('security')) {
            labels.push({
              system: tag.system,
              code: tag.code,
              display: tag.display || tag.code
            });
          }
        });
      }

      return labels;
    } catch (error) {
      return [];
    }
  }

  /**
   * Determine sensitivity level based on FHIR resource
   */
  static determineSensitivityLevel(fhirData) {
    const resourceType = fhirData.resourceType;

    // High sensitivity resource types
    const highSensitivityTypes = [
      'Observation', // Lab results, vital signs
      'DiagnosticReport', // Medical reports
      'Condition', // Diagnoses
      'MedicationRequest', // Prescriptions
      'MedicationStatement',
      'AllergyIntolerance',
      'Procedure',
      'Immunization'
    ];

    // Very high sensitivity (psychiatric, genetic, etc.)
    const veryHighSensitivityTypes = [
      'Consent' // Consent documents are always highly sensitive
    ];

    // Check security labels for explicit sensitivity marking
    const securityLabels = this.extractSecurityLabels(fhirData);
    for (const label of securityLabels) {
      if (label.code === 'R' || label.code === 'V') return 'very_high'; // Restricted/Very Restricted
      if (label.code === 'M') return 'high'; // Moderate
    }

    // Check for sensitive data in Observation resources
    if (resourceType === 'Observation') {
      const category = fhirData.category || [];
      const code = fhirData.code || {};
      
      // Check for mental health, substance abuse, genetic data
      const sensitiveKeywords = [
        'mental', 'psychiatric', 'psychology', 'substance', 'drug', 'alcohol',
        'genetic', 'genomic', 'hiv', 'aids', 'reproductive', 'fertility'
      ];
      
      const textToCheck = JSON.stringify([category, code]).toLowerCase();
      if (sensitiveKeywords.some(keyword => textToCheck.includes(keyword))) {
        return 'very_high';
      }
    }

    // Determine by resource type
    if (veryHighSensitivityTypes.includes(resourceType)) {
      return 'very_high';
    }
    
    if (highSensitivityTypes.includes(resourceType)) {
      return 'high';
    }

    // Default sensitivity levels
    if (resourceType === 'Patient') return 'high';
    if (resourceType === 'Practitioner') return 'normal';
    if (resourceType === 'Organization') return 'normal';

    return 'normal';
  }

  /**
   * Extract FHIR metadata
   */
  static extractFHIRMetadata(fhirData) {
    const metadata = {
      fhirResourceType: fhirData.resourceType,
      fhirId: fhirData.id,
      lastUpdated: null,
      versionId: null,
      profile: [],
      tags: []
    };

    try {
      if (fhirData.meta) {
        metadata.lastUpdated = fhirData.meta.lastUpdated;
        metadata.versionId = fhirData.meta.versionId;
        metadata.profile = fhirData.meta.profile || [];
        metadata.tags = fhirData.meta.tag || [];
      }

      // Resource-specific metadata
      if (fhirData.resourceType === 'Patient') {
        metadata.patientInfo = {
          birthDate: fhirData.birthDate,
          gender: fhirData.gender,
          active: fhirData.active
        };
      }

      if (fhirData.resourceType === 'Observation') {
        metadata.observationInfo = {
          status: fhirData.status,
          category: fhirData.category,
          effectiveDateTime: fhirData.effectiveDateTime
        };
      }

      if (fhirData.resourceType === 'DiagnosticReport') {
        metadata.reportInfo = {
          status: fhirData.status,
          category: fhirData.category,
          effectiveDateTime: fhirData.effectiveDateTime
        };
      }

      return metadata;
    } catch (error) {
      return metadata;
    }
  }

  /**
   * Detect FHIR version from resource
   */
  static detectFHIRVersion(fhirData) {
    if (fhirData.fhirVersion) return fhirData.fhirVersion;
    
    // Try to detect from meta
    if (fhirData.meta && fhirData.meta.profile) {
      for (const profile of fhirData.meta.profile) {
        if (profile.includes('4.0')) return '4.0.1';
        if (profile.includes('3.0')) return '3.0.2';
        if (profile.includes('1.0')) return '1.0.2';
      }
    }

    // Default to R4 (most common)
    return '4.0.1';
  }

  // Helper methods

  static looksLikeJSON(content) {
    const trimmed = content.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
           (trimmed.startsWith('[') && trimmed.endsWith(']'));
  }

  static looksLikeXML(content) {
    const trimmed = content.trim();
    return trimmed.startsWith('<') && trimmed.includes('</');
  }

  static getIdentifierValue(identifiers) {
    if (!identifiers || !Array.isArray(identifiers)) return null;
    
    // Prefer system identifiers over others
    const systemIdentifier = identifiers.find(id => id.system);
    if (systemIdentifier) return systemIdentifier.value;
    
    // Return first identifier with value
    const firstWithValue = identifiers.find(id => id.value);
    return firstWithValue ? firstWithValue.value : null;
  }

  static extractIdFromReference(reference) {
    if (typeof reference !== 'string') return null;
    
    // Handle references like "Patient/123" or "https://example.com/Patient/123"
    const match = reference.match(/Patient\/([^\/\?#]+)/);
    return match ? match[1] : null;
  }

  /**
   * Generate encryption key based on FHIR resource sensitivity
   */
  static generateFHIREncryptionKey(sensitivityLevel, resourceType, patientIdentifier) {
    const baseKey = crypto.randomBytes(32);
    
    // Create a deterministic component based on sensitivity and resource type
    const sensitivityMap = {
      'normal': '01',
      'high': '02', 
      'very_high': '03'
    };
    
    const prefix = sensitivityMap[sensitivityLevel] || '01';
    const resourceHash = crypto.createHash('sha256')
      .update(`${resourceType}-${patientIdentifier || 'unknown'}`)
      .digest()
      .slice(0, 2);
    
    return Buffer.concat([Buffer.from(prefix, 'hex'), resourceHash, baseKey]).toString('hex');
  }

  /**
   * Integration method for your existing upload flow
   */
  static async enhanceFileMetadata(processedFile, fileBuffer) {
    try {
      const fhirAnalysis = await this.analyzeDocument(
        fileBuffer, 
        processedFile.mimeType, 
        processedFile.originalFileName
      );

      // Enhance your existing processedFile object
      processedFile.fhirData = fhirAnalysis;
      
      // Update document type if FHIR resource detected
      if (fhirAnalysis.isFHIRResource) {
        processedFile.documentType = `fhir_${fhirAnalysis.resourceType.toLowerCase()}`;
        
        // Generate FHIR-specific encryption key if needed
        if (fhirAnalysis.sensitivityLevel === 'very_high') {
          processedFile.encryptionKey = this.generateFHIREncryptionKey(
            fhirAnalysis.sensitivityLevel,
            fhirAnalysis.resourceType,
            fhirAnalysis.patientIdentifier
          );
        }
      }

      return processedFile;
    } catch (error) {
      console.error('Error enhancing file metadata with FHIR data:', error);
      return processedFile; // Return unchanged if FHIR analysis fails
    }
  }
}

module.exports = FHIRResourceDetectionService;