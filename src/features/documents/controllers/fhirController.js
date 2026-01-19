// ===== 3. NEW FHIR CONTROLLER =====
// src/controllers/fhirController.js

const DocumentFileService = require('../services/documentFileService');
const DocumentFileRepository = require('../repositories/documentFileRepository');

class FHIRController {

  /**
   * Get all patients for the current user
   * GET /api/fhir/patients
   */
  static async getPatients(req, res) {
    try {
      const userId = req.user.sub;
      const { page = 1, limit = 20 } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const result = await DocumentFileService.getUserPatients(userId, options);

      res.json(result);

    } catch (error) {
      console.error('Error getting patients:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get patients'
      });
    }
  }

  /**
   * Get patient summary
   * GET /api/fhir/patients/:patientId/summary
   */
  static async getPatientSummary(req, res) {
    try {
      const { patientId } = req.params;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await DocumentFileService.getPatientSummary(
        userId,
        patientId,
        ipAddress,
        userAgent
      );

      res.json(result);

    } catch (error) {
      console.error('Error getting patient summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get patient summary'
      });
    }
  }

  /**
   * Get all files for a specific patient
   * GET /api/fhir/patients/:patientId/files
   */
  static async getPatientFiles(req, res) {
    try {
      const { patientId } = req.params;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      const {
        page = 1,
        limit = 50,
        fhirResourceType,
        fhirSensitivityLevel,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        fhirResourceType,
        fhirSensitivityLevel,
        sortBy,
        sortOrder
      };

      const result = await DocumentFileService.getPatientFiles(
        userId,
        patientId,
        options,
        ipAddress,
        userAgent
      );

      res.json(result);

    } catch (error) {
      console.error('Error getting patient files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get patient files'
      });
    }
  }

  /**
   * Get files by FHIR resource type
   * GET /api/fhir/resources/:resourceType
   */
  static async getFilesByResourceType(req, res) {
    try {
      const { resourceType } = req.params;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const {
        page = 1,
        limit = 50,
        patientIdentifier,
        fhirSensitivityLevel,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        patientIdentifier,
        fhirSensitivityLevel,
        sortBy,
        sortOrder
      };

      const result = await DocumentFileService.getFilesByResourceType(
        userId,
        resourceType,
        options,
        ipAddress,
        userAgent
      );

      res.json(result);

    } catch (error) {
      console.error('Error getting files by resource type:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get files by resource type'
      });
    }
  }

  /**
   * Advanced FHIR search
   * POST /api/fhir/search
   */
  static async searchFHIR(req, res) {
    try {
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const searchOptions = {
        ...req.body,
        page: parseInt(req.body.page || 1),
        limit: parseInt(req.body.limit || 50)
      };

      // Validate search options
      const allowedFields = [
        'patientIdentifier', 'fhirResourceType', 'fhirSensitivityLevel',
        'securityLabels', 'dateFrom', 'dateTo', 'searchTerm',
        'page', 'limit', 'sortBy', 'sortOrder'
      ];

      const filteredOptions = {};
      allowedFields.forEach(field => {
        if (searchOptions[field] !== undefined) {
          filteredOptions[field] = searchOptions[field];
        }
      });

      const result = await DocumentFileService.searchFHIRFiles(
        userId,
        filteredOptions,
        ipAddress,
        userAgent
      );

      res.json(result);

    } catch (error) {
      console.error('Error searching FHIR files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search FHIR files'
      });
    }
  }

  /**
   * Get FHIR dashboard data
   * GET /api/fhir/dashboard
   */
  static async getDashboard(req, res) {
    try {
      const userId = req.user.sub;

      const result = await DocumentFileService.getFHIRDashboard(userId);

      res.json(result);

    } catch (error) {
      console.error('Error getting FHIR dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get FHIR dashboard'
      });
    }
  }

  /**
   * Get related files for a patient
   * GET /api/fhir/files/:fileId/related
   */
  static async getRelatedFiles(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await DocumentFileService.getRelatedFiles(
        userId,
        fileId,
        ipAddress,
        userAgent
      );

      res.json(result);

    } catch (error) {
      console.error('Error getting related files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get related files'
      });
    }
  }

  /**
   * Update FHIR metadata (consent, security labels, etc.)
   * PUT /api/fhir/files/:fileId/metadata
   */
  static async updateFHIRMetadata(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const { 
        fhirSensitivityLevel, 
        fhirSecurityLabels, 
        consentDirectives, 
        purposeOfUse 
      } = req.body;

      const updateData = {};
      if (fhirSensitivityLevel !== undefined) updateData.fhirSensitivityLevel = fhirSensitivityLevel;
      if (fhirSecurityLabels !== undefined) updateData.fhirSecurityLabels = fhirSecurityLabels;
      if (consentDirectives !== undefined) updateData.consentDirectives = consentDirectives;
      if (purposeOfUse !== undefined) updateData.purposeOfUse = purposeOfUse;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No FHIR metadata provided for update'
        });
      }

      const result = await DocumentFileService.updateFHIRMetadata(
        userId,
        fileId,
        updateData,
        ipAddress,
        userAgent
      );

      res.json(result);

    } catch (error) {
      console.error('Error updating FHIR metadata:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update FHIR metadata'
      });
    }
  }

  /**
   * Bulk update FHIR files
   * PUT /api/fhir/files/bulk
   */
  static async bulkUpdateFHIR(req, res) {
    try {
      const userId = req.user.sub;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const { fileIds, updateData } = req.body;

      if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'File IDs array is required'
        });
      }

      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Update data is required'
        });
      }

      // Limit bulk operations
      if (fileIds.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Cannot update more than 100 files at once'
        });
      }

      const result = await DocumentFileService.bulkUpdateFHIRFiles(
        userId,
        fileIds,
        updateData,
        ipAddress,
        userAgent
      );

      res.json(result);

    } catch (error) {
      console.error('Error bulk updating FHIR files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk update FHIR files'
      });
    }
  }

  /**
   * Get FHIR compliance report
   * GET /api/fhir/compliance
   */
  static async getComplianceReport(req, res) {
    try {
      const userId = req.user.sub;

      const result = await DocumentFileService.getFHIRComplianceReport(userId);

      res.json(result);

    } catch (error) {
      console.error('Error getting compliance report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get compliance report'
      });
    }
  }

  /**
   * Get FHIR resource types available for user
   * GET /api/fhir/resource-types
   */
  static async getResourceTypes(req, res) {
    try {
      const userId = req.user.sub;

      const stats = await DocumentFileService.getFHIRDashboard(userId);
      
      const resourceTypes = Object.keys(stats.dashboard.resourceDistribution).map(resourceType => ({
        resourceType,
        count: stats.dashboard.resourceDistribution[resourceType].total,
        sensitivityBreakdown: stats.dashboard.resourceDistribution[resourceType].byLevel
      }));

      res.json({
        success: true,
        resourceTypes: resourceTypes.sort((a, b) => b.count - a.count)
      });

    } catch (error) {
      console.error('Error getting resource types:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get resource types'
      });
    }
  }

  /**
   * Get FHIR statistics
   * GET /api/fhir/stats
   */
  static async getStats(req, res) {
    try {
      const userId = req.user.sub;
      const { detailed = false } = req.query;

      if (detailed === 'true') {
        const result = await DocumentFileService.getFHIRDashboard(userId);
        res.json(result);
      } else {
        const stats = await DocumentFileRepository.getFHIRStats(userId);
        res.json({
          success: true,
          stats: {
            totalFHIRFiles: stats.totalFHIRFiles,
            totalPatients: stats.totalPatients,
            resourceTypes: stats.resourceTypeDistribution.length,
            sensitivityLevels: stats.sensitivityDistribution
          }
        });
      }

    } catch (error) {
      console.error('Error getting FHIR stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get FHIR statistics'
      });
    }
  }
}

module.exports = FHIRController;