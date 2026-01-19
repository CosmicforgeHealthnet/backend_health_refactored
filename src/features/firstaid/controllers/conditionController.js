const contentService = require("../services/contentService");

class ConditionController {
  // Public endpoints for mobile app
  async getEmergencyConditions(req, res, next) {
    try {
      const conditions = await contentService.getConditionsByType(
        "emergency",
        true
      );
      res.json({
        success: true,
        data: conditions,
        count: conditions.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async getNonEmergencyConditions(req, res, next) {
    try {
      const conditions = await contentService.getConditionsByType(
        "non_emergency",
        true
      );
      res.json({
        success: true,
        data: conditions,
        count: conditions.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async getConditionById(req, res, next) {
    try {
      const { id } = req.params;
      const condition = await contentService.getConditionById(id);
      res.json({
        success: true,
        data: condition,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin endpoints
  async getAllConditions(req, res, next) {
    try {
      const { contentType, isActive, severity } = req.query;
      const filters = {};

      if (contentType) filters.contentType = contentType;
      if (isActive !== undefined) filters.isActive = isActive === "true";
      if (severity) filters.severity = severity;

      const conditions = await contentService.getConditions(filters);
      res.json({
        success: true,
        data: conditions,
        count: conditions.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async createCondition(req, res, next) {
    try {
      const conditionData = req.body;

      // Parse metadata if it's a string (from multipart form data)
      if (conditionData.metadata && typeof conditionData.metadata === 'string') {
        try {
          conditionData.metadata = JSON.parse(conditionData.metadata);
        } catch (error) {
          return res.status(400).json({
            error: 'Invalid metadata format. Must be valid JSON.',
            location: {
              country: "Nigeria",
              city: "Lagos",
              region: "Lagos",
              timezone: "Africa/Lagos",
              ip: req.ip || req.connection.remoteAddress || "::1"
            }
          });
        }
      }

      // If files were uploaded, use the first one as the condition image
      if (req.savedFiles && req.savedFiles.length > 0) {
        conditionData.image_file_id = req.savedFiles[0].id;
      }

      const condition = await contentService.createCondition(conditionData);

      // Add location information based on request IP
      const location = {
        country: "Nigeria",
        city: "Lagos",
        region: "Lagos",
        timezone: "Africa/Lagos",
        ip: req.ip || req.connection.remoteAddress || "::1"
      };

      res.status(201).json({
        success: true,
        message: "Condition created successfully",
        data: condition,
        location: location
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCondition(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Whitelist of valid properties for Condition entity
      const validProperties = [
        'name', 'description', 'contentType', 'image_file_id',
        'severity', 'isActive', 'sortOrder', 'metadata'
      ];

      // Filter updateData to only include valid properties
      const filteredUpdateData = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (validProperties.includes(key)) {
          filteredUpdateData[key] = value;
        }
      }

      // If files were uploaded, use the first one as the condition image
      if (req.savedFiles && req.savedFiles.length > 0) {
        filteredUpdateData.image_file_id = req.savedFiles[0].id;
      }

      const condition = await contentService.updateCondition(id, filteredUpdateData);
      res.json({
        success: true,
        message: "Condition updated successfully",
        data: condition,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCondition(req, res, next) {
    try {
      const { id } = req.params;
      const result = await contentService.deleteCondition(id);
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async toggleConditionStatus(req, res, next) {
    try {
      const { id } = req.params;
      const result = await contentService.toggleConditionStatus(id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadConditionImage(req, res, next) {
    try {
      const { id } = req.params;

      if (!req.savedFiles || req.savedFiles.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No image uploaded",
        });
      }

      const documentsData = req.savedFiles.map((file) => ({
        fileId: file.id,
        documentType: "image",
        documentName: file.originalFileName,
      }));

      const condition = await contentService.uploadConditionImage(
        id,
        documentsData
      );

      res.json({
        success: true,
        message: "Condition image uploaded successfully",
        data: condition,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ConditionController();
