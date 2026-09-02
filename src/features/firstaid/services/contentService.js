const conditionRepo = require("../data/repositories/conditionRepository");
const emergencyStepRepo = require("../data/repositories/emergencyStepRepository");
const AppDataSource = require("../../../config/database");

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}

class ContentService {
  // ===== UTILITY METHODS =====
  _sanitizeString(str) {
    if (typeof str !== "string") return str;
    return str.trim();
  }

  _validateSeverity(severity) {
    const validSeverities = ["low", "medium", "high", "critical"];
    if (severity && !validSeverities.includes(severity)) {
      throw new ValidationError(
        `Invalid severity. Must be one of: ${validSeverities.join(", ")}`
      );
    }
    return severity || "medium";
  }

  _validateContentType(contentType) {
    const validTypes = ["emergency", "non_emergency"];
    if (!contentType || !validTypes.includes(contentType)) {
      throw new ValidationError(
        `Invalid content type. Must be one of: ${validTypes.join(", ")}`
      );
    }
    return contentType;
  }

  _sanitizeMetadata(metadata) {
    if (!metadata) return null;
    if (typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new ValidationError("Metadata must be a valid object");
    }
    // Deep sanitize metadata values
    const sanitized = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === "string") {
        sanitized[key] = this._sanitizeString(value);
      } else if (typeof value === "number" || typeof value === "boolean") {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  // ===== CONDITION METHODS =====
  async createCondition(conditionData) {
    try {
      const {
        name,
        description,
        contentType,
        severity,
        imageFileId,
        sortOrder = 0,
        metadata,
        isActive = true,
      } = conditionData;

      // Validate and sanitize inputs
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        throw new ValidationError(
          "Name must be a string with at least 2 characters"
        );
      }

      if (
        !description ||
        typeof description !== "string" ||
        description.trim().length < 10
      ) {
        throw new ValidationError(
          "Description must be a string with at least 10 characters"
        );
      }

      const sanitizedName = this._sanitizeString(name);
      const sanitizedDescription = this._sanitizeString(description);
      const validatedContentType = this._validateContentType(contentType);
      const validatedSeverity = this._validateSeverity(severity);
      const sanitizedMetadata = this._sanitizeMetadata(metadata);

      const condition = await conditionRepo.save({
        name: sanitizedName,
        description: sanitizedDescription,
        contentType: validatedContentType,
        severity: validatedSeverity,
        image_file_id: imageFileId,
        sortOrder,
        metadata: sanitizedMetadata,
        isActive,
      });

      return condition;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error("Error creating condition:", error);
      throw new Error("Failed to create condition");
    }
  }

  async getConditions(filters = {}) {
    return await conditionRepo.findAll(filters);
  }

  async getConditionById(id) {
    try {
      const condition = await conditionRepo.findById(id);
      if (!condition) {
        throw new NotFoundError(`Condition with ID ${id} not found`);
      }
      return condition;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error(`Error finding condition ${id}:`, error);
      throw new Error("Failed to retrieve condition");
    }
  }

  async getConditionsByType(contentType, isActiveOnly = true) {
    return await conditionRepo.findByContentType(contentType, isActiveOnly);
  }

  async updateCondition(id, updateData) {
    const condition = await conditionRepo.findById(id);
    if (!condition) {
      throw new NotFoundError(`Condition with ID ${id} not found`);
    }

    await conditionRepo.update(id, updateData);
    return await conditionRepo.findById(id);
  }

  async deleteCondition(id) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const condition = await conditionRepo.findById(id);
      if (!condition) {
        throw new NotFoundError(`Condition with ID ${id} not found`);
      }

      await queryRunner.startTransaction();

      try {
        // Delete associated emergency steps first
        await emergencyStepRepo.deleteByConditionId(id, queryRunner);

        // Then delete the condition
        await conditionRepo.delete(id, queryRunner);

        await queryRunner.commitTransaction();
        return {
          message: "Condition and associated steps deleted successfully",
        };
      } catch (transactionError) {
        await queryRunner.rollbackTransaction();
        throw transactionError;
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error(`Error deleting condition ${id}:`, error);
      throw new Error("Failed to delete condition");
    } finally {
      await queryRunner.release();
    }
  }

  async toggleConditionStatus(id) {
    const condition = await conditionRepo.findById(id);
    if (!condition) {
      throw new NotFoundError(`Condition with ID ${id} not found`);
    }

    const newStatus = !condition.isActive;
    await conditionRepo.toggleActive(id, newStatus);

    return {
      id,
      isActive: newStatus,
      message: `Condition ${newStatus ? "activated" : "deactivated"
        } successfully`,
    };
  }

  // ===== EMERGENCY STEP METHODS =====
  async createEmergencyStep(stepData) {
    try {
      const {
        conditionId,
        categoryType = "general",
        steps,
        categoryImageId,
        sortOrder = 0,
        metadata,
      } = stepData;

      // Validate steps array
      if (!steps || !Array.isArray(steps) || steps.length === 0) {
        throw new ValidationError("Steps must be a non-empty array");
      }

      // Validate each step is a non-empty string
      if (
        !steps.every(
          (step) => typeof step === "string" && step.trim().length > 0
        )
      ) {
        throw new ValidationError("Each step must be a non-empty string");
      }

      // Sanitize steps
      const sanitizedSteps = steps.map((step) => this._sanitizeString(step));
      const sanitizedMetadata = this._sanitizeMetadata(metadata);

      // Verify condition exists
      const condition = await conditionRepo.findById(conditionId);
      if (!condition) {
        throw new NotFoundError(`Condition with ID ${conditionId} not found`);
      }

      // Check if step for this condition+category already exists
      const existingStep = await emergencyStepRepo.findByConditionAndCategory(
        conditionId,
        categoryType
      );
      if (existingStep) {
        throw new ValidationError(
          `Emergency step for category '${categoryType}' already exists for this condition`
        );
      }

      const emergencyStep = await emergencyStepRepo.save({
        condition_id: conditionId,
        categoryType,
        steps: sanitizedSteps,
        category_image_id: categoryImageId,
        sortOrder,
        metadata: sanitizedMetadata,
      });

      return emergencyStep;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      console.error("Error creating emergency step:", error);
      throw new Error("Failed to create emergency step");
    }
  }

  async getEmergencySteps(conditionId) {
    if (!conditionId) {
      return await emergencyStepRepo.findAll();
    }

    const condition = await conditionRepo.findById(conditionId);
    if (!condition) {
      throw new NotFoundError(`Condition with ID ${conditionId} not found`);
    }

    return await emergencyStepRepo.findByConditionId(conditionId);
  }

  async getEmergencyStepById(id) {
    const step = await emergencyStepRepo.findById(id);
    if (!step) {
      throw new NotFoundError(`Emergency step with ID ${id} not found`);
    }
    return step;
  }

  async getEmergencyStepByConditionAndCategory(conditionId, categoryType) {
    const step = await emergencyStepRepo.findByConditionAndCategory(
      conditionId,
      categoryType
    );
    if (!step) {
      throw new NotFoundError(
        "Emergency step not found for this condition and category"
      );
    }
    return step;
  }

  async updateEmergencyStep(id, updateData) {
    const step = await emergencyStepRepo.findById(id);
    if (!step) {
      throw new NotFoundError(`Emergency step with ID ${id} not found`);
    }

    await emergencyStepRepo.update(id, updateData);
    return await emergencyStepRepo.findById(id);
  }

  async deleteEmergencyStep(id) {
    const step = await emergencyStepRepo.findById(id);
    if (!step) {
      throw new NotFoundError(`Emergency step with ID ${id} not found`);
    }

    await emergencyStepRepo.delete(id);
    return { message: "Emergency step deleted successfully" };
  }

  // ===== UTILITY METHODS =====
  async uploadConditionImage(conditionId, documentsData) {
    const condition = await conditionRepo.findById(conditionId);
    if (!condition) {
      throw new NotFoundError(`Condition with ID ${conditionId} not found`);
    }

    // Assuming single image upload for condition
    if (documentsData.length > 0) {
      const imageData = documentsData[0];
      await conditionRepo.update(conditionId, {
        image_file_id: imageData.fileId,
      });
    }

    return await conditionRepo.findById(conditionId);
  }

  async uploadCategoryImage(stepId, documentsData) {
    const step = await emergencyStepRepo.findById(stepId);
    if (!step) {
      throw new NotFoundError(`Emergency step with ID ${stepId} not found`);
    }

    // Assuming single image upload for category
    if (documentsData.length > 0) {
      const imageData = documentsData[0];
      await emergencyStepRepo.update(stepId, {
        category_image_id: imageData.fileId,
      });
    }

    return await emergencyStepRepo.findById(stepId);
  }

  // Get content for offline sync(mobile app)
  async getOfflineSyncManifest() {
    // Use eager loading to avoid N+1 queries
    const conditions = await conditionRepo.findAllWithSteps({ isActive: true });
    const manifest = {
      version: Date.now(),
      conditions: [],
      totalSize: 0,
    };

    for (const condition of conditions) {
      const conditionManifest = {
        id: condition.id,
        name: condition.name,
        description: condition.description,
        contentType: condition.contentType,
        severity: condition.severity,
        imageUrl: condition.imageFile
          ? `/api/documents/images/${condition.imageFile.id}`
          : null,
        steps:
          condition.emergencySteps?.map((step) => ({
            id: step.id,
            categoryType: step.categoryType,
            steps: step.steps,
            imageUrl: step.categoryImage
              ? `/api/documents/images/${step.categoryImage.id}`
              : null,
          })) || [],
      };

      manifest.conditions.push(conditionManifest);
    }

    return manifest;
  }

  /**
   * Get simplified manifest for web (text only, no images)
   */
  async getWebOfflineManifest() {
    try {
      // Use eager loading to avoid N+1 queries
      const conditions = await conditionRepo.findAllWithSteps({
        isActive: true,
      });

      const manifest = {
        version: Date.now(), // simple timestamp
        lastUpdated: new Date().toISOString(),
        conditions: [],
        totalItems: 0,
      };

      for (const condition of conditions) {
        const conditionData = {
          id: condition.id,
          name: condition.name,
          description: condition.description,
          contentType: condition.contentType,
          severity: condition.severity,
          sortOrder: condition.sortOrder,
          steps:
            condition.emergencySteps?.map((step) => ({
              id: step.id,
              categoryType: step.categoryType,
              steps: step.steps,
              sortOrder: step.sortOrder,
            })) || [],
        };

        manifest.conditions.push(conditionData);
      }

      manifest.totalItems = conditions.length;

      return manifest;
    } catch (error) {
      console.error("Error generating web offline manifest:", error);
      throw error;
    }
  }

  /**
   * Get latest content version (simple timestamp)
   */
  async getLatestContentVersion() {
    try {
      const latestCondition = await conditionRepo.repo.findOne({
        order: { updatedAt: "DESC" },
      });

      const latestStep = await emergencyStepRepo.repo.findOne({
        order: { updatedAt: "DESC" },
      });

      let latestTimestamp = 0;

      if (latestCondition?.updatedAt) {
        latestTimestamp = Math.max(
          latestTimestamp,
          new Date(latestCondition.updatedAt).getTime()
        );
      }

      if (latestStep?.updatedAt) {
        latestTimestamp = Math.max(
          latestTimestamp,
          new Date(latestStep.updatedAt).getTime()
        );
      }

      return latestTimestamp || Date.now();
    } catch (error) {
      console.error("Error getting latest content version:", error);
      return Date.now();
    }
  }

  /**
   * Simple health check
   */
  async getSyncHealthStatus() {
    try {
      const totalConditions = await conditionRepo.repo.count();
      const activeConditions = await conditionRepo.repo.count({
        where: { isActive: true },
      });
      const totalSteps = await emergencyStepRepo.repo.count();

      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
        stats: {
          totalConditions,
          activeConditions,
          totalSteps,
        },
      };
    } catch (error) {
      console.error("Sync health check failed:", error);
      return {
        status: "error",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
      };
    }
  }
}

module.exports = new ContentService();