const contentService = require("../services/contentService");

class EmergencyStepController {
  // Public endpoint for mobile app
  async getStepsByCondition(req, res, next) {
    try {
      const { conditionId } = req.params;
      const { categoryType } = req.query;

      if (categoryType) {
        const steps =
          await contentService.getEmergencyStepByConditionAndCategory(
            conditionId,
            categoryType
          );
        res.json({
          success: true,
          data: steps,
          count: steps.length,
        });
      } else {
        const steps = await contentService.getEmergencySteps(conditionId);
        res.json({
          success: true,
          data: steps,
          count: steps.length,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  // Admin endpoints
  async getAllSteps(req, res, next) {
    try {
      const steps = await contentService.getEmergencySteps();
      res.json({
        success: true,
        data: steps,
        count: steps.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStepById(req, res, next) {
    try {
      const { id } = req.params;
      const step = await contentService.getEmergencyStepById(id);
      res.json({
        success: true,
        data: step,
      });
    } catch (error) {
      next(error);
    }
  }

  async createStep(req, res, next) {
    try {
      const stepData = req.body;

      // If files were uploaded, use the first one as category image
      if (req.savedFiles && req.savedFiles.length > 0) {
        stepData.categoryImageId = req.savedFiles[0].id;
      }

      const step = await contentService.createEmergencyStep(stepData);
      res.status(201).json({
        success: true,
        message: "Emergency step created successfully",
        data: step,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStep(req, res, next) {
    try {
      const { id } = req.params;
      const { conditionId, categoryType, steps, sortOrder, metadata } = req.body;

      // Build updateData with only valid EmergencyStep properties
      const updateData = {};

      if (conditionId) {
        updateData.condition_id = conditionId;
      }

      if (categoryType) {
        updateData.categoryType = categoryType;
      }

      if (steps) {
        updateData.steps = steps;
      }

      if (sortOrder !== undefined) {
        updateData.sortOrder = sortOrder;
      }

      if (metadata) {
        updateData.metadata = metadata;
      }

      // If files were uploaded, use the first one as category image
      if (req.savedFiles && req.savedFiles.length > 0) {
        updateData.category_image_id = req.savedFiles[0].id;
      }

      const step = await contentService.updateEmergencyStep(id, updateData);
      res.json({
        success: true,
        message: "Emergency step updated successfully",
        data: step,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteStep(req, res, next) {
    try {
      const { id } = req.params;
      const result = await contentService.deleteEmergencyStep(id);
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadCategoryImage(req, res, next) {
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

      const step = await contentService.uploadCategoryImage(id, documentsData);

      res.json({
        success: true,
        message: "Category image uploaded successfully",
        data: step,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EmergencyStepController();
